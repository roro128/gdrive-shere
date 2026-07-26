import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import type { RequestEvent } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { appOrigin, rpId } from './auth';
import { decrypt, encrypt, hashPassword, verifyPassword } from './crypto';
import { createDatabase } from './drizzle/client';
import { authSchema, authUser, invitations, users } from './drizzle/auth-schema';
import { database, now } from './db';

function runtime(event: RequestEvent) {
  const env = event.platform?.env;
  if (!env) throw new Error('Cloudflare environment is not configured');
  return env;
}

function passkeyContextSecret(event: RequestEvent): string {
  const secret = runtime(event).APP_ENCRYPTION_KEY;
  if (!secret) throw new Error('APP_ENCRYPTION_KEY is not configured');
  return secret;
}

export function createBetterAuth(event: RequestEvent) {
  const env = runtime(event);
  const origin = appOrigin(event);
  const secret = env.AUTH_SECRET || env.APP_ENCRYPTION_KEY;
  if (!secret) throw new Error('AUTH_SECRET or APP_ENCRYPTION_KEY is not configured');
  return betterAuth({
    database: drizzleAdapter(createDatabase(event), {
      provider: 'sqlite',
      schema: authSchema
    }),
    baseURL: origin,
    basePath: '/api/auth',
    secret,
    trustedOrigins: [origin],
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      password: {
        hash: hashPassword,
        verify: ({ password, hash }) => verifyPassword(password, hash)
      },
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async () => {
        // GDrive Share deliberately routes reset requests through an administrator.
      }
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, input: false },
        status: { type: 'string', required: false, input: false }
      }
    },
    plugins: [
      username(),
      passkey({
        rpID: rpId(event),
        rpName: 'GShare',
        origin,
        registration: {
          requireSession: false,
          resolveUser: async ({ context }) => {
            if (!context)
              throw new APIError('BAD_REQUEST', { message: '등록 context가 필요합니다.' });
            let payload: { userId: string; expiresAt: number };
            try {
              payload = JSON.parse(await decrypt(context, passkeyContextSecret(event))) as {
                userId: string;
                expiresAt: number;
              };
            } catch {
              throw new APIError('UNAUTHORIZED', { message: '등록 context가 유효하지 않습니다.' });
            }
            if (payload.expiresAt < Date.now())
              throw new APIError('UNAUTHORIZED', { message: '등록 context가 만료되었습니다.' });
            const user = await createDatabase(event)
              .select({ id: authUser.id, name: authUser.name, email: authUser.email })
              .from(authUser)
              .where(eq(authUser.id, payload.userId))
              .get();
            if (!user)
              throw new APIError('UNAUTHORIZED', { message: '등록 사용자를 찾을 수 없습니다.' });
            return user;
          },
          afterVerification: async ({ user }) => {
            const linked = await database(event)
              .select({ id: users.id, invitation_id: users.invitation_id })
              .from(users)
              .where(and(eq(users.auth_user_id, user.id), eq(users.status, 'pending')))
              .get();
            if (!linked) return;
            await database(event)
              .update(users)
              .set({ status: 'active', updated_at: now() })
              .where(eq(users.id, linked.id))
              .run();
            if (linked.invitation_id)
              await database(event)
                .update(invitations)
                .set({ used_at: now() })
                .where(and(eq(invitations.id, linked.invitation_id), isNull(invitations.used_at)))
                .run();
          }
        }
      })
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email' && !ctx.headers?.get('x-gdrive-invite')) {
          throw new APIError('FORBIDDEN', { message: '초대 링크가 필요합니다.' });
        }
      })
    }
  });
}

export async function createPasskeyRegistrationContext(
  event: RequestEvent,
  userId: string,
  ttlMs = 5 * 60 * 1000
): Promise<string> {
  return encrypt(
    JSON.stringify({ userId, expiresAt: Date.now() + ttlMs }),
    passkeyContextSecret(event)
  );
}
