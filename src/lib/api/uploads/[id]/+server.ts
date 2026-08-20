import type { RequestHandler } from '$lib/server/runtime';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { decrypt } from '$lib/server/crypto';
import { database, newId, now, type UploadSessionRow } from '$lib/server/db';
import { queryUploadSession, uploadChunk } from '$lib/server/google';
import { GoogleApiError, googleApiUserMessage } from '$lib/server/google-http-model';
import { assertSameOrigin, notFound, ok } from '$lib/server/http';
import { completedBytesFromRange, parseByteRange } from '$lib/server/upload-utils';
import {
  isCompletedUploadResponse,
  buildCompletedUploadPersistence,
  isActiveUploadSession,
  resolveReceivedBytes,
  toCancelledUploadUpdate,
  toUploadProgressUpdate
} from '$lib/server/upload-session-model';
import { driveFiles, uploadSessions } from '$lib/server/drizzle/auth-schema';

async function ownedSession(
  event: Parameters<RequestHandler>[0],
  writable = false
): Promise<UploadSessionRow> {
  const user = await requireUser(event);
  const row = (await database(event)
    .select()
    .from(uploadSessions)
    .where(and(eq(uploadSessions.id, event.params.id), eq(uploadSessions.user_id, user.id)))
    .get()) as UploadSessionRow | undefined;
  if (!row) notFound('업로드 세션을 찾을 수 없습니다.');
  const secret = event.platform?.env.APP_ENCRYPTION_KEY;
  if (!secret) throw new Error('APP_ENCRYPTION_KEY is not configured');
  const active = isActiveUploadSession(row.status, row.expires_at, now());
  if (writable && !active) notFound('만료되었거나 종료된 업로드 세션입니다.');
  return { ...row, drive_session_url: active ? await decrypt(row.drive_session_url, secret) : '' };
}

export const GET: RequestHandler = async (event) => {
  const session = await ownedSession(event);
  const active = isActiveUploadSession(session.status, session.expires_at, now());
  if (!active)
    return ok({
      uploadId: session.id,
      status: session.status === 'active' ? 'expired' : session.status,
      receivedBytes: session.received_bytes,
      totalBytes: session.total_bytes
    });
  const upstream = await queryUploadSession(session);
  const range = upstream.headers.get('range');
  const received = resolveReceivedBytes(
    completedBytesFromRange(range),
    null,
    session.received_bytes
  );
  if (upstream.status === 308 && received !== session.received_bytes) {
    await database(event)
      .update(uploadSessions)
      .set(toUploadProgressUpdate(received, now()))
      .where(eq(uploadSessions.id, session.id))
      .run();
  }
  return ok({
    uploadId: session.id,
    status: session.status,
    receivedBytes: Math.max(0, received),
    totalBytes: session.total_bytes
  });
};

export const PUT: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const session = await ownedSession(event, true);
  const upstream = await uploadChunk(event, session);
  const range = upstream.headers.get('range');
  const contentRange = event.request.headers.get('content-range');
  const parsedRange = contentRange ? parseByteRange(contentRange) : null;
  const received = resolveReceivedBytes(
    completedBytesFromRange(range),
    parsedRange?.end ?? null,
    session.total_bytes
  );
  if (isCompletedUploadResponse(upstream.status)) {
    const payload = (await upstream.json()) as {
      id: string;
      name: string;
      mimeType: string;
      size?: string;
      parents?: string[];
      modifiedTime?: string;
    };
    const persistence = buildCompletedUploadPersistence(
      payload,
      {
        parentId: session.parent_drive_id,
        userId: session.user_id,
        ownerUserId: session.owner_user_id ?? session.user_id,
        totalBytes: session.total_bytes
      },
      { now, newId }
    );
    await database(event)
      .update(uploadSessions)
      .set(persistence.session)
      .where(eq(uploadSessions.id, session.id))
      .run();
    await database(event)
      .insert(driveFiles)
      .values(persistence.file.values)
      .onConflictDoUpdate({
        target: driveFiles.drive_file_id,
        set: persistence.file.update
      })
      .run();
    return ok({
      uploadId: session.id,
      status: 'complete',
      receivedBytes: session.total_bytes,
      file: payload
    });
  }
  await database(event)
    .update(uploadSessions)
    .set(toUploadProgressUpdate(received, now()))
    .where(eq(uploadSessions.id, session.id))
    .run();
  if (!upstream.ok && upstream.status !== 308) {
    const error = new GoogleApiError(upstream.status, await upstream.text());
    return Response.json({ message: googleApiUserMessage(error) }, { status: 502 });
  }
  return ok({
    uploadId: session.id,
    status: 'active',
    receivedBytes: Math.max(0, received),
    totalBytes: session.total_bytes
  });
};

export const DELETE: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const session = await ownedSession(event, true);
  await database(event)
    .update(uploadSessions)
    .set(toCancelledUploadUpdate(now()))
    .where(eq(uploadSessions.id, session.id))
    .run();
  return ok({ ok: true });
};
