import { updatePendingIds, type WorkspaceSortKey } from './workspace-model';

export type WorkspaceInteractionState<TFile> = {
  sortBy: WorkspaceSortKey;
  sortDescending: boolean;
  draggingFiles: readonly TFile[];
  pendingOperationIds: ReadonlySet<string>;
  selectionBusy: boolean;
};

export type WorkspaceInteractionAction<TFile> =
  | { type: 'set-sort'; sortBy: WorkspaceSortKey }
  | { type: 'toggle-sort-direction' }
  | { type: 'set-dragging-files'; files: readonly TFile[] }
  | { type: 'clear-dragging-files' }
  | { type: 'mark-pending'; ids: readonly string[] }
  | { type: 'clear-pending'; ids: readonly string[] }
  | { type: 'set-selection-busy'; busy: boolean };

export function initialWorkspaceInteractionState<TFile>(): WorkspaceInteractionState<TFile> {
  return {
    sortBy: 'name',
    sortDescending: false,
    draggingFiles: [],
    pendingOperationIds: new Set(),
    selectionBusy: false
  };
}

export function workspaceInteractionReducer<TFile>(
  state: WorkspaceInteractionState<TFile>,
  action: WorkspaceInteractionAction<TFile>
): WorkspaceInteractionState<TFile> {
  switch (action.type) {
    case 'set-sort':
      return { ...state, sortBy: action.sortBy };
    case 'toggle-sort-direction':
      return { ...state, sortDescending: !state.sortDescending };
    case 'set-dragging-files':
      return { ...state, draggingFiles: [...action.files] };
    case 'clear-dragging-files':
      return { ...state, draggingFiles: [] };
    case 'mark-pending':
      return {
        ...state,
        pendingOperationIds: updatePendingIds(state.pendingOperationIds, action.ids, 'add')
      };
    case 'clear-pending':
      return {
        ...state,
        pendingOperationIds: updatePendingIds(state.pendingOperationIds, action.ids, 'remove')
      };
    case 'set-selection-busy':
      return { ...state, selectionBusy: action.busy };
  }
}
