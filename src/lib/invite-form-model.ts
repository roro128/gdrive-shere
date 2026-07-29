import type { HandleAvailability } from './handle-availability';

export type InviteFormState = {
  displayName: string;
  loginId: string;
  password: string;
  passwordConfirm: string;
  message: string;
  busy: boolean;
  handleAvailability: HandleAvailability;
};

export type InviteFormAction =
  | { type: 'set-display-name'; value: string }
  | { type: 'set-login-id'; value: string }
  | { type: 'set-password'; value: string }
  | { type: 'set-password-confirm'; value: string }
  | { type: 'set-message'; message: string }
  | { type: 'set-busy'; busy: boolean }
  | { type: 'set-handle-availability'; availability: HandleAvailability };

export function initialInviteFormState(): InviteFormState {
  return {
    displayName: '',
    loginId: '',
    password: '',
    passwordConfirm: '',
    message: '',
    busy: false,
    handleAvailability: 'idle'
  };
}

export function inviteFormReducer(
  state: InviteFormState,
  action: InviteFormAction
): InviteFormState {
  switch (action.type) {
    case 'set-display-name':
      return { ...state, displayName: action.value };
    case 'set-login-id':
      return { ...state, loginId: action.value };
    case 'set-password':
      return { ...state, password: action.value };
    case 'set-password-confirm':
      return { ...state, passwordConfirm: action.value };
    case 'set-message':
      return { ...state, message: action.message };
    case 'set-busy':
      return { ...state, busy: action.busy };
    case 'set-handle-availability':
      return { ...state, handleAvailability: action.availability };
  }
}
