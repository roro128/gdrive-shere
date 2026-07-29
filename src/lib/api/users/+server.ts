import type { RequestHandler } from '$lib/server/runtime';
import { listUsers, requireUser, setUserStatus } from '$lib/server/auth';
import { assertSameOrigin, readJson, ok } from '$lib/server/http';
import { toAdminUserResponse } from '$lib/auth-response-model';

export const GET: RequestHandler = async (event) => {
  const users = await listUsers(event);
  return ok({
    users: users.map(toAdminUserResponse)
  });
};

export const PATCH: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  await requireUser(event, 'admin');
  const input = await readJson<{ userId?: string; status?: 'active' | 'disabled' }>(event.request);
  if (!input.userId || !input.status)
    return new Response('userId and status are required', { status: 400 });
  await setUserStatus(event, input.userId, input.status);
  return ok({ ok: true });
};
