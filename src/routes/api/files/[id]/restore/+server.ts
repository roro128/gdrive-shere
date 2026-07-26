import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database, now } from '$lib/server/db';
import { trashDriveFile } from '$lib/server/google';
import { assertSameOrigin, notFound, ok } from '$lib/server/http';
import { driveFiles } from '$lib/server/drizzle/auth-schema';
import { requireFileAccess } from '$lib/server/space-access';

export const POST: RequestHandler = async (event) => {
  const user = await requireUser(event);
  assertSameOrigin(event.request, event.url.origin);
  await requireFileAccess(event, user, event.params.id);
  const file = await database(event)
    .select({ drive_file_id: driveFiles.drive_file_id })
    .from(driveFiles)
    .where(eq(driveFiles.drive_file_id, event.params.id))
    .get();
  if (!file) notFound();
  const updated = await trashDriveFile(event, file.drive_file_id, false);
  await database(event)
    .update(driveFiles)
    .set({ trashed: 0, updated_at: now() })
    .where(eq(driveFiles.drive_file_id, file.drive_file_id))
    .run();
  return ok({ file: updated });
};
