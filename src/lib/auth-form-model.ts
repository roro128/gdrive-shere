import { isValidPasswordLength } from './password-policy';

export function isValidPasswordConfirmation(password: string, confirmation: string): boolean {
  return isValidPasswordLength(password) && password === confirmation;
}

export function toInviteRegistrationRequest(input: {
  displayName: string;
  inviteToken: string;
  loginId: string;
  password: string;
}) {
  return {
    displayName: input.displayName,
    inviteToken: input.inviteToken,
    loginId: input.loginId,
    password: input.password
  };
}

export function toPasswordResetRequest(input: { token: string; password: string }) {
  return {
    token: input.token,
    password: input.password
  };
}
