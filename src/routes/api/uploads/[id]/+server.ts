import type { RequestHandler } from './$types';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { decrypt } from '$lib/server/crypto';
import { database, now, type UploadSessionRow } from '$lib/server/db';
import { queryUploadSession, uploadChunk } from '$lib/server/google';
import { assertSameOrigin, notFound, ok } from '$lib/server/http';
import { completedBytesFromRange, parseByteRange } from '$lib/server/upload-utils';
import { driveFiles, uploadSessions } from '$lib/server/drizzle/auth-schema';

async function ownedSession(event: Parameters<RequestHandler>[0]): Promise<UploadSessionRow> {
  const user = await requireUser(event);
  const row = (await database(event)
    .select()
    .from(uploadSessions)
    .where(and(eq(uploadSessions.id, event.params.id), eq(uploadSessions.user_id, user.id)))
    .get()) as UploadSessionRow | undefined;
  if (!row) notFound('업로드 세션을 찾을 수 없습니다.');
  const secret = event.platform?.env.APP_ENCRYPTION_KEY;
  if (!secret) throw new Error('APP_ENCRYPTION_KEY is not configured');
  return { ...row, drive_session_url: await decrypt(row.drive_session_url, secret) };
}

export const GET: RequestHandler = async (event) => {
  const session = await ownedSession(event);
  const upstream = await queryUploadSession(session);
  const range = upstream.headers.get('range');
  const received = completedBytesFromRange(range) ?? session.received_bytes;
  if (upstream.status === 308 && received !== session.received_bytes) {
    await database(event)
      .update(uploadSessions)
      .set({ received_bytes: received, updated_at: now() })
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
  const session = await ownedSession(event);
  const upstream = await uploadChunk(event, session);
  const range = upstream.headers.get('range');
  const contentRange = event.request.headers.get('content-range');
  const parsedRange = contentRange ? parseByteRange(contentRange) : null;
  const received =
    completedBytesFromRange(range) ?? (parsedRange ? parsedRange.end + 1 : session.total_bytes);
  if (upstream.status === 200 || upstream.status === 201) {
    const payload = (await upstream.json()) as {
      id: string;
      name: string;
      mimeType: string;
      size?: string;
      parents?: string[];
      modifiedTime?: string;
    };
    await database(event)
      .update(uploadSessions)
      .set({
        drive_file_id: payload.id,
        received_bytes: session.total_bytes,
        status: 'complete',
        updated_at: now()
      })
      .where(eq(uploadSessions.id, session.id))
      .run();
    await database(event)
      .insert(driveFiles)
      .values({
        id: crypto.randomUUID(),
        drive_file_id: payload.id,
        name: payload.name,
        mime_type: payload.mimeType,
        size_bytes: Number(payload.size ?? session.total_bytes),
        parent_drive_id: payload.parents?.[0] ?? session.parent_drive_id,
        created_by: session.user_id,
        owner_user_id: session.owner_user_id ?? session.user_id,
        trashed: 0,
        created_at: now(),
        updated_at: now()
      })
      .onConflictDoUpdate({
        target: driveFiles.drive_file_id,
        set: {
          name: payload.name,
          mime_type: payload.mimeType,
          size_bytes: Number(payload.size ?? session.total_bytes),
          parent_drive_id: payload.parents?.[0] ?? session.parent_drive_id,
          trashed: 0,
          updated_at: now()
        }
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
    .set({ received_bytes: Math.max(0, received), updated_at: now() })
    .where(eq(uploadSessions.id, session.id))
    .run();
  if (!upstream.ok && upstream.status !== 308) {
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': 'text/plain' }
    });
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
  const session = await ownedSession(event);
  await database(event)
    .update(uploadSessions)
    .set({ status: 'cancelled', updated_at: now() })
    .where(eq(uploadSessions.id, session.id))
    .run();
  return ok({ ok: true });
};
