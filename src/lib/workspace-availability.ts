export function canLoadWorkspaceFiles(
  googleConnected: boolean | undefined,
  mockMode: boolean,
  trash: boolean
): boolean {
  return mockMode || googleConnected !== false || trash;
}

export function canLoadStorageQuota(mockMode: boolean): boolean {
  return !mockMode;
}

export function isSharedFolderIndex(showShared: boolean, folderId: string | null): boolean {
  return showShared && folderId === null;
}

export type WorkspaceLoadSource = 'requests' | 'unavailable' | 'mock' | 'remote';

export function resolveWorkspaceLoadSource(context: {
  showRequests: boolean;
  googleConnected: boolean | undefined;
  mockMode: boolean;
  trash: boolean;
}): WorkspaceLoadSource {
  if (context.showRequests) return 'requests';
  if (!canLoadWorkspaceFiles(context.googleConnected, context.mockMode, context.trash))
    return 'unavailable';
  return context.mockMode ? 'mock' : 'remote';
}

export type WorkspaceEditContext = {
  googleConnected: boolean | undefined;
  trash: boolean;
  showRequests: boolean;
  showShared: boolean;
  folderId: string | null;
  currentFolderEditable: boolean;
  isAdmin: boolean;
  mockPermission: 'owner' | 'editor' | 'viewer';
};

export function canEditWorkspaceFolder(context: WorkspaceEditContext): boolean {
  if (
    context.googleConnected === false ||
    context.trash ||
    context.showRequests ||
    context.isAdmin ||
    context.mockPermission === 'viewer'
  )
    return false;

  if (context.showShared) return Boolean(context.folderId && context.currentFolderEditable);
  return !context.folderId || context.currentFolderEditable;
}

export type UploadAvailabilityContext = {
  trash: boolean;
  showRequests: boolean;
  isAdmin: boolean;
  showShared: boolean;
  targetParentId: string | null;
  currentFolderId: string | null;
  currentFolderEditable: boolean;
  targetFolderEditable?: boolean;
};

export function canUploadToWorkspace(context: UploadAvailabilityContext): boolean {
  if (context.trash || context.showRequests || context.isAdmin) return false;
  if (context.showShared && !context.targetParentId) return false;
  if (context.targetParentId === context.currentFolderId && !context.currentFolderEditable)
    return false;
  return context.targetFolderEditable !== false;
}
