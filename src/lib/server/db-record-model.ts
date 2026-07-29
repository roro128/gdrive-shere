export function toSettingRecord(input: { key: string; value: string; updatedAt: string }) {
  return { key: input.key, value: input.value, updated_at: input.updatedAt };
}

export function toSettingUpdate(input: { value: string; updatedAt: string }) {
  return { value: input.value, updated_at: input.updatedAt };
}

export function toAuditEventRecord(input: {
  id: string;
  userId: string | null;
  action: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}) {
  return {
    id: input.id,
    user_id: input.userId,
    action: input.action,
    target_id: input.targetId,
    metadata: JSON.stringify(input.metadata),
    created_at: input.createdAt
  };
}

export function toUserSpaceCreationRecords(input: {
  fileRowId: string;
  driveFileId: string;
  name: string;
  mimeType: string;
  parentDriveId: string;
  userId: string;
  createdAt: string;
}) {
  return {
    driveFile: {
      id: input.fileRowId,
      drive_file_id: input.driveFileId,
      name: input.name,
      mime_type: input.mimeType,
      size_bytes: 0,
      parent_drive_id: input.parentDriveId,
      created_by: input.userId,
      owner_user_id: input.userId,
      trashed: 0,
      created_at: input.createdAt,
      updated_at: input.createdAt
    },
    userSpace: {
      user_id: input.userId,
      root_drive_id: input.driveFileId,
      created_at: input.createdAt
    }
  };
}

export type DbRecordRuntime = {
  now: () => string;
  newId: () => string;
};

export function buildUserSpaceCreationRecords(
  input: Omit<Parameters<typeof toUserSpaceCreationRecords>[0], 'fileRowId' | 'createdAt'>,
  runtime: DbRecordRuntime
) {
  return toUserSpaceCreationRecords({
    ...input,
    fileRowId: runtime.newId(),
    createdAt: runtime.now()
  });
}
