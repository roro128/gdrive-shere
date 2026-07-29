import { describe, expect, it } from 'vitest';
import {
  isValidPasswordConfirmation,
  toInviteRegistrationRequest,
  toPasswordResetRequest
} from './auth-form-model';

describe('auth form model', () => {
  it.each([
    ['valid-pass', 'valid-pass', true],
    ['12345678', '12345678', true],
    ['short', 'short', false],
    ['12345678', 'different', false]
  ])('validates password confirmation without effects', (password, confirmation, expected) => {
    expect(isValidPasswordConfirmation(password, confirmation)).toBe(expected);
  });

  it('builds immutable invite registration and reset request bodies', () => {
    const invite = {
      displayName: 'Member',
      inviteToken: 'invite-token',
      loginId: 'member',
      password: '12345678'
    };
    const reset = { token: 'reset-token', password: '12345678' };
    expect(toInviteRegistrationRequest(invite)).toEqual(invite);
    expect(toPasswordResetRequest(reset)).toEqual(reset);
    expect(invite).toEqual({
      displayName: 'Member',
      inviteToken: 'invite-token',
      loginId: 'member',
      password: '12345678'
    });
  });
});
