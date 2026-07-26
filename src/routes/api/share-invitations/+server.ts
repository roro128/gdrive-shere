import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { listShareInvitations, respondToShareInvitation } from '$lib/server/space-access';
import { assertSameOrigin, readJson, ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  const user = await requireUser(event);
  return ok({ invitations: await listShareInvitations(event, user) });
};

export const PATCH: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const user = await requireUser(event);
  const input = await readJson<{ invitationId?: string; accept?: boolean }>(event.request);
  if (!input.invitationId) return new Response('invitationId is required', { status: 400 });
  return ok(await respondToShareInvitation(event, user, input.invitationId, input.accept === true));
};
