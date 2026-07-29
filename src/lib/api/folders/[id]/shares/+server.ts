import type { RequestHandler } from '$lib/server/runtime';
import { requireUser } from '$lib/server/auth';
import { folderShareState, replaceFolderShares } from '$lib/server/space-access';
import { assertSameOrigin, readJson, ok } from '$lib/server/http';
import { normalizeRequestedShares } from '$lib/share-management';

export const GET: RequestHandler = async (event) => {
  const user = await requireUser(event);
  return ok(await folderShareState(event, user, event.params.id));
};

export const PUT: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const user = await requireUser(event);
  const input = await readJson<{ users?: { userId?: string; permission?: 'viewer' | 'editor' }[] }>(
    event.request
  );
  const requestedUsers = normalizeRequestedShares(input.users);
  return ok(await replaceFolderShares(event, user, event.params.id, requestedUsers));
};
