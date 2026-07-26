import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { googleAuthorizeUrl } from './google';

function oauthEvent(): RequestEvent {
  return {
    url: new URL('https://gdrive-share.codo.workers.dev/'),
    platform: {
      env: {
        GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'client-secret'
      }
    }
  } as unknown as RequestEvent;
}

describe('Google OAuth authorization URLs', () => {
  it('does not force a consent screen for an existing administrator login', () => {
    const url = new URL(googleAuthorizeUrl(oauthEvent(), 'state-value'));

    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.has('prompt')).toBe(false);
    expect(url.searchParams.has('access_type')).toBe(false);
  });

  it('requests offline Drive consent only while connecting Drive', () => {
    const url = new URL(
      googleAuthorizeUrl(oauthEvent(), 'state-value', {
        requestDriveAccess: true,
        forceConsent: true
      })
    );

    expect(url.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/drive.file');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });
});
