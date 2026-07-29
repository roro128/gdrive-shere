import { describe, expect, it } from 'vitest';
import { authCardReducer, initialAuthCardState, type AuthCardState } from './auth-card-model';

describe('auth card reducer', () => {
  it('clears transient messages when a submission begins', () => {
    const state: AuthCardState = {
      ...initialAuthCardState,
      error: '이전 오류',
      forgotMessage: '이전 요청 결과'
    };

    expect(authCardReducer(state, { type: 'begin-submit' })).toMatchObject({
      busy: true,
      error: '',
      forgotMessage: ''
    });
    expect(state.error).toBe('이전 오류');
  });

  it('keeps independent login fields and resets the forgot message on toggle', () => {
    const state: AuthCardState = {
      ...initialAuthCardState,
      loginId: 'member',
      password: 'secret',
      forgotMessage: '완료'
    };

    const next = authCardReducer(state, { type: 'toggle-forgot' });

    expect(next).toMatchObject({
      loginId: 'member',
      password: 'secret',
      forgotOpen: true,
      forgotMessage: ''
    });
  });

  it('ends a failed submit without losing the error message', () => {
    const submitting = authCardReducer(initialAuthCardState, { type: 'begin-submit' });
    const failed = authCardReducer(submitting, { type: 'set-error', message: '로그인 실패' });
    const finished = authCardReducer(failed, { type: 'end-submit' });

    expect(finished).toMatchObject({ busy: false, error: '로그인 실패' });
  });
});
