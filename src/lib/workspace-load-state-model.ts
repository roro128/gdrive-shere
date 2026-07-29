export type WorkspaceLoadState<TFile> = {
  files: readonly TFile[];
  loading: boolean;
  refreshing: boolean;
  message: string;
};

export type WorkspaceLoadAction<TFile> =
  | { type: 'refresh-start'; cachedFiles?: readonly TFile[]; hasLoadedFiles: boolean }
  | { type: 'empty-load' }
  | { type: 'load-success'; files: readonly TFile[]; message?: string }
  | { type: 'load-failure'; message: string }
  | { type: 'finish-refresh' }
  | { type: 'set-message'; message: string };

export function initialWorkspaceLoadState<TFile>(): WorkspaceLoadState<TFile> {
  return { files: [], loading: true, refreshing: false, message: '' };
}

export function workspaceLoadReducer<TFile>(
  state: WorkspaceLoadState<TFile>,
  action: WorkspaceLoadAction<TFile>
): WorkspaceLoadState<TFile> {
  switch (action.type) {
    case 'refresh-start':
      return {
        ...state,
        files: action.cachedFiles ? [...action.cachedFiles] : state.files,
        loading: action.cachedFiles ? false : !action.hasLoadedFiles,
        refreshing: true
      };
    case 'empty-load':
      return { ...state, files: [], loading: false, refreshing: false };
    case 'load-success':
      return {
        ...state,
        files: [...action.files],
        loading: false,
        refreshing: false,
        message: action.message ?? state.message
      };
    case 'load-failure':
      return { ...state, loading: false, refreshing: false, message: action.message };
    case 'finish-refresh':
      return { ...state, loading: false, refreshing: false };
    case 'set-message':
      return { ...state, message: action.message };
  }
}
