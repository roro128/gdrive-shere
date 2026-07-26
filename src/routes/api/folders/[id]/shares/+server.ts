import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { folderShareState, replaceFolderShares } from '$lib/server/space-access';
import { assertSameOrigin, readJson, ok } from '$lib/server/http';

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
  const requestedUsers = Array.isArray(input.users)
    ? input.users.filter(
        (entry): entry is { userId: string; permission: 'viewer' | 'editor' } =>
          typeof entry?.userId === 'string' &&
          (entry.permission === 'viewer' || entry.permission === 'editor')
      )
    : [];
  return ok(await replaceFolderShares(event, user, event.params.id, requestedUsers));
};
