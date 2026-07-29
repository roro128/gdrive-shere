import type { RequestHandler } from '$lib/server/runtime';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database } from '$lib/server/db';
import { downloadDriveFile } from '$lib/server/google';
import { notFound } from '$lib/server/http';
import { driveFiles } from '$lib/server/drizzle/auth-schema';
import { requireFileAccess } from '$lib/server/space-access';
import { buildFileResponseHeaders } from '$lib/file-response-model';

export const GET: RequestHandler = async (event) => {
  const user = await requireUser(event);
  await requireFileAccess(event, user, event.params.id);
  const file = await database(event)
    .select({ name: driveFiles.name, mime_type: driveFiles.mime_type })
    .from(driveFiles)
    .where(and(eq(driveFiles.drive_file_id, event.params.id), eq(driveFiles.trashed, 0)))
    .get();
  if (!file) notFound();
  const upstream = await downloadDriveFile(event, event.params.id);
  const headers = new Headers({
    ...Object.fromEntries(upstream.headers),
    ...buildFileResponseHeaders(file.mime_type, file.name, 'attachment')
  });
  return new Response(upstream.body, { status: upstream.status, headers });
};
