export type WorkspaceSortKey = 'name' | 'modifiedTime' | 'size';
export type WorkspaceView = 'root' | 'shared' | 'requests' | 'trash';

export type WorkspaceFileModel = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
};

export type WorkspaceLoadContext = {
  folderId: string | null;
  trash: boolean;
  search: string;
  showShared: boolean;
  isAdmin: boolean;
};

export type WorkspaceCacheContext = Omit<WorkspaceLoadContext, 'isAdmin'> & {
  showRequests: boolean;
};

export type UploadProgressModel = {
  status: string;
  progress: number;
};

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const PREVIEWABLE_FILE_KINDS = new Set(['video', 'image', 'audio', 'pdf', 'text']);

export function buildWorkspaceRequest(context: WorkspaceLoadContext): string {
  if (context.showShared && !context.folderId) return '/api/shares';
  if (context.isAdmin && !context.folderId && !context.trash) return '/api/admin/spaces';

  const query = new URLSearchParams({
    ...(context.folderId ? { parentId: context.folderId } : {}),
    ...(context.trash ? { trash: '1' } : {}),
    ...(context.search ? { search: context.search } : {})
  });
  const suffix = query.toString();
  return `/api/files${suffix ? `?${suffix}` : ''}`;
}

export function buildWorkspaceCacheKey(context: WorkspaceCacheContext): string {
  return [
    context.folderId ?? 'root',
    context.trash ? 'trash' : 'active',
    context.showShared ? 'shared' : 'private',
    context.showRequests ? 'requests' : 'files',
    encodeURIComponent(context.search)
  ].join('|');
}

export function isFolderMimeType(mimeType: string): boolean {
  return mimeType === FOLDER_MIME_TYPE;
}

function comparableValue(file: WorkspaceFileModel, sortBy: WorkspaceSortKey): number | string {
  if (sortBy === 'size') {
    const size = Number(file.size ?? 0);
    return Number.isFinite(size) ? size : 0;
  }
  if (sortBy === 'modifiedTime') return file.modifiedTime ?? '';
  return file.name.toLocaleLowerCase();
}

function compareValues(left: number | string, right: number | string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortWorkspaceFiles<T extends WorkspaceFileModel>(
  files: readonly T[],
  sortBy: WorkspaceSortKey,
  descending: boolean
): T[] {
  return files
    .map((file, originalIndex) => ({
      file,
      originalIndex,
      isFolder: isFolderMimeType(file.mimeType),
      value: comparableValue(file, sortBy)
    }))
    .sort((left, right) => {
      const folderOrder = Number(right.isFolder) - Number(left.isFolder);
      if (folderOrder) return folderOrder;

      const comparison = compareValues(left.value, right.value);
      return (descending ? -comparison : comparison) || left.originalIndex - right.originalIndex;
    })
    .map(({ file }) => file);
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

function partitionByMembership<T>(
  items: readonly T[],
  memberIds: ReadonlySet<string>,
  getId: (item: T) => string
): [T[], T[]] {
  const members: T[] = [];
  const nonMembers: T[] = [];
  for (const item of items) {
    (memberIds.has(getId(item)) ? members : nonMembers).push(item);
  }
  return [members, nonMembers];
}

export function summarizeActiveUploads(uploads: readonly UploadProgressModel[]) {
  const active = uploads.filter((upload) => upload.status === 'uploading');
  if (!active.length) return { count: 0, progress: 0 };
  const total = active.reduce((sum, upload) => sum + clampProgress(upload.progress), 0);
  return { count: active.length, progress: Math.round(total / active.length) };
}

export function deriveWorkspaceCollections<
  TFile extends WorkspaceFileModel,
  TUpload extends UploadProgressModel,
  TMember extends { id: string }
>(input: {
  files: readonly TFile[];
  selectedIds: ReadonlySet<string>;
  sortBy: WorkspaceSortKey;
  descending: boolean;
  uploads: readonly TUpload[];
  shareMembers: readonly TMember[];
  sharedMemberIds: ReadonlySet<string>;
}) {
  const visibleFiles = sortWorkspaceFiles(input.files, input.sortBy, input.descending);
  const selectedFiles = visibleFiles.filter((file) => input.selectedIds.has(file.id));
  const activeUploads = input.uploads.filter((upload) => upload.status === 'uploading');
  const uploadSummary = summarizeActiveUploads(input.uploads);
  const [currentShareMembers, availableShareMembers] = partitionByMembership(
    input.shareMembers,
    input.sharedMemberIds,
    (member) => member.id
  );

  return {
    visibleFiles,
    selectedFiles,
    activeUploads,
    uploadProgress: uploadSummary.progress,
    currentShareMembers,
    availableShareMembers
  };
}

export function updatePendingIds(
  currentIds: ReadonlySet<string>,
  changedIds: readonly string[],
  operation: 'add' | 'remove'
): Set<string> {
  if (operation === 'add') return new Set([...currentIds, ...changedIds]);

  const changedIdSet = new Set(changedIds);
  return new Set([...currentIds].filter((id) => !changedIdSet.has(id)));
}

export function getFileKind(mimeType: string) {
  if (isFolderMimeType(mimeType)) return 'folder';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';
  return 'file';
}

export function isPreviewableFile(mimeType: string): boolean {
  return PREVIEWABLE_FILE_KINDS.has(getFileKind(mimeType));
}

export function formatBytes(value?: string): string {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function storagePercent(quota: { usage: number; limit: number | null }): number {
  if (!quota.limit || !Number.isFinite(quota.limit) || !Number.isFinite(quota.usage)) return 0;
  return Math.min(100, Math.max(0, (quota.usage / quota.limit) * 100));
}

export function getWorkspaceViewFlags(view: WorkspaceView) {
  return {
    showShared: view === 'shared',
    showRequests: view === 'requests',
    trash: view === 'trash'
  };
}

type MoveResultModel = {
  moved: readonly { name: string }[];
  failed: readonly { file: { name: string }; message: string }[];
};

export function describeMoveResult(result: MoveResultModel, targetName: string): string {
  if (!result.moved.length && !result.failed.length) return '';
  if (result.failed.length) {
    const failures = result.failed.map(({ file, message }) => `${file.name}: ${message}`).join(' ');
    return `${result.moved.length}개 이동 완료 · ${failures}`;
  }
  return `${result.moved.length}개 항목을 “${targetName}” 폴더로 이동했습니다.`;
}
