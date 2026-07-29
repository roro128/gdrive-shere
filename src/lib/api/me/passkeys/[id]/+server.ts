import type { RequestHandler } from '$lib/server/runtime';
import { and, eq } from 'drizzle-orm';
import { currentUser } from '$lib/server/auth';
import { createDatabase } from '$lib/server/drizzle/client';
import { authPasskey } from '$lib/server/drizzle/auth-schema';
import { assertSameOrigin, notFound, unauthorized, ok } from '$lib/server/http';
import { rpId } from '$lib/server/auth';

export const DELETE: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const user = await currentUser(event);
  if (!user?.auth_user_id) unauthorized('패스키를 사용할 수 있는 계정을 찾을 수 없습니다.');
  const result = await createDatabase(event)
    .delete(authPasskey)
    .where(and(eq(authPasskey.id, event.params.id), eq(authPasskey.userId, user.auth_user_id)))
    .run();
  if (!result.meta.changes) notFound('패스키를 찾을 수 없습니다.');
  const remaining = await createDatabase(event)
    .select({ credentialId: authPasskey.credentialID })
    .from(authPasskey)
    .where(eq(authPasskey.userId, user.auth_user_id))
    .all();
  return ok({
    ok: true,
    rpId: rpId(event),
    userId: user.auth_user_id,
    acceptedCredentialIds: remaining.map((passkey) => passkey.credentialId)
  });
};
