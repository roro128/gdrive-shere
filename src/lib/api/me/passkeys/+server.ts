import type { RequestHandler } from '$lib/server/runtime';
import { eq } from 'drizzle-orm';
import { currentUser } from '$lib/server/auth';
import { createPasskeyRegistrationContext } from '$lib/server/better-auth';
import { createDatabase } from '$lib/server/drizzle/client';
import { authPasskey } from '$lib/server/drizzle/auth-schema';
import { assertSameOrigin, unauthorized, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  const user = await currentUser(event);
  if (!user?.auth_user_id) unauthorized('패스키를 사용할 수 있는 계정을 찾을 수 없습니다.');
  const passkeys = await createDatabase(event)
    .select({ id: authPasskey.id, name: authPasskey.name, createdAt: authPasskey.createdAt })
    .from(authPasskey)
    .where(eq(authPasskey.userId, user.auth_user_id))
    .all();
  return ok({ passkeys });
};

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const user = await currentUser(event);
  if (!user?.auth_user_id) unauthorized('패스키를 사용할 수 있는 계정을 찾을 수 없습니다.');
  return ok({ context: await createPasskeyRegistrationContext(event, user.auth_user_id) });
};
