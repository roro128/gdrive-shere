import { describe, expect, it } from 'vitest';
import { initialSessionState, sessionReducer } from './session-model';

describe('sessionReducer', () => {
  it('finishes loading with either an authenticated or anonymous session', () => {
    const initial = initialSessionState<{ id: string }>();
    const authenticated = sessionReducer(initial, {
      type: 'finish-loading',
      user: { id: 'user-1' }
    });
    const anonymous = sessionReducer(initial, { type: 'finish-loading', user: null });

    expect(authenticated).toEqual({ user: { id: 'user-1' }, loading: false });
    expect(anonymous).toEqual({ user: null, loading: false });
    expect(initial.loading).toBe(true);
  });

  it('clears an expired session without changing the source state', () => {
    const authenticated = sessionReducer(initialSessionState<{ id: string }>(), {
      type: 'set-user',
      user: { id: 'user-1' }
    });
    const expired = sessionReducer(authenticated, { type: 'clear-user' });

    expect(expired).toEqual({ user: null, loading: false });
    expect(authenticated.user).toEqual({ id: 'user-1' });
  });
});
