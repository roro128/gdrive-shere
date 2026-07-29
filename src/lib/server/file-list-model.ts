import type { FolderSharePermission } from '../share-management';

export type TrashFileRow = {
  drive_file_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  parent_drive_id: string | null;
  trashed: number;
  updated_at: string;
  owner_name?: string | null;
};

export type ListedTrashFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  parents: string[];
  trashed: boolean;
  modifiedTime: string;
  ownerName?: string;
};

export type ListedDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: readonly string[];
  trashed?: boolean;
  modifiedTime?: string;
};

export type FileListMetadata = {
  id: string;
  uploadedBy?: string | null;
  uploadedAt?: string | null;
};

export type DriveFileSyncMetadata = {
  drive_file_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  parent_drive_id: string;
  owner_user_id: string;
  trashed: number;
};

export type DriveFileSyncRecord = DriveFileSyncMetadata & {
  id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DriveFileSyncOperation = {
  values: DriveFileSyncRecord;
  update: DriveFileSyncMetadata & { updated_at: string };
};

export type DriveFileSyncInput = {
  file: ListedDriveFile;
  id: string;
  createdAt: string;
};

export type DriveFileSyncRuntime = {
  newId: () => string;
  now: () => string;
};

export function buildDriveFileSyncInputs(
  files: readonly ListedDriveFile[],
  runtime: DriveFileSyncRuntime
): DriveFileSyncInput[] {
  return files.map((file) => ({ file, id: runtime.newId(), createdAt: runtime.now() }));
}

export function folderIdsForSharedLookup(files: readonly ListedDriveFile[]): string[] {
  return files
    .filter((file) => file.mimeType === 'application/vnd.google-apps.folder')
    .map((file) => file.id);
}

export function toDriveFileSyncMetadata(
  file: ListedDriveFile,
  parentId: string,
  ownerUserId: string
): DriveFileSyncMetadata {
  return {
    drive_file_id: file.id,
    name: file.name,
    mime_type: file.mimeType,
    size_bytes: Number(file.size ?? 0),
    parent_drive_id: file.parents?.[0] ?? parentId,
    owner_user_id: ownerUserId,
    trashed: file.trashed ? 1 : 0
  };
}

export function toDriveFileSyncRecord(
  file: ListedDriveFile,
  context: {
    parentId: string;
    ownerUserId: string;
    createdBy: string;
    id: string;
    createdAt: string;
  }
): DriveFileSyncRecord {
  const metadata = toDriveFileSyncMetadata(file, context.parentId, context.ownerUserId);
  return {
    id: context.id,
    ...metadata,
    created_by: context.createdBy,
    created_at: context.createdAt,
    updated_at: file.modifiedTime ?? context.createdAt
  };
}

export function toDriveFileSyncOperation(
  file: ListedDriveFile,
  context: {
    parentId: string;
    ownerUserId: string;
    createdBy: string;
    id: string;
    createdAt: string;
  }
): DriveFileSyncOperation {
  const values = toDriveFileSyncRecord(file, context);
  return {
    values,
    update: {
      drive_file_id: values.drive_file_id,
      name: values.name,
      mime_type: values.mime_type,
      size_bytes: values.size_bytes,
      parent_drive_id: values.parent_drive_id,
      owner_user_id: values.owner_user_id,
      trashed: values.trashed,
      updated_at: values.updated_at
    }
  };
}

export function buildDriveFileSyncOperations(
  inputs: readonly DriveFileSyncInput[],
  context: { parentId: string; ownerUserId: string; createdBy: string }
): DriveFileSyncOperation[] {
  return inputs.map(({ file, id, createdAt }) =>
    toDriveFileSyncOperation(file, { ...context, id, createdAt })
  );
}

export function mapTrashedFiles(
  rows: readonly TrashFileRow[],
  search: string,
  includeOwnerName: boolean
): ListedTrashFile[] {
  const normalizedSearch = search.trim().toLowerCase().slice(0, 100);
  return rows
    .filter((file) => !normalizedSearch || file.name.toLowerCase().includes(normalizedSearch))
    .map((file) => ({
      id: file.drive_file_id,
      name: file.name,
      mimeType: file.mime_type,
      size: String(file.size_bytes),
      parents: file.parent_drive_id ? [file.parent_drive_id] : [],
      trashed: Boolean(file.trashed),
      modifiedTime: file.updated_at,
      ...(includeOwnerName && file.owner_name ? { ownerName: file.owner_name } : {})
    }));
}

export function collectSharedFolderIds(
  shares: readonly { id: string }[],
  invitations: readonly { id: string }[]
): Set<string> {
  return new Set([...shares, ...invitations].map(({ id }) => id));
}

export function decorateListedFiles<T extends ListedDriveFile>(
  files: readonly T[],
  metadata: readonly FileListMetadata[],
  sharedFolderIds: ReadonlySet<string>,
  permission: FolderSharePermission,
  canShare: boolean
): Array<
  T & {
    uploadedBy?: string;
    uploadedAt?: string;
    shared: boolean;
    permission: FolderSharePermission;
    sharedRoot: boolean;
    sharedByMe: boolean;
    canShare: boolean;
  }
> {
  const metadataById = new Map(metadata.map((item) => [item.id, item]));
  return files.map((file) => {
    const fileMetadata = metadataById.get(file.id);
    const sharedRoot = sharedFolderIds.has(file.id);
    return {
      ...file,
      uploadedBy: fileMetadata?.uploadedBy ?? undefined,
      uploadedAt: fileMetadata?.uploadedAt ?? undefined,
      shared: permission === 'editor',
      permission,
      sharedRoot,
      sharedByMe: sharedRoot && permission === 'owner',
      canShare: canShare && file.mimeType === 'application/vnd.google-apps.folder'
    };
  });
}
