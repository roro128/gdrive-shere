import type { RequestHandler } from '$lib/server/runtime';
import { desc } from 'drizzle-orm';
import { createInvitation, requireUser } from '$lib/server/auth';
import { assertSameOrigin, readJson, ok } from '$lib/server/http';
import { database } from '$lib/server/db';
import { invitations } from '$lib/server/drizzle/auth-schema';

export const GET: RequestHandler = async (event) => {
  await requireUser(event, 'admin');
  const rows = await database(event)
    .select({
      id: invitations.id,
      role: invitations.role,
      expires_at: invitations.expires_at,
      used_at: invitations.used_at,
      revoked_at: invitations.revoked_at,
      created_at: invitations.created_at
    })
    .from(invitations)
    .orderBy(desc(invitations.created_at))
    .all();
  return ok({ invitations: rows });
};

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const input = await readJson<{ role?: 'admin' | 'member' }>(event.request);
  const invitation = await createInvitation(event, input.role === 'admin' ? 'admin' : 'member');
  return ok(
    { invitation, link: `${event.url.origin}/invite/${invitation.token}` },
    { status: 201 }
  );
};
