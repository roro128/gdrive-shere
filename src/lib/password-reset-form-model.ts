import type { PasswordResetContext } from './password-reset-client';

export type PasswordResetFormState = {
  context: PasswordResetContext | null;
  password: string;
  confirmation: string;
  message: string;
  busy: boolean;
  completed: boolean;
};

export type PasswordResetFormAction =
  | { type: 'set-context'; context: PasswordResetContext | null }
  | { type: 'set-password'; value: string }
  | { type: 'set-confirmation'; value: string }
  | { type: 'set-message'; message: string }
  | { type: 'set-busy'; busy: boolean }
  | { type: 'complete'; message: string };

export function initialPasswordResetFormState(): PasswordResetFormState {
  return {
    context: null,
    password: '',
    confirmation: '',
    message: '',
    busy: false,
    completed: false
  };
}

export function passwordResetFormReducer(
  state: PasswordResetFormState,
  action: PasswordResetFormAction
): PasswordResetFormState {
  switch (action.type) {
    case 'set-context':
      return { ...state, context: action.context };
    case 'set-password':
      return { ...state, password: action.value };
    case 'set-confirmation':
      return { ...state, confirmation: action.value };
    case 'set-message':
      return { ...state, message: action.message };
    case 'set-busy':
      return { ...state, busy: action.busy };
    case 'complete':
      return {
        ...state,
        password: '',
        confirmation: '',
        message: action.message,
        busy: false,
        completed: true
      };
  }
}
