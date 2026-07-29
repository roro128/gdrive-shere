import {
  updateAccountDeletionAcknowledgement,
  type AccountDeletionAcknowledgementKey,
  type AccountDeletionState
} from './account-deletion';

export type ProfilePanelState<TPasskey> = {
  open: boolean;
  handle: string;
  avatarUrl: string | null;
  loginIdRevealed: boolean;
  passkeys: readonly TPasskey[];
  loading: boolean;
  message: string;
  busy: boolean;
  accountDeletionOpen: boolean;
  deletionConfirmation: string;
  deletionAcknowledged: AccountDeletionState;
  supportsPasskeys: boolean;
  currentPassword: string;
  newPassword: string;
};

export type ProfilePanelAction<TPasskey> =
  | {
      type: 'open';
      handle: string;
      avatarUrl: string | null;
      loading: boolean;
    }
  | { type: 'close' }
  | { type: 'set-handle'; value: string }
  | { type: 'set-avatar'; value: string | null }
  | { type: 'set-login-id-revealed'; value: boolean }
  | { type: 'set-passkeys'; value: readonly TPasskey[] }
  | { type: 'set-loading'; value: boolean }
  | { type: 'set-message'; value: string }
  | { type: 'set-busy'; value: boolean }
  | { type: 'set-account-deletion-open'; value: boolean }
  | { type: 'set-deletion-confirmation'; value: string }
  | {
      type: 'set-deletion-acknowledged';
      key: AccountDeletionAcknowledgementKey;
      value: boolean;
    }
  | { type: 'set-supports-passkeys'; value: boolean }
  | { type: 'set-current-password'; value: string }
  | { type: 'set-new-password'; value: string }
  | { type: 'clear-passwords' };

export function initialProfilePanelState<TPasskey>(): ProfilePanelState<TPasskey> {
  return {
    open: false,
    handle: '',
    avatarUrl: null,
    loginIdRevealed: false,
    passkeys: [],
    loading: false,
    message: '',
    busy: false,
    accountDeletionOpen: false,
    deletionConfirmation: '',
    deletionAcknowledged: { files: false, shares: false, passkeys: false },
    supportsPasskeys: false,
    currentPassword: '',
    newPassword: ''
  };
}

export function profilePanelReducer<TPasskey>(
  state: ProfilePanelState<TPasskey>,
  action: ProfilePanelAction<TPasskey>
): ProfilePanelState<TPasskey> {
  switch (action.type) {
    case 'open':
      return {
        ...state,
        open: true,
        handle: action.handle,
        avatarUrl: action.avatarUrl,
        loading: action.loading,
        loginIdRevealed: false,
        message: '',
        accountDeletionOpen: false,
        deletionConfirmation: '',
        deletionAcknowledged: { files: false, shares: false, passkeys: false }
      };
    case 'close':
      return { ...state, open: false, accountDeletionOpen: false };
    case 'set-handle':
      return { ...state, handle: action.value };
    case 'set-avatar':
      return { ...state, avatarUrl: action.value };
    case 'set-login-id-revealed':
      return { ...state, loginIdRevealed: action.value };
    case 'set-passkeys':
      return { ...state, passkeys: [...action.value] };
    case 'set-loading':
      return { ...state, loading: action.value };
    case 'set-message':
      return { ...state, message: action.value };
    case 'set-busy':
      return { ...state, busy: action.value };
    case 'set-account-deletion-open':
      return { ...state, accountDeletionOpen: action.value };
    case 'set-deletion-confirmation':
      return { ...state, deletionConfirmation: action.value };
    case 'set-deletion-acknowledged':
      return {
        ...state,
        deletionAcknowledged: updateAccountDeletionAcknowledgement(
          state.deletionAcknowledged,
          action.key,
          action.value
        )
      };
    case 'set-supports-passkeys':
      return { ...state, supportsPasskeys: action.value };
    case 'set-current-password':
      return { ...state, currentPassword: action.value };
    case 'set-new-password':
      return { ...state, newPassword: action.value };
    case 'clear-passwords':
      return { ...state, currentPassword: '', newPassword: '' };
  }
}
