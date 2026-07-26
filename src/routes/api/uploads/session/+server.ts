import type { RequestHandler } from './$types';
import { driveFiles, uploadSessions } from '$lib/server/drizzle/auth-schema';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database, newId, now } from '$lib/server/db';
import { createUploadSession, trashDriveFile } from '$lib/server/google';
import { assertSameOrigin, badRequest, forbidden, readJson, ok } from '$lib/server/http';
import { encrypt } from '$lib/server/crypto';
import { ensureUserSpace, requireEditor, requireFolderAccess } from '$lib/server/space-access';

export const POST: RequestHandler = async (event) => {
  const user = await requireUser(event);
  if (user.role === 'admin') forbidden('관리자는 파일을 직접 업로드할 수 없습니다.');
  assertSameOrigin(event.request, event.url.origin);
  const input = await readJson<{
    name?: string;
    mimeType?: string;
    size?: number;
    parentId?: string | null;
    conflictAction?: 'replace' | 'overwrite';
    existingFileId?: string;
  }>(event.request);
  if (
    !input.name ||
    typeof input.size !== 'number' ||
    !Number.isSafeInteger(input.size) ||
    input.size < 0
  )
    badRequest('파일 이름과 유효한 파일 크기가 필요합니다.');
  const size = input.size;
  const parentId = input.parentId || (await ensureUserSpace(event, user));
  const parentAccess = requireEditor(await requireFolderAccess(event, user, parentId));
  const existing = await database(event)
    .select()
    .from(driveFiles)
    .where(
      and(
        eq(driveFiles.drive_file_id, input.existingFileId ?? ''),
        eq(driveFiles.parent_drive_id, parentId),
        eq(driveFiles.trashed, 0)
      )
    )
    .get();
  if (input.conflictAction === 'overwrite' && !existing)
    badRequest('덮어쓸 기존 파일을 찾을 수 없습니다.');
  if (input.conflictAction === 'replace' && existing) {
    await trashDriveFile(event, existing.drive_file_id, true);
    await database(event)
      .update(driveFiles)
      .set({ trashed: 1, updated_at: now() })
      .where(eq(driveFiles.id, existing.id))
      .run();
  }
  const encryptedLocation = await createUploadSession(event, {
    name: input.name,
    mimeType: input.mimeType || 'application/octet-stream',
    size,
    parentId,
    overwriteFileId: input.conflictAction === 'overwrite' ? existing?.drive_file_id : undefined
  });
  const secret = event.platform?.env.APP_ENCRYPTION_KEY;
  if (!secret) throw new Error('APP_ENCRYPTION_KEY is not configured');
  const id = newId();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  await database(event)
    .insert(uploadSessions)
    .values({
      id,
      user_id: user.id,
      parent_drive_id: parentId,
      owner_user_id: parentAccess.ownerUserId,
      name: input.name.slice(0, 255),
      mime_type: input.mimeType || 'application/octet-stream',
      total_bytes: size,
      received_bytes: 0,
      drive_session_url: await encrypt(encryptedLocation.location, secret),
      drive_file_id:
        input.conflictAction === 'overwrite' ? (existing?.drive_file_id ?? null) : null,
      status: 'active',
      expires_at: expiresAt,
      created_at: now(),
      updated_at: now()
    })
    .run();
  return ok({ uploadId: id, chunkSize: 8 * 1024 * 1024, totalBytes: size }, { status: 201 });
};
