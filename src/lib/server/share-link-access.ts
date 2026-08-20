import { and, eq, isNull } from 'drizzle-orm';
import { sha256 } from '$lib/server/crypto';
import { database } from '$lib/server/db';
import { driveFiles, shareLinks } from '$lib/server/drizzle/auth-schema';
import { notFound } from '$lib/server/http';
import type { RequestEvent } from '$lib/server/runtime';
import { isFolderMimeType } from '$lib/workspace-model';

export type PublicShareFile = {
  fileId: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
};

export async function resolvePublicShareFile(
  event: RequestEvent,
  token = event.params.token
): Promise<PublicShareFile> {
  const normalizedToken = token?.trim();
  if (!normalizedToken) notFound('공유 링크가 유효하지 않습니다.');

  const file = await database(event)
    .select({
      fileId: shareLinks.drive_file_id,
      name: driveFiles.name,
      mimeType: driveFiles.mime_type,
      sizeBytes: driveFiles.size_bytes,
      modifiedTime: driveFiles.updated_at
    })
    .from(shareLinks)
    .innerJoin(driveFiles, eq(driveFiles.drive_file_id, shareLinks.drive_file_id))
    .where(
      and(
        eq(shareLinks.token_hash, await sha256(normalizedToken)),
        isNull(shareLinks.revoked_at),
        eq(driveFiles.trashed, 0)
      )
    )
    .get();

  if (!file || isFolderMimeType(file.mimeType))
    notFound('공유 링크가 만료되었거나 해제되었습니다.');

  return {
    fileId: file.fileId,
    name: file.name,
    mimeType: file.mimeType,
    size: String(file.sizeBytes),
    modifiedTime: file.modifiedTime
  };
}
