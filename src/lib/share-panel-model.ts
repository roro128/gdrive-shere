import { updateSelectedId } from './list-selection';
import { mergeShareSearchResults, updateSharePermission, type ShareMember } from './share-state';

export type SharePanelState<TFolder, TMember extends ShareMember> = {
  folder: TFolder | null;
  members: readonly TMember[];
  selectedIds: ReadonlySet<string>;
  query: string;
  searchBusy: boolean;
  searchError: string;
  saving: boolean;
};

export type SharePanelAction<TFolder, TMember extends ShareMember> =
  | {
      type: 'open';
      folder: TFolder;
      members: readonly TMember[];
      selectedIds: ReadonlySet<string>;
    }
  | { type: 'close' }
  | { type: 'set-query'; query: string }
  | { type: 'search-start' }
  | { type: 'search-success'; available: readonly TMember[] }
  | { type: 'search-failure'; message: string }
  | { type: 'search-finish' }
  | { type: 'set-selected'; memberId: string; selected: boolean }
  | { type: 'set-permission'; memberId: string; permission: 'viewer' | 'editor' }
  | { type: 'save-start' }
  | { type: 'save-finish' }
  | { type: 'save-success' };

export function initialSharePanelState<TFolder, TMember extends ShareMember>(): SharePanelState<
  TFolder,
  TMember
> {
  return {
    folder: null,
    members: [],
    selectedIds: new Set(),
    query: '',
    searchBusy: false,
    searchError: '',
    saving: false
  };
}

export function sharePanelReducer<TFolder, TMember extends ShareMember>(
  state: SharePanelState<TFolder, TMember>,
  action: SharePanelAction<TFolder, TMember>
): SharePanelState<TFolder, TMember> {
  switch (action.type) {
    case 'open':
      return {
        ...state,
        folder: action.folder,
        members: [...action.members],
        selectedIds: new Set(action.selectedIds),
        query: '',
        searchBusy: false,
        searchError: '',
        saving: false
      };
    case 'close':
      return initialSharePanelState<TFolder, TMember>();
    case 'set-query':
      return { ...state, query: action.query };
    case 'search-start':
      return { ...state, searchBusy: true, searchError: '' };
    case 'search-success':
      return {
        ...state,
        members: mergeShareSearchResults(state.members, action.available, state.selectedIds)
      };
    case 'search-failure':
      return { ...state, searchError: action.message };
    case 'search-finish':
      return { ...state, searchBusy: false };
    case 'set-selected':
      return {
        ...state,
        selectedIds: updateSelectedId(state.selectedIds, action.memberId, action.selected)
      };
    case 'set-permission':
      return {
        ...state,
        members: updateSharePermission(state.members, action.memberId, action.permission)
      };
    case 'save-start':
      return { ...state, saving: true };
    case 'save-finish':
      return { ...state, saving: false };
    case 'save-success':
      return initialSharePanelState<TFolder, TMember>();
  }
}
