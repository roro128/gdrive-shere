import { useEffect, useReducer } from 'react';
import { useParams } from 'react-router';
import { isMockWorkspace } from '../../src/lib/mock-workspace';
import { isValidPasswordConfirmation, toPasswordResetRequest } from '../../src/lib/auth-form-model';
import { fetchPasswordResetContext } from '../../src/lib/password-reset-client';
import { resetPassword } from '../../src/lib/auth-client';
import {
  initialPasswordResetFormState,
  passwordResetFormReducer
} from '../../src/lib/password-reset-form-model';

export default function Reset() {
  const { token } = useParams();
  const [state, dispatch] = useReducer(
    passwordResetFormReducer,
    undefined,
    initialPasswordResetFormState
  );
  const { context, password, confirmation, message, busy, completed } = state;
  const mockMode = isMockWorkspace();
  useEffect(() => {
    void fetchPasswordResetContext({ token: token ?? '', mock: mockMode })
      .then((value) => dispatch({ type: 'set-context', context: value }))
      .catch(() => dispatch({ type: 'set-context', context: { valid: false } }));
  }, [token]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || completed) return;
    if (!isValidPasswordConfirmation(password, confirmation)) {
      dispatch({
        type: 'set-message',
        message: '비밀번호는 8자 이상이며 확인 값과 일치해야 합니다.'
      });
      return;
    }
    dispatch({ type: 'set-busy', busy: true });
    dispatch({ type: 'set-message', message: '' });
    try {
      if (mockMode) {
        dispatch({
          type: 'complete',
          message: '모킹 비밀번호가 변경되었습니다. 로그인 화면으로 돌아가세요.'
        });
        return;
      }
      await resetPassword(fetch, toPasswordResetRequest({ token: token ?? '', password }));
      dispatch({
        type: 'complete',
        message: '비밀번호가 변경되었습니다. 로그인 화면으로 돌아가세요.'
      });
    } catch (cause) {
      dispatch({
        type: 'set-message',
        message: cause instanceof Error ? cause.message : '연결을 확인한 뒤 다시 시도해주세요.'
      });
    } finally {
      dispatch({ type: 'set-busy', busy: false });
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">PASSWORD RESET</p>
        <h1>비밀번호 변경</h1>
        {context === null ? (
          <p className="muted">링크를 확인하는 중…</p>
        ) : !context.valid ? (
          <p className="modal-error">만료되었거나 이미 사용한 링크입니다.</p>
        ) : (
          <form onSubmit={submit}>
            <div className="reset-target">
              <span>변경 대상 계정</span>
              <strong>{context.handle ? `@${context.handle}` : 'GShare 멤버'}</strong>
              {context.loginId && <small>로그인 ID · {context.loginId}</small>}
            </div>
            <label className="form-field">
              <span>새 비밀번호</span>
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => dispatch({ type: 'set-password', value: event.target.value })}
              />
            </label>
            <label className="form-field">
              <span>새 비밀번호 확인</span>
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) =>
                  dispatch({ type: 'set-confirmation', value: event.target.value })
                }
              />
            </label>
            <button className="primary-button" disabled={busy || completed} type="submit">
              {busy ? '변경 중…' : completed ? '변경 완료' : '변경하기'}
            </button>
            {message && <p className="muted">{message}</p>}
          </form>
        )}
        <a className="secondary-button" href={mockMode ? '/?mock=1' : '/'}>
          로그인으로 돌아가기
        </a>
      </section>
    </main>
  );
}
