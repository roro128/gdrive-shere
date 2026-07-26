import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { listAdminSpaces } from '$lib/server/space-access';
import { ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  const admin = await requireUser(event, 'admin');
  const spaces = await listAdminSpaces(event, admin);
  return ok({
    files: spaces.map((space) => ({
      id: space.id,
      name: space.name,
      mimeType: 'application/vnd.google-apps.folder',
      size: '0',
      parents: [],
      modifiedTime: space.modifiedTime,
      ownerName: `${space.name} · @${space.handle ?? space.loginId ?? 'member'}`,
      permission: 'admin',
      isAdminSpace: true,
      canShare: false
    }))
  });
};
