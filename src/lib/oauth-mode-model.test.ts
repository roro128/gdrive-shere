import { describe, expect, it } from 'vitest';
import {
  parseGoogleOAuthMode,
  resolveGoogleOAuthCallbackPlan,
  resolveGoogleOAuthStartMode,
  shouldPersistGoogleConnection,
  shouldRequestGoogleDriveAccess
} from './oauth-mode-model';

describe('OAuth mode model', () => {
  it('accepts only supported callback modes', () => {
    expect(parseGoogleOAuthMode('bootstrap')).toBe('bootstrap');
    expect(parseGoogleOAuthMode('login')).toBe('login');
    expect(parseGoogleOAuthMode('connect')).toBe('connect');
    expect(parseGoogleOAuthMode('admin')).toBeNull();
    expect(parseGoogleOAuthMode(null)).toBeNull();
  });

  it('resolves start mode from user presence and account existence', () => {
    expect(resolveGoogleOAuthStartMode(null, false)).toBe('bootstrap');
    expect(resolveGoogleOAuthStartMode(null, true)).toBe('login');
    expect(resolveGoogleOAuthStartMode('admin', true)).toBe('connect');
    expect(resolveGoogleOAuthStartMode('member', true)).toBe('connect');
  });

  it('requests Drive access and persists connection only outside login mode', () => {
    expect(shouldRequestGoogleDriveAccess('login')).toBe(false);
    expect(shouldRequestGoogleDriveAccess('connect')).toBe(true);
    expect(shouldPersistGoogleConnection('bootstrap')).toBe(true);
    expect(shouldPersistGoogleConnection('login')).toBe(false);
  });

  it('resolves callback side effects from mode without mutable route state', () => {
    expect(resolveGoogleOAuthCallbackPlan('bootstrap')).toEqual({
      createSession: true,
      persistConnection: true,
      requireAdminEmail: false
    });
    expect(resolveGoogleOAuthCallbackPlan('login')).toEqual({
      createSession: true,
      persistConnection: false,
      requireAdminEmail: true
    });
    expect(resolveGoogleOAuthCallbackPlan('connect')).toEqual({
      createSession: false,
      persistConnection: true,
      requireAdminEmail: false
    });
  });
});
