export type AuthCardState = {
  loginId: string;
  password: string;
  error: string;
  busy: boolean;
  supportsPasskeys: boolean;
  forgotOpen: boolean;
  forgotMessage: string;
};

export type AuthCardAction =
  | { type: 'set-login-id'; value: string }
  | { type: 'set-password'; value: string }
  | { type: 'set-supports-passkeys'; value: boolean }
  | { type: 'toggle-forgot' }
  | { type: 'begin-submit' }
  | { type: 'set-error'; message: string }
  | { type: 'set-forgot-message'; message: string }
  | { type: 'end-submit' };

export const initialAuthCardState: AuthCardState = {
  loginId: '',
  password: '',
  error: '',
  busy: false,
  supportsPasskeys: false,
  forgotOpen: false,
  forgotMessage: ''
};

export function authCardReducer(state: AuthCardState, action: AuthCardAction): AuthCardState {
  switch (action.type) {
    case 'set-login-id':
      return { ...state, loginId: action.value };
    case 'set-password':
      return { ...state, password: action.value };
    case 'set-supports-passkeys':
      return { ...state, supportsPasskeys: action.value };
    case 'toggle-forgot':
      return { ...state, forgotOpen: !state.forgotOpen, forgotMessage: '' };
    case 'begin-submit':
      return { ...state, busy: true, error: '', forgotMessage: '' };
    case 'set-error':
      return { ...state, error: action.message };
    case 'set-forgot-message':
      return { ...state, forgotMessage: action.message };
    case 'end-submit':
      return { ...state, busy: false };
  }
}
