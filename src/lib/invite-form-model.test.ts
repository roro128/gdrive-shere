import { describe, expect, it } from 'vitest';
import { initialInviteFormState, inviteFormReducer } from './invite-form-model';

describe('inviteFormReducer', () => {
  it('updates registration fields without mutating the source state', () => {
    const initial = initialInviteFormState();
    const named = inviteFormReducer(initial, { type: 'set-display-name', value: 'Kim' });
    const login = inviteFormReducer(named, { type: 'set-login-id', value: 'kim' });

    expect(login).toMatchObject({ displayName: 'Kim', loginId: 'kim' });
    expect(initial).toEqual(initialInviteFormState());
  });

  it('keeps availability and submission status as explicit transitions', () => {
    const initial = initialInviteFormState();
    const checking = inviteFormReducer(initial, {
      type: 'set-handle-availability',
      availability: 'checking'
    });
    const busy = inviteFormReducer(checking, { type: 'set-busy', busy: true });

    expect(busy.handleAvailability).toBe('checking');
    expect(busy.busy).toBe(true);
  });
});
