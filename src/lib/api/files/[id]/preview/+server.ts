import type { RequestHandler } from '$lib/server/runtime';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database } from '$lib/server/db';
import { downloadDriveFile } from '$lib/server/google';
import { notFound } from '$lib/server/http';
import { driveFiles } from '$lib/server/drizzle/auth-schema';
import { requireFileAccess } from '$lib/server/space-access';
import { isPreviewableFile } from '$lib/workspace-model';
import { buildFileResponseHeaders } from '$lib/file-response-model';

export const GET: RequestHandler = async (event) => {
  const user = await requireUser(event);
  await requireFileAccess(event, user, event.params.id);
  const file = await database(event)
    .select({ name: driveFiles.name, mime_type: driveFiles.mime_type })
    .from(driveFiles)
    .where(and(eq(driveFiles.drive_file_id, event.params.id), eq(driveFiles.trashed, 0)))
    .get();
  if (!file || !isPreviewableFile(file.mime_type)) notFound('미리보기를 지원하지 않는 파일입니다.');
  const upstream = await downloadDriveFile(event, event.params.id);
  const headers = new Headers({
    ...Object.fromEntries(upstream.headers),
    ...buildFileResponseHeaders(file.mime_type, file.name, 'inline')
  });
  return new Response(upstream.body, { status: upstream.status, headers });
};
