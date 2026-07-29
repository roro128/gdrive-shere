const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeLoginIdValue(value: string): string | null {
  const loginId = value.trim().toLowerCase();
  return LOGIN_ID_PATTERN.test(loginId) ? loginId : null;
}

export function normalizeAllowedEmails(value: string): string[] {
  return value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(allowedEmails: readonly string[], email: string | null): boolean {
  return email !== null && allowedEmails.includes(email.trim().toLowerCase());
}

export function buildBetterAuthRegistrationBody(input: {
  displayName: string;
  loginId: string;
  password: string;
}) {
  return {
    name: input.displayName,
    email: `${input.loginId}@users.gdrive-share.invalid`,
    password: input.password,
    username: input.loginId,
    displayUsername: input.loginId
  };
}
