import type { RequestHandler } from '$lib/server/runtime';
import { requireUser } from '$lib/server/auth';
import { listSharedFolders } from '$lib/server/space-access';
import { ok } from '$lib/server/http';
import { toSharedFolderFile } from '$lib/server/shared-folder-model';

export const GET: RequestHandler = async (event) => {
  const user = await requireUser(event);
  const folders = await listSharedFolders(event, user);
  return ok({
    files: folders.map(toSharedFolderFile)
  });
};
