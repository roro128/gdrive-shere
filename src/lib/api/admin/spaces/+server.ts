import type { RequestHandler } from '$lib/server/runtime';
import { requireUser } from '$lib/server/auth';
import { listAdminSpaces } from '$lib/server/space-access';
import { ok } from '$lib/server/http';
import { toAdminSpaceFile } from '$lib/server/shared-folder-model';

export const GET: RequestHandler = async (event) => {
  const admin = await requireUser(event, 'admin');
  const spaces = await listAdminSpaces(event, admin);
  return ok({
    files: spaces.map(toAdminSpaceFile)
  });
};
