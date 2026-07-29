import { useParams } from 'react-router';
import { useEffect, useReducer, useRef } from 'react';
import { authClient } from '../../src/lib/client';
import { isMockWorkspace } from '../../src/lib/mock-workspace';
import {
  isValidPasswordConfirmation,
  toInviteRegistrationRequest
} from '../../src/lib/auth-form-model';
import {
  isCurrentHandleCheck,
  isValidHandle,
  normalizeHandle,
  nextHandleCheckSequence
} from '../../src/lib/handle-availability';
import { fetchHandleAvailability } from '../../src/lib/handle-availability-client';
import { registerInvite } from '../../src/lib/auth-client';
import { initialInviteFormState, inviteFormReducer } from '../../src/lib/invite-form-model';

export default function Invite() {
  const { token } = useParams();
  const [state, dispatch] = useReducer(inviteFormReducer, undefined, initialInviteFormState);
  const { displayName, loginId, password, passwordConfirm, message, busy, handleAvailability } =
    state;
  const handleCheckSequence = useRef(0);
  const handleCheckController = useRef<AbortController | null>(null);
  const mockMode = isMockWorkspace();

  async function requestHandleAvailability(handle: string): Promise<boolean> {
    const sequence = nextHandleCheckSequence(handleCheckSequence.current);
    handleCheckSequence.current = sequence;
    handleCheckController.current?.abort();
    const controller = new AbortController();
    handleCheckController.current = controller;
    dispatch({ type: 'set-handle-availability', availability: 'checking' });
    try {
      const next = await fetchHandleAvailability({
        handle,
        mock: mockMode,
        signal: controller.signal
      });
      if (!isCurrentHandleCheck(sequence, handleCheckSequence.current)) return false;
      dispatch({ type: 'set-handle-availability', availability: next });
      return next === 'available';
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return false;
      if (isCurrentHandleCheck(sequence, handleCheckSequence.current)) {
        dispatch({ type: 'set-handle-availability', availability: 'invalid' });
      }
      return false;
    } finally {
      if (isCurrentHandleCheck(sequence, handleCheckSequence.current)) {
        handleCheckController.current = null;
      }
    }
  }

  useEffect(() => {
    const handle = normalizeHandle(loginId);
    if (!handle) {
      handleCheckSequence.current = nextHandleCheckSequence(handleCheckSequence.current);
      handleCheckController.current?.abort();
      dispatch({ type: 'set-handle-availability', availability: 'idle' });
      return;
    }
    if (!isValidHandle(handle)) {
      handleCheckSequence.current = nextHandleCheckSequence(handleCheckSequence.current);
      handleCheckController.current?.abort();
      dispatch({ type: 'set-handle-availability', availability: 'invalid' });
      return;
    }
    const timer = window.setTimeout(() => void requestHandleAvailability(handle), 350);
    return () => {
      window.clearTimeout(timer);
      handleCheckSequence.current = nextHandleCheckSequence(handleCheckSequence.current);
      handleCheckController.current?.abort();
    };
  }, [loginId]);

  async function checkHandle(): Promise<boolean> {
    const handle = normalizeHandle(loginId);
    if (!isValidHandle(handle)) {
      dispatch({ type: 'set-handle-availability', availability: 'invalid' });
      return false;
    }
    return requestHandleAvailability(handle);
  }

  async function register(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    dispatch({ type: 'set-message', message: '' });
    dispatch({ type: 'set-busy', busy: true });
    try {
      if (!isValidPasswordConfirmation(password, passwordConfirm)) {
        dispatch({ type: 'set-message', message: '비밀번호 확인이 일치하지 않습니다.' });
        return;
      }
      if (!(await checkHandle())) {
        dispatch({ type: 'set-message', message: '사용할 수 있는 아이디를 입력해주세요.' });
        return;
      }
      if (mockMode) {
        dispatch({
          type: 'set-message',
          message: '모킹 계정이 생성되었습니다. 로그인 화면에서 계속할 수 있습니다.'
        });
        return;
      }
      await registerInvite(
        fetch,
        toInviteRegistrationRequest({
          displayName,
          inviteToken: token ?? '',
          loginId,
          password
        })
      );
      const signIn = await authClient.signIn.username({ username: loginId, password });
      if (signIn.error)
        throw new Error(
          '계정은 만들어졌지만 자동 로그인에 실패했습니다. 로그인 화면에서 다시 시도해주세요.'
        );
      window.location.href = '/';
    } catch (cause) {
      dispatch({
        type: 'set-message',
        message: cause instanceof Error ? cause.message : '계정을 만들지 못했습니다.'
      });
    } finally {
      dispatch({ type: 'set-busy', busy: false });
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">INVITATION</p>
        <h1>GShare에 참여하세요</h1>
        <p className="muted">초대받은 멤버 계정을 만들면 파일 작업공간에 입장할 수 있습니다.</p>
        <form onSubmit={register}>
          <label className="form-field">
            <span>이름</span>
            <input
              required
              value={displayName}
              onChange={(event) =>
                dispatch({ type: 'set-display-name', value: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>아이디</span>
            <input
              required
              autoComplete="username"
              value={loginId}
              maxLength={32}
              onChange={(event) =>
                dispatch({
                  type: 'set-login-id',
                  value: event.target.value.replace(/^@+/, '')
                })
              }
            />
          </label>
          {handleAvailability === 'checking' && (
            <p className="form-hint">아이디 사용 가능 여부를 확인하는 중…</p>
          )}
          {handleAvailability === 'available' && (
            <p className="form-hint">사용할 수 있는 아이디입니다.</p>
          )}
          {handleAvailability === 'taken' && (
            <p className="modal-error">이미 사용 중인 아이디입니다.</p>
          )}
          {handleAvailability === 'invalid' && (
            <p className="modal-error">영문 소문자, 숫자, ., _, -로 3~32자를 입력해주세요.</p>
          )}
          <label className="form-field">
            <span>비밀번호</span>
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
            <span>비밀번호 확인</span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(event) =>
                dispatch({ type: 'set-password-confirm', value: event.target.value })
              }
            />
          </label>
          {message && <p className="modal-error">{message}</p>}
          <button
            className="primary-button"
            disabled={
              busy ||
              !token ||
              handleAvailability !== 'available' ||
              !displayName.trim() ||
              !isValidPasswordConfirmation(password, passwordConfirm)
            }
            type="submit"
          >
            {busy ? '계정 생성 중…' : '계정 만들기'}
          </button>
        </form>
        {!token && <p className="modal-error">초대 링크가 없습니다.</p>}
        <a className="text-button" href={mockMode ? '/?mock=1' : '/'}>
          로그인으로 돌아가기
        </a>
      </section>
    </main>
  );
}
