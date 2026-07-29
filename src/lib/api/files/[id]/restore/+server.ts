import type { RequestHandler } from '$lib/server/runtime';
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database, now } from '$lib/server/db';
import { trashDriveFile } from '$lib/server/google';
import { assertSameOrigin, badRequest, forbidden, notFound, ok } from '$lib/server/http';
import { driveFiles, userSpaces } from '$lib/server/drizzle/auth-schema';
import { requireEditor, requireFileAccess } from '$lib/server/space-access';
import { toTrashStateUpdate } from '$lib/file-update-model';

export const POST: RequestHandler = async (event) => {
  const user = await requireUser(event);
  assertSameOrigin(event.request, event.url.origin);
  const access = requireEditor(await requireFileAccess(event, user, event.params.id));
  if (!access.file.trashed) badRequest('휴지통에 있는 파일만 복구할 수 있습니다.');
  const space = await database(event)
    .select({ userId: userSpaces.user_id })
    .from(userSpaces)
    .where(eq(userSpaces.root_drive_id, event.params.id))
    .get();
  if (space) forbidden('사용자 개인 공간 자체는 복구할 수 없습니다.');
  const file = await database(event)
    .select({ drive_file_id: driveFiles.drive_file_id })
    .from(driveFiles)
    .where(eq(driveFiles.drive_file_id, event.params.id))
    .get();
  if (!file) notFound();
  const updated = await trashDriveFile(event, file.drive_file_id, false);
  await database(event)
    .update(driveFiles)
    .set(toTrashStateUpdate(false, now()))
    .where(eq(driveFiles.drive_file_id, file.drive_file_id))
    .run();
  return ok({ file: updated });
};
