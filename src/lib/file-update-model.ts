export type FileUpdateInput = {
  name?: string;
  parentId?: string;
};

export type UpdatedDriveFile = {
  name: string;
  parents?: readonly string[];
};

export function hasFileUpdate(input: FileUpdateInput): boolean {
  return Boolean(input.name || input.parentId);
}

export function isSelfParent(fileId: string, parentId: string): boolean {
  return fileId === parentId;
}

export function isCrossSpaceMove(sourceOwnerId: string, targetOwnerId: string): boolean {
  return sourceOwnerId !== targetOwnerId;
}

export function buildStoredFileUpdate(
  updated: UpdatedDriveFile,
  fallbackParentId: string | null,
  updatedAt: string
) {
  return {
    name: updated.name,
    parent_drive_id: updated.parents?.[0] ?? fallbackParentId,
    updated_at: updatedAt
  };
}

export function toTrashStateUpdate(trashed: boolean, updatedAt: string) {
  return { trashed: trashed ? 1 : 0, updated_at: updatedAt };
}
