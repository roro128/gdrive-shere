export type TrashableFile = {
  id?: string;
  mimeType?: string;
  permission?: string;
  trashed?: boolean;
  isAdminSpace?: boolean;
  shared?: boolean;
  sharedByMe?: boolean;
  sharedRoot?: boolean;
};

export function canEditFileItem(
  file: Pick<TrashableFile, 'permission' | 'trashed' | 'isAdminSpace'>,
  googleConnected: boolean | undefined
) {
  return (
    googleConnected !== false && !file.isAdminSpace && file.permission !== 'viewer' && !file.trashed
  );
}

export function canTrashFileItem(file: TrashableFile) {
  if (file.isAdminSpace || file.trashed || file.permission === 'viewer') return false;
  if (file.sharedByMe || file.sharedRoot) return false;
  return true;
}
