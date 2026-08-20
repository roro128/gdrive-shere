export type GoogleOAuthMode = 'bootstrap' | 'login' | 'connect';

export function parseGoogleOAuthMode(value: string | null | undefined): GoogleOAuthMode | null {
  return value === 'bootstrap' || value === 'login' || value === 'connect' ? value : null;
}

export function resolveGoogleOAuthStartMode(
  userRole: string | null,
  hasUsers: boolean
): GoogleOAuthMode {
  if (userRole) return 'connect';
  return hasUsers ? 'login' : 'bootstrap';
}

export function shouldRequestGoogleDriveAccess(mode: GoogleOAuthMode): boolean {
  return mode !== 'login';
}

export function shouldPersistGoogleConnection(mode: GoogleOAuthMode): boolean {
  return mode !== 'login';
}

export type GoogleOAuthCallbackPlan = {
  createSession: boolean;
  persistConnection: boolean;
  requireAdminEmail: boolean;
};

export function resolveGoogleOAuthCallbackPlan(mode: GoogleOAuthMode): GoogleOAuthCallbackPlan {
  return {
    createSession: mode !== 'connect',
    persistConnection: shouldPersistGoogleConnection(mode),
    requireAdminEmail: mode !== 'bootstrap'
  };
}
