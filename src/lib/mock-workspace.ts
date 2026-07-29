import {
  createFolder,
  createInitialMockWorkspace,
  getFolderShares,
  listFiles,
  listShareUsers,
  listSharedFolders,
  moveFile,
  permanentlyDeleteFile,
  renameFile,
  restoreFile,
  saveFolderShares,
  trashFile,
  uploadFile,
  type MockShareGrant,
  type MockShareUser,
  type MockWorkspaceFile,
  type MockWorkspaceState
} from './mock-workspace-model';

export type { MockShareGrant, MockShareUser, MockWorkspaceFile } from './mock-workspace-model';

const response = (result: { status: number; value?: unknown; message?: string }): Response => {
  if (result.status >= 400) return new Response(result.message, { status: result.status });
  return result.value === undefined
    ? new Response(null, { status: result.status })
    : Response.json(result.value);
};

export type MockWorkspaceRuntime = {
  now: () => string;
  newId: (prefix: string) => string;
};

export type MockWorkspaceAdapter = {
  reset(): void;
  listFiles(parentId: string | null, search?: string, includeTrash?: boolean): MockWorkspaceFile[];
  trashFile(fileId: string): Promise<Response>;
  restoreFile(fileId: string): Promise<Response>;
  permanentlyDeleteFile(fileId: string): Promise<Response>;
  moveFile(fileId: string, targetParentId: string): Promise<Response>;
  createFolder(name: string, parentId: string | null): Promise<Response>;
  renameFile(fileId: string, name: string): Promise<Response>;
  uploadFile(
    name: string,
    mimeType: string,
    size: number,
    parentId: string | null,
    conflictAction?: 'replace' | 'overwrite',
    existingFileId?: string
  ): Promise<Response>;
  listShareUsers(): MockShareUser[];
  getFolderShares(folderId: string): MockShareGrant[];
  listSharedFolders(): MockWorkspaceFile[];
  saveFolderShares(folderId: string, grants: readonly MockShareGrant[]): Promise<Response>;
};

export function createMockWorkspaceAdapter(
  runtime: MockWorkspaceRuntime = {
    now: () => new Date().toISOString(),
    newId: (prefix) => `${prefix}-${crypto.randomUUID()}`
  }
): MockWorkspaceAdapter {
  let state: MockWorkspaceState = createInitialMockWorkspace();

  const apply = <T>(result: {
    state: MockWorkspaceState;
    status: number;
    value?: T;
    message?: string;
  }) => {
    state = result.state;
    return result;
  };

  return {
    reset() {
      state = createInitialMockWorkspace();
    },
    listFiles(parentId, search = '', includeTrash = false) {
      return listFiles(state, parentId, search, includeTrash);
    },
    async trashFile(fileId) {
      return response(apply(trashFile(state, fileId, runtime.now())));
    },
    async restoreFile(fileId) {
      return response(apply(restoreFile(state, fileId, runtime.now())));
    },
    async permanentlyDeleteFile(fileId) {
      return response(apply(permanentlyDeleteFile(state, fileId)));
    },
    async moveFile(fileId, targetParentId) {
      return response(apply(moveFile(state, fileId, targetParentId, runtime.now())));
    },
    async createFolder(name, parentId) {
      const result = apply(
        createFolder(state, name, parentId, runtime.newId('mock-folder'), runtime.now())
      );
      return response(
        result && result.value ? { ...result, value: { file: result.value } } : result
      );
    },
    async renameFile(fileId, name) {
      const result = apply(renameFile(state, fileId, name, runtime.now()));
      return response(
        result && result.value ? { ...result, value: { file: result.value } } : result
      );
    },
    async uploadFile(name, mimeType, size, parentId, conflictAction, existingFileId) {
      const result = apply(
        uploadFile(
          state,
          name,
          mimeType,
          size,
          parentId,
          runtime.newId('mock-upload'),
          runtime.now(),
          conflictAction,
          existingFileId
        )
      );
      return response(
        result && result.value ? { ...result, value: { file: result.value } } : result
      );
    },
    listShareUsers() {
      return listShareUsers();
    },
    getFolderShares(folderId) {
      return getFolderShares(state, folderId);
    },
    listSharedFolders() {
      return listSharedFolders(state);
    },
    async saveFolderShares(folderId, grants) {
      const result = apply(saveFolderShares(state, folderId, grants));
      return response(
        result && result.value ? { ...result, value: { shares: result.value } } : result
      );
    }
  };
}

const defaultAdapter = createMockWorkspaceAdapter();

export function isMockWorkspace(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mock') === '1'
  );
}

export function resetMockWorkspace(): void {
  defaultAdapter.reset();
}

export function listMockFiles(
  parentId: string | null,
  search = '',
  includeTrash = false
): MockWorkspaceFile[] {
  return defaultAdapter.listFiles(parentId, search, includeTrash);
}

export async function trashMockFile(fileId: string): Promise<Response> {
  return defaultAdapter.trashFile(fileId);
}

export async function restoreMockFile(fileId: string): Promise<Response> {
  return defaultAdapter.restoreFile(fileId);
}

export async function permanentlyDeleteMockFile(fileId: string): Promise<Response> {
  return defaultAdapter.permanentlyDeleteFile(fileId);
}

export async function moveMockFile(fileId: string, targetParentId: string): Promise<Response> {
  return defaultAdapter.moveFile(fileId, targetParentId);
}

export async function createMockFolder(name: string, parentId: string | null): Promise<Response> {
  return defaultAdapter.createFolder(name, parentId);
}

export async function renameMockFile(fileId: string, name: string): Promise<Response> {
  return defaultAdapter.renameFile(fileId, name);
}

export async function uploadMockFile(
  name: string,
  mimeType: string,
  size: number,
  parentId: string | null,
  conflictAction?: 'replace' | 'overwrite',
  existingFileId?: string
): Promise<Response> {
  return defaultAdapter.uploadFile(name, mimeType, size, parentId, conflictAction, existingFileId);
}

export function listMockShareUsers(): MockShareUser[] {
  return defaultAdapter.listShareUsers();
}

export function getMockFolderShares(folderId: string): MockShareGrant[] {
  return defaultAdapter.getFolderShares(folderId);
}

export function listMockSharedFolders(): MockWorkspaceFile[] {
  return defaultAdapter.listSharedFolders();
}

export async function saveMockFolderShares(
  folderId: string,
  grants: readonly MockShareGrant[]
): Promise<Response> {
  return defaultAdapter.saveFolderShares(folderId, grants);
}
