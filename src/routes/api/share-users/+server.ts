import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { shareableUsers } from '$lib/server/space-access';
import { ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  const user = await requireUser(event);
  return ok({ users: await shareableUsers(event, user, event.url.searchParams.get('q') ?? '') });
};
