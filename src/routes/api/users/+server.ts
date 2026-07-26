import type { RequestHandler } from './$types';
import { listUsers, requireUser, setUserStatus } from '$lib/server/auth';
import { assertSameOrigin, readJson, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  const users = await listUsers(event);
  return ok({
    users: users.map((user) => ({
      id: user.id,
      displayName: user.display_name,
      handle: user.handle ?? user.login_id,
      loginId: user.login_id,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }))
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
