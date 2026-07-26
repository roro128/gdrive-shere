import type { RequestHandler } from './$types';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database } from '$lib/server/db';
import { downloadDriveFile } from '$lib/server/google';
import { notFound } from '$lib/server/http';
import { driveFiles } from '$lib/server/drizzle/auth-schema';
import { requireFileAccess } from '$lib/server/space-access';

const SAFE_PREVIEW_TYPES = new Set(['application/pdf']);

export const GET: RequestHandler = async (event) => {
  const user = await requireUser(event);
  await requireFileAccess(event, user, event.params.id);
  const file = await database(event)
    .select({ name: driveFiles.name, mime_type: driveFiles.mime_type })
    .from(driveFiles)
    .where(and(eq(driveFiles.drive_file_id, event.params.id), eq(driveFiles.trashed, 0)))
    .get();
  if (
    !file ||
    !(
      file.mime_type.startsWith('image/') ||
      file.mime_type.startsWith('video/') ||
      file.mime_type.startsWith('audio/') ||
      file.mime_type.startsWith('text/') ||
      SAFE_PREVIEW_TYPES.has(file.mime_type)
    )
  )
    notFound('미리보기를 지원하지 않는 파일입니다.');
  const upstream = await downloadDriveFile(event, event.params.id);
  const headers = new Headers(upstream.headers);
  headers.set('content-type', file.mime_type);
  headers.set('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  headers.set('cache-control', 'private, no-store');
  return new Response(upstream.body, { status: upstream.status, headers });
};
