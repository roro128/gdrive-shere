const MOCK_SPACE_ID = 'mock-space';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type MockWorkspaceFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents: string[];
  modifiedTime: string;
  trashed?: boolean;
};

export type MockShareUser = {
  id: string;
  displayName: string;
  handle: string;
  permission?: 'viewer' | 'editor';
};

export type MockShareGrant = {
  userId: string;
  permission: 'viewer' | 'editor';
};

export type MockWorkspaceState = {
  files: readonly MockWorkspaceFile[];
  folderShares: ReadonlyMap<string, readonly MockShareGrant[]>;
};

export type MockFilePresentationContext = {
  permission: 'owner' | 'editor' | 'viewer';
  isAdmin: boolean;
  showShared: boolean;
};

export type MockOperationResult<T = undefined> = {
  state: MockWorkspaceState;
  status: number;
  value?: T;
  message?: string;
};

const shareUsers: readonly MockShareUser[] = [
  { id: 'mock-member-1', displayName: 'Mock 멤버', handle: 'member' },
  { id: 'mock-member-2', displayName: 'Mock 협업자', handle: 'collaborator' }
];
const shareUserById = new Map(shareUsers.map((user) => [user.id, user]));

const cloneFile = (file: MockWorkspaceFile): MockWorkspaceFile => ({
  ...file,
  parents: [...file.parents]
});

const cloneGrant = (grant: MockShareGrant): MockShareGrant => ({ ...grant });

const cloneState = (state: MockWorkspaceState): MockWorkspaceState => ({
  files: state.files.map(cloneFile),
  folderShares: new Map(
    [...state.folderShares].map(([folderId, grants]) => [folderId, grants.map(cloneGrant)])
  )
});

const success = <T>(state: MockWorkspaceState, value?: T): MockOperationResult<T> => ({
  state,
  status: 200,
  ...(value === undefined ? {} : { value })
});

const failure = <T = never>(
  state: MockWorkspaceState,
  status: number,
  message: string
): MockOperationResult<T> => ({ state, status, message });

const fileById = (state: MockWorkspaceState, fileId: string) =>
  state.files.find((file) => file.id === fileId);

const isActiveFolder = (state: MockWorkspaceState, folderId: string): boolean =>
  folderId === MOCK_SPACE_ID ||
  state.files.some(
    (file) => file.id === folderId && file.mimeType === FOLDER_MIME && !file.trashed
  );

const sameName = (left: string, right: string): boolean =>
  left.toLocaleLowerCase() === right.toLocaleLowerCase();

const isValidShareGrant = (grant: MockShareGrant): boolean =>
  shareUserById.has(grant.userId) && ['viewer', 'editor'].includes(grant.permission);

const replaceFile = (
  state: MockWorkspaceState,
  fileId: string,
  update: (file: MockWorkspaceFile) => MockWorkspaceFile
): MockWorkspaceState => ({
  ...state,
  files: state.files.map((file) => (file.id === fileId ? update(cloneFile(file)) : cloneFile(file)))
});

const removeShares = (
  shares: ReadonlyMap<string, readonly MockShareGrant[]>,
  ids: ReadonlySet<string>
): ReadonlyMap<string, readonly MockShareGrant[]> =>
  new Map([...shares].filter(([folderId]) => !ids.has(folderId)));

const descendantsOf = (
  files: readonly MockWorkspaceFile[],
  rootId: string
): ReadonlySet<string> => {
  const childrenByParent = files.reduce((children, file) => {
    const parentId = file.parents[0];
    if (!parentId) return children;
    return new Map(children).set(parentId, [...(children.get(parentId) ?? []), file.id]);
  }, new Map<string, string[]>());

  const collect = (parentId: string, visited: ReadonlySet<string>): Set<string> =>
    (childrenByParent.get(parentId) ?? []).reduce((ids, childId) => {
      if (visited.has(childId)) return ids;
      const nextVisited = new Set([...visited, childId]);
      return new Set([...ids, childId, ...collect(childId, nextVisited)]);
    }, new Set<string>());

  return collect(rootId, new Set([rootId]));
};

const hasAncestor = (
  files: readonly MockWorkspaceFile[],
  startId: string,
  ancestorId: string,
  visited = new Set<string>()
): boolean => {
  if (startId === ancestorId) return true;
  if (startId === MOCK_SPACE_ID || visited.has(startId)) return false;
  const parentId = files.find((file) => file.id === startId)?.parents[0];
  return parentId
    ? hasAncestor(files, parentId, ancestorId, new Set([...visited, startId]))
    : false;
};

export function createInitialMockWorkspace(): MockWorkspaceState {
  return {
    files: [
      {
        id: 'mock-folder-a',
        name: '하위 폴더 A',
        mimeType: FOLDER_MIME,
        parents: [MOCK_SPACE_ID],
        modifiedTime: '2026-07-27T00:00:00.000Z'
      },
      {
        id: 'mock-folder-b',
        name: '하위 폴더 B',
        mimeType: FOLDER_MIME,
        parents: [MOCK_SPACE_ID],
        modifiedTime: '2026-07-27T00:00:00.000Z'
      },
      {
        id: 'mock-file-root',
        name: '업로드 완료 파일.mp4',
        mimeType: 'video/mp4',
        size: '3584000',
        parents: [MOCK_SPACE_ID],
        modifiedTime: '2026-07-27T00:00:00.000Z'
      },
      {
        id: 'mock-file-nested',
        name: '하위 폴더 파일.mp4',
        mimeType: 'video/mp4',
        size: '10485760',
        parents: ['mock-folder-a'],
        modifiedTime: '2026-07-27T00:00:00.000Z'
      }
    ],
    folderShares: new Map()
  };
}

export function listFiles(
  state: MockWorkspaceState,
  parentId: string | null,
  search = '',
  includeTrash = false
): MockWorkspaceFile[] {
  const query = search.trim().toLowerCase();
  return state.files
    .filter(
      (file) =>
        (file.trashed ?? false) === includeTrash &&
        (includeTrash || file.parents[0] === (parentId || MOCK_SPACE_ID)) &&
        (!query || file.name.toLowerCase().includes(query))
    )
    .map(cloneFile);
}

export function trashFile(
  state: MockWorkspaceState,
  fileId: string,
  modifiedTime: string
): MockOperationResult {
  const file = fileById(state, fileId);
  if (!file) return failure(state, 404, '파일을 찾을 수 없습니다.');
  if (file.mimeType === FOLDER_MIME && state.folderShares.has(file.id))
    return failure(state, 403, '공유를 해제한 뒤 폴더를 삭제할 수 있습니다.');
  return success(
    replaceFile(state, fileId, (current) => ({ ...current, trashed: true, modifiedTime }))
  );
}

export function restoreFile(
  state: MockWorkspaceState,
  fileId: string,
  modifiedTime: string
): MockOperationResult {
  if (!fileById(state, fileId)) return failure(state, 404, '파일을 찾을 수 없습니다.');
  return success(replaceFile(state, fileId, (file) => ({ ...file, trashed: false, modifiedTime })));
}

export function permanentlyDeleteFile(
  state: MockWorkspaceState,
  fileId: string
): MockOperationResult {
  const file = fileById(state, fileId);
  if (!file || !file.trashed)
    return failure(state, 400, '휴지통에 있는 파일만 삭제할 수 있습니다.');
  const deletedIds = new Set([fileId, ...descendantsOf(state.files, fileId)]);
  return success({
    files: state.files.filter((item) => !deletedIds.has(item.id)).map(cloneFile),
    folderShares: removeShares(state.folderShares, deletedIds)
  });
}

export function moveFile(
  state: MockWorkspaceState,
  fileId: string,
  targetParentId: string,
  modifiedTime: string
): MockOperationResult {
  const file = fileById(state, fileId);
  if (!file || file.trashed || !isActiveFolder(state, targetParentId))
    return failure(state, 404, '대상 폴더를 찾을 수 없습니다.');
  if (file.id === targetParentId) return failure(state, 400, '파일 자신을 이동할 수 없습니다.');
  if (file.parents[0] === targetParentId) return success(cloneState(state));
  if (file.mimeType === FOLDER_MIME && hasAncestor(state.files, targetParentId, file.id))
    return failure(state, 400, '폴더를 하위 폴더 안으로 이동할 수 없습니다.');
  if (
    file.mimeType === FOLDER_MIME &&
    state.files.some(
      (item) =>
        item.id !== fileId &&
        !item.trashed &&
        item.parents[0] === targetParentId &&
        sameName(item.name, file.name)
    )
  )
    return failure(state, 409, '같은 이름의 항목이 이미 있습니다.');
  return success(
    replaceFile(state, fileId, (current) => ({
      ...current,
      parents: [targetParentId],
      modifiedTime
    }))
  );
}

export function createFolder(
  state: MockWorkspaceState,
  name: string,
  parentId: string | null,
  id: string,
  modifiedTime: string
): MockOperationResult<MockWorkspaceFile> {
  const parent = parentId || MOCK_SPACE_ID;
  const trimmedName = name.trim();
  if (!isActiveFolder(state, parent))
    return failure<MockWorkspaceFile>(state, 404, '대상 폴더를 찾을 수 없습니다.');
  if (
    state.files.some(
      (file) => !file.trashed && file.parents[0] === parent && sameName(file.name, trimmedName)
    )
  )
    return failure<MockWorkspaceFile>(state, 409, '같은 이름의 항목이 이미 있습니다.');
  const folder: MockWorkspaceFile = {
    id,
    name: trimmedName,
    mimeType: FOLDER_MIME,
    parents: [parent],
    modifiedTime
  };
  return success({ ...state, files: [...state.files.map(cloneFile), folder] }, cloneFile(folder));
}

export function renameFile(
  state: MockWorkspaceState,
  fileId: string,
  name: string,
  modifiedTime: string
): MockOperationResult<MockWorkspaceFile> {
  const file = fileById(state, fileId);
  if (!file || file.trashed)
    return failure<MockWorkspaceFile>(state, 404, '파일을 찾을 수 없습니다.');
  const trimmedName = name.trim();
  if (!trimmedName) return failure<MockWorkspaceFile>(state, 400, '이름을 입력해주세요.');
  if (
    state.files.some(
      (item) =>
        item.id !== fileId &&
        !item.trashed &&
        item.parents[0] === file.parents[0] &&
        sameName(item.name, trimmedName)
    )
  )
    return failure<MockWorkspaceFile>(state, 409, '같은 이름의 항목이 이미 있습니다.');
  const nextState = replaceFile(state, fileId, (current) => ({
    ...current,
    name: trimmedName,
    modifiedTime
  }));
  return success(nextState, cloneFile(fileById(nextState, fileId)!));
}

export function uploadFile(
  state: MockWorkspaceState,
  name: string,
  mimeType: string,
  size: number,
  parentId: string | null,
  id: string,
  modifiedTime: string,
  conflictAction?: 'replace' | 'overwrite',
  existingFileId?: string
): MockOperationResult<MockWorkspaceFile> {
  const parent = parentId || MOCK_SPACE_ID;
  if (!isActiveFolder(state, parent))
    return failure<MockWorkspaceFile>(state, 404, '대상 폴더를 찾을 수 없습니다.');
  const duplicate = state.files.find(
    (file) => !file.trashed && file.parents[0] === parent && sameName(file.name, name)
  );
  if (duplicate && (duplicate.id !== existingFileId || !conflictAction))
    return failure<MockWorkspaceFile>(state, 409, '같은 이름의 파일이 이미 있습니다.');
  if (duplicate && conflictAction === 'overwrite') {
    const nextState = replaceFile(state, duplicate.id, (file) => ({
      ...file,
      mimeType: mimeType || 'application/octet-stream',
      size: String(size),
      modifiedTime
    }));
    return success(nextState, cloneFile(fileById(nextState, duplicate.id)!));
  }
  const replacedState = duplicate
    ? replaceFile(state, duplicate.id, (file) => ({ ...file, trashed: true, modifiedTime }))
    : state;
  const file: MockWorkspaceFile = {
    id,
    name,
    mimeType: mimeType || 'application/octet-stream',
    size: String(size),
    parents: [parent],
    modifiedTime
  };
  return success(
    { ...replacedState, files: [...replacedState.files.map(cloneFile), file] },
    cloneFile(file)
  );
}

export function listShareUsers(): MockShareUser[] {
  return shareUsers.map((user) => ({ ...user }));
}

export function getFolderShares(state: MockWorkspaceState, folderId: string): MockShareGrant[] {
  return (state.folderShares.get(folderId) ?? []).map(cloneGrant);
}

export function listSharedFolders(state: MockWorkspaceState): MockWorkspaceFile[] {
  return state.files
    .filter(
      (file) => file.mimeType === FOLDER_MIME && !file.trashed && state.folderShares.has(file.id)
    )
    .map(cloneFile);
}

export function decorateMockFiles(
  files: readonly MockWorkspaceFile[],
  folderShares: ReadonlyMap<string, readonly MockShareGrant[]>,
  users: readonly MockShareUser[],
  context: MockFilePresentationContext
): Array<
  MockWorkspaceFile & {
    permission: MockFilePresentationContext['permission'];
    shared?: boolean;
    sharedByMe?: boolean;
    sharedRoot?: boolean;
    sharedWithCount?: number;
    sharedWithNames?: string[];
    canShare: boolean;
  }
> {
  const canManageShares = context.isAdmin || context.permission === 'owner';
  const userById = new Map(users.map((user) => [user.id, user]));
  return files.map((file) => {
    const shares = folderShares.get(file.id) ?? [];
    const sharedRoot = shares.length > 0;
    const shareNames = shares
      .map((share) => userById.get(share.userId)?.displayName)
      .filter((name): name is string => Boolean(name));
    return {
      ...file,
      permission: context.permission,
      ...(context.showShared ? { shared: true } : {}),
      ...(sharedRoot && canManageShares
        ? {
            sharedByMe: true,
            sharedRoot: true,
            sharedWithCount: shares.length,
            sharedWithNames: shareNames
          }
        : {}),
      canShare: canManageShares && file.mimeType === FOLDER_MIME
    };
  });
}

export function saveFolderShares(
  state: MockWorkspaceState,
  folderId: string,
  grants: readonly MockShareGrant[]
): MockOperationResult<MockShareGrant[]> {
  const folder = fileById(state, folderId);
  if (!folder || folder.mimeType !== FOLDER_MIME || folder.trashed)
    return failure<MockShareGrant[]>(state, 404, '폴더를 찾을 수 없습니다.');
  if (grants.some((grant) => !isValidShareGrant(grant)))
    return failure<MockShareGrant[]>(state, 400, '공유 대상 또는 권한이 올바르지 않습니다.');
  const next = grants.map(cloneGrant);
  const nextShares = new Map([...state.folderShares].filter(([id]) => id !== folderId));
  const folderShares = next.length ? new Map([...nextShares, [folderId, next]]) : nextShares;
  return success({ ...state, files: state.files.map(cloneFile), folderShares }, next);
}
