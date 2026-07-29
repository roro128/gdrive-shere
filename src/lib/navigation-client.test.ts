import { describe, expect, it, vi } from 'vitest';
import { navigateToGoogle, redirectToHome } from './navigation-client';

describe('navigation client', () => {
  it('navigates to the Google OAuth start endpoint', () => {
    const location = { href: '', replace: vi.fn() };

    navigateToGoogle(location);

    expect(location.href).toBe('/api/auth/google/start');
    expect(location.replace).not.toHaveBeenCalled();
  });

  it('redirects to the home page after session/account transitions', () => {
    const location = { href: '', replace: vi.fn() };

    redirectToHome(location);

    expect(location.replace).toHaveBeenCalledWith('/');
  });
});
