import type { RequestHandler } from '$lib/server/runtime';
import { driveFiles, uploadSessions } from '$lib/server/drizzle/auth-schema';
import { and, eq, not, sql } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database, newId, now } from '$lib/server/db';
import { createUploadSession, trashDriveFile } from '$lib/server/google';
import { assertSameOrigin, badRequest, forbidden, readJson, ok } from '$lib/server/http';
import { encrypt } from '$lib/server/crypto';
import { ensureUserSpace, requireEditor, requireFolderAccess } from '$lib/server/space-access';
import {
  buildActiveUploadSessionRecord,
  normalizeUploadSessionInput,
  shouldRejectMissingOverwrite,
  shouldReplaceExisting
} from '$lib/server/upload-session-model';
import { toTrashStateUpdate } from '$lib/file-update-model';

export const POST: RequestHandler = async (event) => {
  const user = await requireUser(event);
  if (user.role === 'admin') forbidden('관리자는 파일을 직접 업로드할 수 없습니다.');
  assertSameOrigin(event.request, event.url.origin);
  const input = normalizeUploadSessionInput(await readJson(event.request));
  if (!input) badRequest('파일 이름과 유효한 파일 크기가 필요합니다.');
  const size = input.size;
  const parentId = input.parentId ?? (await ensureUserSpace(event, user));
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
  const duplicate = await database(event)
    .select({
      drive_file_id: driveFiles.drive_file_id,
      name: driveFiles.name,
      mime_type: driveFiles.mime_type
    })
    .from(driveFiles)
    .where(
      and(
        eq(driveFiles.parent_drive_id, parentId),
        eq(driveFiles.trashed, 0),
        not(eq(driveFiles.mime_type, 'application/vnd.google-apps.folder')),
        sql`lower(${driveFiles.name}) = ${input.name.toLocaleLowerCase()}`
      )
    )
    .get();
  if (duplicate && (!input.conflictAction || duplicate.drive_file_id !== input.existingFileId)) {
    return Response.json(
      {
        message: '같은 이름의 파일이 이미 있습니다.',
        conflict: {
          existingFileId: duplicate.drive_file_id,
          existingName: duplicate.name,
          existingMimeType: duplicate.mime_type
        }
      },
      { status: 409 }
    );
  }
  if (input.conflictAction && (!duplicate || duplicate.drive_file_id !== existing?.drive_file_id))
    badRequest('충돌하는 기존 파일을 확인할 수 없습니다. 다시 시도해주세요.');
  if (shouldRejectMissingOverwrite(input.conflictAction, existing?.drive_file_id))
    badRequest('덮어쓸 기존 파일을 찾을 수 없습니다.');
  if (shouldReplaceExisting(input.conflictAction, existing?.drive_file_id) && existing) {
    await trashDriveFile(event, existing.drive_file_id, true);
    await database(event)
      .update(driveFiles)
      .set(toTrashStateUpdate(true, now()))
      .where(eq(driveFiles.id, existing.id))
      .run();
  }
  const encryptedLocation = await createUploadSession(event, {
    name: input.name,
    mimeType: input.mimeType,
    size,
    parentId,
    overwriteFileId: input.conflictAction === 'overwrite' ? existing?.drive_file_id : undefined
  });
  const secret = event.platform?.env.APP_ENCRYPTION_KEY;
  if (!secret) throw new Error('APP_ENCRYPTION_KEY is not configured');
  const record = buildActiveUploadSessionRecord(
    {
      userId: user.id,
      parentId,
      ownerUserId: parentAccess.ownerUserId,
      name: input.name,
      mimeType: input.mimeType,
      totalBytes: size,
      driveSessionUrl: await encrypt(encryptedLocation.location, secret),
      driveFileId: input.conflictAction === 'overwrite' ? (existing?.drive_file_id ?? null) : null,
      ttlMs: 1000 * 60 * 60 * 24 * 7
    },
    { now, newId }
  );
  await database(event).insert(uploadSessions).values(record).run();
  return ok({ uploadId: record.id, chunkSize: 8 * 1024 * 1024, totalBytes: size }, { status: 201 });
};
