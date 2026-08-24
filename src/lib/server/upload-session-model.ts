import {
  toDriveFileSyncOperation,
  type DriveFileSyncOperation,
  type ListedDriveFile
} from './file-list-model';

export type UploadSessionInput = {
  name?: string;
  mimeType?: string;
  size?: number;
  parentId?: string | null;
  conflictAction?: 'replace' | 'overwrite';
  existingFileId?: string;
};

export type NormalizedUploadSessionInput = {
  name: string;
  mimeType: string;
  size: number;
  parentId: string | null;
  conflictAction?: 'replace' | 'overwrite';
  existingFileId?: string;
};

export type UploadSessionRuntime = {
  now: () => string;
  newId: () => string;
};

export function isActiveUploadSession(
  status: string,
  expiresAt: string,
  currentTime: string
): boolean {
  return status === 'active' && expiresAt > currentTime;
}

export function normalizeUploadSessionInput(input: unknown): NormalizedUploadSessionInput | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const candidate = input as UploadSessionInput;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (
    !name ||
    typeof candidate.size !== 'number' ||
    !Number.isSafeInteger(candidate.size) ||
    candidate.size < 0 ||
    (candidate.mimeType !== undefined && typeof candidate.mimeType !== 'string') ||
    (candidate.parentId !== undefined &&
      candidate.parentId !== null &&
      typeof candidate.parentId !== 'string') ||
    (candidate.conflictAction !== undefined &&
      candidate.conflictAction !== 'replace' &&
      candidate.conflictAction !== 'overwrite') ||
    (candidate.existingFileId !== undefined && typeof candidate.existingFileId !== 'string')
  )
    return null;

  return {
    name,
    mimeType: candidate.mimeType?.trim() || 'application/octet-stream',
    size: candidate.size,
    parentId: candidate.parentId?.trim() || null,
    conflictAction: candidate.conflictAction,
    existingFileId: candidate.existingFileId?.trim() || undefined
  };
}

export function shouldRejectMissingOverwrite(
  conflictAction: NormalizedUploadSessionInput['conflictAction'],
  existingFileId: string | null | undefined
): boolean {
  return conflictAction === 'overwrite' && !existingFileId;
}

export function shouldReplaceExisting(
  conflictAction: NormalizedUploadSessionInput['conflictAction'],
  existingFileId: string | null | undefined
): boolean {
  return conflictAction === 'replace' && Boolean(existingFileId);
}

export function toActiveUploadSessionRecord(input: {
  id: string;
  userId: string;
  parentId: string;
  ownerUserId: string;
  name: string;
  mimeType: string;
  totalBytes: number;
  driveSessionUrl: string;
  driveFileId: string | null;
  expiresAt: string;
  createdAt: string;
}) {
  return {
    id: input.id,
    user_id: input.userId,
    parent_drive_id: input.parentId,
    owner_user_id: input.ownerUserId,
    name: input.name.slice(0, 255),
    mime_type: input.mimeType,
    total_bytes: input.totalBytes,
    received_bytes: 0,
    drive_session_url: input.driveSessionUrl,
    drive_file_id: input.driveFileId,
    status: 'active' as const,
    expires_at: input.expiresAt,
    created_at: input.createdAt,
    updated_at: input.createdAt
  };
}

export function buildActiveUploadSessionRecord(
  input: Omit<
    Parameters<typeof toActiveUploadSessionRecord>[0],
    'id' | 'expiresAt' | 'createdAt'
  > & {
    ttlMs: number;
  },
  runtime: UploadSessionRuntime
) {
  const createdAt = runtime.now();
  return toActiveUploadSessionRecord({
    ...input,
    id: runtime.newId(),
    expiresAt: new Date(Date.parse(createdAt) + input.ttlMs).toISOString(),
    createdAt
  });
}

export function isCompletedUploadResponse(status: number): boolean {
  return status === 200 || status === 201;
}

export function toUploadProgressUpdate(receivedBytes: number, updatedAt: string) {
  return {
    received_bytes: Number.isFinite(receivedBytes) ? Math.max(0, receivedBytes) : 0,
    updated_at: updatedAt
  };
}

export function toCancelledUploadUpdate(updatedAt: string) {
  return {
    status: 'cancelled' as const,
    updated_at: updatedAt
  };
}

export type CompletedUploadPersistence = {
  session: {
    drive_file_id: string;
    received_bytes: number;
    status: 'complete';
    updated_at: string;
  };
  file: DriveFileSyncOperation;
};

export function toCompletedUploadPersistence(
  file: ListedDriveFile,
  context: {
    parentId: string;
    userId: string;
    ownerUserId: string;
    rowId: string;
    totalBytes: number;
    completedAt: string;
  }
): CompletedUploadPersistence {
  const normalizedFile: ListedDriveFile = {
    ...file,
    size: file.size ?? String(context.totalBytes)
  };
  return {
    session: {
      drive_file_id: normalizedFile.id,
      received_bytes: context.totalBytes,
      status: 'complete',
      updated_at: context.completedAt
    },
    file: toDriveFileSyncOperation(normalizedFile, {
      parentId: context.parentId,
      ownerUserId: context.ownerUserId,
      createdBy: context.userId,
      id: context.rowId,
      createdAt: context.completedAt
    })
  };
}

export function buildCompletedUploadPersistence(
  file: ListedDriveFile,
  context: Omit<Parameters<typeof toCompletedUploadPersistence>[1], 'rowId' | 'completedAt'>,
  runtime: UploadSessionRuntime
): CompletedUploadPersistence {
  const completedAt = runtime.now();
  return toCompletedUploadPersistence(file, {
    ...context,
    rowId: runtime.newId(),
    completedAt
  });
}

export function resolveReceivedBytes(
  upstreamReceivedBytes: number | null,
  requestedEndByte: number | null,
  fallbackBytes: number
): number {
  const fallback =
    requestedEndByte === null || !Number.isFinite(requestedEndByte)
      ? fallbackBytes
      : requestedEndByte + 1;
  const received =
    upstreamReceivedBytes === null || !Number.isFinite(upstreamReceivedBytes)
      ? fallback
      : upstreamReceivedBytes;
  return Number.isFinite(received) ? Math.max(0, received) : 0;
}
