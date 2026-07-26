import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { listSharedFolders } from '$lib/server/space-access';
import { ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  const user = await requireUser(event);
  const folders = await listSharedFolders(event, user);
  return ok({
    files: folders.map((folder) => ({
      ...folder,
      size: '0',
      parents: [],
      shared: true,
      canShare: folder.sharedByMe === true,
      sharedByMe: folder.sharedByMe === true,
      sharedWithCount: folder.sharedWithCount,
      sharedWithNames: folder.sharedWithNames
    }))
  });
};
