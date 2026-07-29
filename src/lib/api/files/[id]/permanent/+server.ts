import type { RequestHandler } from '$lib/server/runtime';
import { eq, inArray } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database } from '$lib/server/db';
import { deleteDriveFile } from '$lib/server/google';
import { assertSameOrigin, badRequest, forbidden, ok } from '$lib/server/http';
import { driveFiles, userSpaces } from '$lib/server/drizzle/auth-schema';
import { requireEditor, requireFileAccess } from '$lib/server/space-access';
import {
  collectTrashedDescendantIds,
  orderDriveDeletionIds
} from '$lib/server/permanent-delete-model';
import { deleteDriveFilesSequentially } from '$lib/server/drive-deletion-workflow';

export const DELETE: RequestHandler = async (event) => {
  const user = await requireUser(event);
  assertSameOrigin(event.request, event.url.origin);
  const access = requireEditor(await requireFileAccess(event, user, event.params.id));
  if (!access.file.trashed) badRequest('휴지통에 있는 파일만 영구 삭제할 수 있습니다.');

  const space = await database(event)
    .select({ userId: userSpaces.user_id })
    .from(userSpaces)
    .where(eq(userSpaces.root_drive_id, event.params.id))
    .get();
  if (space) forbidden('사용자 개인 공간 자체는 삭제할 수 없습니다.');

  const trashedFiles = await database(event)
    .select({ id: driveFiles.drive_file_id, parentId: driveFiles.parent_drive_id })
    .from(driveFiles)
    .where(eq(driveFiles.trashed, 1))
    .all();
  const ids = collectTrashedDescendantIds(event.params.id, trashedFiles);

  await deleteDriveFilesSequentially(orderDriveDeletionIds(ids), {
    deleteFile: (id) => deleteDriveFile(event, id)
  });
  await database(event).delete(driveFiles).where(inArray(driveFiles.drive_file_id, ids)).run();
  return ok({ deleted: ids });
};
