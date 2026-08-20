import { getWorkspaceViewFlags, type WorkspaceView } from './workspace-model';

export type NavigationFolder = { id: string };

export type WorkspaceNavigationState<TFolder extends NavigationFolder> = {
  folderId: string | null;
  search: string;
  trash: boolean;
  showShared: boolean;
  showRequests: boolean;
  folderPath: readonly TFolder[];
  selectedIds: ReadonlySet<string>;
  lastSelectedId: string | null;
};

export type WorkspaceNavigationAction<TFolder extends NavigationFolder> =
  | { type: 'open-view'; view: WorkspaceView }
  | { type: 'open-folder'; folder: TFolder }
  | { type: 'open-breadcrumb'; index: number }
  | { type: 'open-root' }
  | { type: 'set-search'; value: string }
  | { type: 'replace-selection'; ids: ReadonlySet<string>; anchorId?: string | null }
  | { type: 'remove-selection'; ids: readonly string[] };

export function initialWorkspaceNavigation<
  TFolder extends NavigationFolder
>(): WorkspaceNavigationState<TFolder> {
  return {
    folderId: null,
    search: '',
    trash: false,
    showShared: false,
    showRequests: false,
    folderPath: [],
    selectedIds: new Set(),
    lastSelectedId: null
  };
}

function resetSelection<TFolder extends NavigationFolder>(
  state: WorkspaceNavigationState<TFolder>
): WorkspaceNavigationState<TFolder> {
  return { ...state, selectedIds: new Set(), lastSelectedId: null };
}

export function workspaceNavigationReducer<TFolder extends NavigationFolder>(
  state: WorkspaceNavigationState<TFolder>,
  action: WorkspaceNavigationAction<TFolder>
): WorkspaceNavigationState<TFolder> {
  switch (action.type) {
    case 'open-view':
      return resetSelection({
        ...state,
        ...getWorkspaceViewFlags(action.view),
        folderId: null,
        folderPath: [],
        search: ''
      });
    case 'open-folder':
      if (state.folderId === action.folder.id) return state;
      return resetSelection({
        ...state,
        folderId: action.folder.id,
        folderPath: [...state.folderPath, action.folder],
        search: ''
      });
    case 'open-breadcrumb': {
      const folderPath = state.folderPath.slice(0, action.index + 1);
      const folder = folderPath.at(-1);
      return resetSelection({
        ...state,
        folderPath,
        folderId: folder?.id ?? null
      });
    }
    case 'open-root':
      return resetSelection({ ...state, folderPath: [], folderId: null });
    case 'set-search':
      return { ...state, search: action.value };
    case 'replace-selection':
      return {
        ...state,
        selectedIds: new Set(action.ids),
        lastSelectedId: action.anchorId ?? null
      };
    case 'remove-selection': {
      const removed = new Set(action.ids);
      const selectedIds = new Set([...state.selectedIds].filter((id) => !removed.has(id)));
      return {
        ...state,
        selectedIds,
        lastSelectedId:
          state.lastSelectedId && removed.has(state.lastSelectedId) ? null : state.lastSelectedId
      };
    }
  }
}
