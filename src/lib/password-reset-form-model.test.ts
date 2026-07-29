import { describe, expect, it } from 'vitest';
import {
  initialPasswordResetFormState,
  passwordResetFormReducer
} from './password-reset-form-model';

describe('passwordResetFormReducer', () => {
  it('updates fields independently and preserves unrelated state', () => {
    const initial = initialPasswordResetFormState();
    const password = passwordResetFormReducer(initial, {
      type: 'set-password',
      value: 'secret123'
    });
    const confirmation = passwordResetFormReducer(password, {
      type: 'set-confirmation',
      value: 'secret123'
    });

    expect(confirmation.password).toBe('secret123');
    expect(confirmation.confirmation).toBe('secret123');
    expect(initial.password).toBe('');
    expect(initial.confirmation).toBe('');
  });

  it('clears credentials when completion is recorded', () => {
    const filled = passwordResetFormReducer(
      passwordResetFormReducer(initialPasswordResetFormState(), {
        type: 'set-password',
        value: 'secret123'
      }),
      { type: 'set-confirmation', value: 'secret123' }
    );
    const completed = passwordResetFormReducer(filled, {
      type: 'complete',
      message: '변경되었습니다.'
    });

    expect(completed).toMatchObject({
      password: '',
      confirmation: '',
      completed: true,
      busy: false,
      message: '변경되었습니다.'
    });
  });
});
