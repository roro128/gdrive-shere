import { acceptsAccountDeletion } from '$lib/account-deletion';
import { cleanupAccountDeletion, queueAccountDeletion } from '$lib/server/account-deletion';
import { toDisabledUserUpdate } from '$lib/server/account-deletion-model';
import { destroySession, requireUser } from '$lib/server/auth';
import { database, now } from '$lib/server/db';
import {
  legacySessions,
  passkeys,
  users,
  webauthnChallenges
} from '$lib/server/drizzle/auth-schema';
import { eq } from 'drizzle-orm';
import { assertSameOrigin, badRequest, ok, readJson } from '$lib/server/http';
import type { RequestHandler } from '$lib/server/runtime';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const user = await requireUser(event);
  const input = await readJson<{
    confirmation?: string;
    acknowledged?: { files?: boolean; shares?: boolean; passkeys?: boolean };
  }>(event.request);
  if (!acceptsAccountDeletion(input.confirmation, input.acknowledged))
    badRequest('삭제 범위를 모두 확인하고 “계정 삭제”를 입력해주세요.');

  const db = database(event);
  await db.update(users).set(toDisabledUserUpdate(now())).where(eq(users.id, user.id)).run();
  await db.delete(passkeys).where(eq(passkeys.user_id, user.id)).run();
  await db.delete(webauthnChallenges).where(eq(webauthnChallenges.user_id, user.id)).run();
  await db.delete(legacySessions).where(eq(legacySessions.user_id, user.id)).run();
  await destroySession(event);

  const jobId = await queueAccountDeletion(event, user.id);
  const env = event.platform?.env;
  const ctx = event.platform?.ctx;
  if (!env || !ctx) throw new Error('Cloudflare runtime이 없습니다.');
  ctx.waitUntil(cleanupAccountDeletion(env, ctx, jobId));
  return ok({ queued: true });
};
