import type { RequestHandler } from './$types';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database } from '$lib/server/db';
import { downloadDriveFile } from '$lib/server/google';
import { notFound } from '$lib/server/http';
import { driveFiles } from '$lib/server/drizzle/auth-schema';
import { requireFileAccess } from '$lib/server/space-access';

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
  const headers = new Headers(upstream.headers);
  headers.set('content-type', file.mime_type || 'application/octet-stream');
  headers.set(
    'content-disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`
  );
  headers.set('cache-control', 'private, no-store');
  return new Response(upstream.body, { status: upstream.status, headers });
};
