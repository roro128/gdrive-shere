export type WorkspaceModalContext<TFile> = { file: TFile; x: number; y: number };

export type WorkspaceModalState<TFile, TContext = WorkspaceModalContext<TFile>> = {
  previewFile: TFile | null;
  contextMenu: TContext | null;
  newFolder: { open: boolean; name: string; error: string; busy: boolean };
  rename: { file: TFile | null; name: string; busy: boolean };
  invite: { open: boolean; link: string; busy: boolean };
};

export type WorkspaceModalAction<TFile, TContext = WorkspaceModalContext<TFile>> =
  | { type: 'open-preview'; file: TFile }
  | { type: 'close-preview' }
  | { type: 'open-context-menu'; context: TContext }
  | { type: 'close-context-menu' }
  | { type: 'open-new-folder' }
  | { type: 'close-new-folder' }
  | { type: 'set-new-folder-name'; name: string }
  | { type: 'set-new-folder-error'; error: string }
  | { type: 'set-new-folder-busy'; busy: boolean }
  | { type: 'open-rename'; file: TFile; name: string }
  | { type: 'close-rename' }
  | { type: 'set-rename-name'; name: string }
  | { type: 'set-rename-busy'; busy: boolean }
  | { type: 'open-invite'; link: string }
  | { type: 'close-invite' }
  | { type: 'set-invite-busy'; busy: boolean };

export function initialWorkspaceModalState<
  TFile,
  TContext = WorkspaceModalContext<TFile>
>(): WorkspaceModalState<TFile, TContext> {
  return {
    previewFile: null,
    contextMenu: null,
    newFolder: { open: false, name: '', error: '', busy: false },
    rename: { file: null, name: '', busy: false },
    invite: { open: false, link: '', busy: false }
  };
}

export function workspaceModalReducer<TFile, TContext = WorkspaceModalContext<TFile>>(
  state: WorkspaceModalState<TFile, TContext>,
  action: WorkspaceModalAction<TFile, TContext>
): WorkspaceModalState<TFile, TContext> {
  switch (action.type) {
    case 'open-preview':
      return { ...state, previewFile: action.file };
    case 'close-preview':
      return { ...state, previewFile: null };
    case 'open-context-menu':
      return { ...state, contextMenu: action.context };
    case 'close-context-menu':
      return { ...state, contextMenu: null };
    case 'open-new-folder':
      return { ...state, newFolder: { ...state.newFolder, open: true, error: '' } };
    case 'close-new-folder':
      return { ...state, newFolder: { open: false, name: '', error: '', busy: false } };
    case 'set-new-folder-name':
      return { ...state, newFolder: { ...state.newFolder, name: action.name } };
    case 'set-new-folder-error':
      return { ...state, newFolder: { ...state.newFolder, error: action.error } };
    case 'set-new-folder-busy':
      return { ...state, newFolder: { ...state.newFolder, busy: action.busy } };
    case 'open-rename':
      return { ...state, rename: { file: action.file, name: action.name, busy: false } };
    case 'close-rename':
      return { ...state, rename: { file: null, name: '', busy: false } };
    case 'set-rename-name':
      return { ...state, rename: { ...state.rename, name: action.name } };
    case 'set-rename-busy':
      return { ...state, rename: { ...state.rename, busy: action.busy } };
    case 'open-invite':
      return { ...state, invite: { open: true, link: action.link, busy: false } };
    case 'close-invite':
      return { ...state, invite: { open: false, link: '', busy: false } };
    case 'set-invite-busy':
      return { ...state, invite: { ...state.invite, busy: action.busy } };
  }
}
