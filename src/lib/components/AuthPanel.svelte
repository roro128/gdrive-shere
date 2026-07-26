<script lang="ts">
  import { onMount } from 'svelte';
  import { authClient } from '$lib/client';
  import Button from '$lib/components/ui/Button.svelte';
  import { animateElement } from '$lib/dom-animation';

  let {
    inviteToken = '',
    setupMode = false,
    resetMode = false,
    token = '',
    data
  } = $props<{
    inviteToken?: string;
    setupMode?: boolean;
    resetMode?: boolean;
    token?: string;
    data?: {
      reset?:
        | { valid: true; handle: string | null; loginId: string | null; expiresAt: string }
        | { valid: false };
    };
  }>();

  const resetContext = $derived(data?.reset ?? { valid: false as const });

  let displayName = $state('');
  let loginId = $state('');
  let password = $state('');
  let passwordConfirm = $state('');
  let message = $state('');
  let forgotOpen = $state(false);
  let forgotMessage = $state('');
  let busy = $state(false);
  let supportsPasskeys = $state(true);
  let handleAvailability = $state<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  let handleCheckTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    const card = document.querySelector<HTMLElement>('.auth-card');
    if (card)
      animateElement(
        card,
        [
          { opacity: 0, transform: 'translateY(14px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        { duration: 450, easing: 'ease-out' }
      );
    supportsPasskeys = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
    if (setupMode && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const bootstrapToken = params.get('token');
      if (bootstrapToken) {
        void loginWithGoogle();
      } else {
        window.location.replace('/api/auth/google/start');
      }
    }
  });

  async function request(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) throw new Error((await response.text()) || '요청에 실패했습니다.');
    return response.json();
  }

  async function register() {
    busy = true;
    message = '';
    try {
      if (!(await checkHandle())) throw new Error('사용할 수 있는 핸들을 입력해주세요.');
      await request('/api/auth/better/register', {
        displayName,
        inviteToken: inviteToken || undefined,
        loginId,
        password
      });
      window.location.href = '/';
    } catch (cause) {
      message = cause instanceof Error ? cause.message : '계정을 만들지 못했습니다.';
    } finally {
      busy = false;
    }
  }

  async function checkHandle(): Promise<boolean> {
    const handle = loginId.trim().replace(/^@+/, '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(handle)) {
      handleAvailability = handle ? 'invalid' : 'idle';
      return false;
    }
    handleAvailability = 'checking';
    try {
      const response = await fetch(`/api/handles/check?handle=${encodeURIComponent(handle)}`);
      if (!response.ok) {
        handleAvailability = 'invalid';
        return false;
      }
      const result = (await response.json()) as { available: boolean; valid: boolean };
      handleAvailability = !result.valid ? 'invalid' : result.available ? 'available' : 'taken';
      return handleAvailability === 'available';
    } catch {
      handleAvailability = 'invalid';
      return false;
    }
  }

  function scheduleHandleCheck() {
    loginId = loginId.replace(/^@+/, '');
    handleAvailability = 'checking';
    if (handleCheckTimer) clearTimeout(handleCheckTimer);
    handleCheckTimer = setTimeout(() => void checkHandle(), 350);
  }

  async function login() {
    busy = true;
    message = '';
    try {
      const passwordResult = await authClient.signIn.username({
        username: loginId,
        password
      });
      if (passwordResult.error) throw new Error(passwordResult.error.message);
      window.location.href = '/';
    } catch (cause) {
      message = cause instanceof Error ? cause.message : '패스키 로그인에 실패했습니다.';
    } finally {
      busy = false;
    }
  }

  async function loginWithPasskey() {
    busy = true;
    message = '';
    try {
      const passkeyResult = await authClient.signIn.passkey();
      if (passkeyResult.error) throw new Error(passkeyResult.error.message);
      window.location.href = '/';
    } catch (cause) {
      message = cause instanceof Error ? cause.message : '패스키 로그인에 실패했습니다.';
    } finally {
      busy = false;
    }
  }

  async function loginWithGoogle() {
    busy = true;
    message = '';
    try {
      window.location.replace('/api/auth/google/start');
    } catch (cause) {
      message =
        cause instanceof Error ? cause.message : 'Google 관리자 로그인을 시작하지 못했습니다.';
      busy = false;
    }
  }

  async function requestReset() {
    busy = true;
    forgotMessage = '';
    try {
      await request('/api/auth/password/reset-request', { loginId });
      forgotMessage =
        '요청을 접수했습니다. 관리자가 변경 링크를 전달하면 새 비밀번호를 설정하세요.';
    } catch (cause) {
      forgotMessage = cause instanceof Error ? cause.message : '요청을 접수하지 못했습니다.';
    } finally {
      busy = false;
    }
  }

  async function resetPassword() {
    busy = true;
    message = '';
    try {
      if (password !== passwordConfirm) throw new Error('비밀번호 확인이 일치하지 않습니다.');
      await request('/api/auth/password/reset', { token, password });
      message = '비밀번호가 변경되었습니다. 로그인 화면으로 이동합니다.';
      setTimeout(() => (window.location.href = '/'), 700);
    } catch (cause) {
      message = cause instanceof Error ? cause.message : '비밀번호를 변경하지 못했습니다.';
    } finally {
      busy = false;
    }
  }
</script>

<section class="auth-card" aria-labelledby="auth-title">
  <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
  <p class="eyebrow">GShare</p>
  <h1 id="auth-title">GShare</h1>
  <div class="feature-list" aria-label="주요 기능">
    <span>파일 업로드</span><span>폴더 공유</span><span>패스키 로그인</span>
  </div>

  {#if resetMode}
    {#if resetContext.valid}
      <div class="reset-target">
        <span>변경 대상 계정</span>
        {#if resetContext.handle}<strong>@{resetContext.handle}</strong>{/if}
        {#if resetContext.loginId}<small>로그인 ID · {resetContext.loginId}</small>{/if}
      </div>
      <div class="auth-form">
        <label>
          <span>새 비밀번호</span>
          <input bind:value={password} type="password" autocomplete="new-password" minlength="8" />
        </label>
        <label>
          <span>새 비밀번호 확인</span>
          <input
            bind:value={passwordConfirm}
            type="password"
            autocomplete="new-password"
            minlength="8"
          />
        </label>
        <Button
          size="lg"
          disabled={busy || password.length < 8 || password !== passwordConfirm}
          onclick={resetPassword}
        >
          {busy ? '변경하는 중…' : '비밀번호 변경'}
        </Button>
        <p class="form-hint">관리자가 만든 일회성 링크는 한 번만 사용할 수 있습니다.</p>
      </div>
    {:else}
      <div class="reset-expired" role="alert">
        <strong>비밀번호 변경 링크가 만료되었습니다.</strong>
        <p>이미 사용되었거나 유효 기간이 지난 링크입니다. 관리자에게 새 링크를 요청해주세요.</p>
      </div>
    {/if}
  {:else if setupMode}
    <div class="auth-form">
      <p class="form-hint">
        {busy ? 'Google 관리자 로그인으로 이동하는 중…' : '관리자 등록 링크를 확인하는 중입니다.'}
      </p>
    </div>
  {:else if inviteToken}
    <div class="auth-form">
      <label>
        <span>표시 이름</span>
        <input bind:value={displayName} placeholder="예: 민수" autocomplete="name" />
      </label>
      <label class="handle-field">
        <span>핸들 이름</span>
        <div class="handle-input">
          <span aria-hidden="true">@</span><input
            bind:value={loginId}
            oninput={scheduleHandleCheck}
            placeholder="예: minsu"
            autocomplete="username"
            maxlength="32"
          />
        </div>
        {#if handleAvailability === 'checking'}<small class="handle-status"
            >사용 가능 여부 확인 중…</small
          >{:else if handleAvailability === 'available'}<small class="handle-status available"
            >사용할 수 있는 핸들입니다.</small
          >{:else if handleAvailability === 'taken'}<small class="handle-status taken"
            >이미 사용 중인 핸들입니다.</small
          >{:else if handleAvailability === 'invalid'}<small class="handle-status taken"
            >영문 소문자, 숫자, ., _, -로 3~32자까지 입력해주세요.</small
          >{/if}
      </label>
      <label>
        <span>비밀번호</span>
        <input bind:value={password} type="password" autocomplete="new-password" minlength="8" />
      </label>
      <label>
        <span>비밀번호 확인</span>
        <input
          bind:value={passwordConfirm}
          type="password"
          autocomplete="new-password"
          minlength="8"
        />
      </label>
      <Button
        size="lg"
        disabled={busy ||
          !displayName.trim() ||
          !loginId.trim() ||
          handleAvailability !== 'available' ||
          password.length < 8 ||
          password !== passwordConfirm}
        onclick={register}
      >
        {busy ? '계정 만드는 중…' : '계정 만들기'}
      </Button>
      <p class="form-hint">패스키는 가입 후 내 정보에서 원할 때 등록할 수 있습니다.</p>
    </div>
  {:else}
    <div class="auth-form">
      <label>
        <span>사용자 ID</span>
        <input bind:value={loginId} placeholder="사용자 ID" autocomplete="username" />
      </label>
      <label>
        <span>비밀번호</span>
        <input
          bind:value={password}
          type="password"
          placeholder="비밀번호"
          autocomplete="current-password"
          onkeydown={(event) => event.key === 'Enter' && void login()}
        />
      </label>
      <Button size="lg" disabled={busy || !loginId.trim() || !password} onclick={login}>
        {busy ? '입장하는 중…' : '비밀번호로 입장'}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        disabled={busy || !supportsPasskeys}
        onclick={loginWithPasskey}
      >
        {busy ? '패스키 확인 중…' : '패스키로 입장'}
      </Button>
      <Button variant="link" onclick={() => (forgotOpen = !forgotOpen)}>
        비밀번호를 잊으셨나요?
      </Button>
      {#if forgotOpen}
        <div class="reset-request">
          <p>아이디를 입력해 요청하면 관리자가 변경 링크를 전달합니다.</p>
          <Button variant="secondary" disabled={busy || !loginId.trim()} onclick={requestReset}>
            관리자에게 변경 요청
          </Button>
          {#if forgotMessage}<p class="form-hint">{forgotMessage}</p>{/if}
        </div>
      {/if}
      <div class="oauth-divider"><span>관리자</span></div>
      <Button variant="secondary" class="oauth-button" disabled={busy} onclick={loginWithGoogle}>
        Google OAuth로 관리자 로그인
      </Button>
      <p class="form-hint">비밀번호 또는 등록한 패스키로 입장할 수 있습니다.</p>
    </div>
  {/if}

  {#if !supportsPasskeys}
    <p class="form-hint status-message">
      이 브라우저에서는 패스키를 사용할 수 없습니다. 비밀번호 로그인은 계속 사용할 수 있습니다.
    </p>
  {/if}
  {#if message}
    <p class="error status-message" role="alert">{message}</p>
  {/if}
</section>

<style>
  .auth-card {
    width: min(calc(100% - 40px), 480px);
    padding: 24px 0 44px;
  }
  .brand-mark {
    display: flex;
    gap: 5px;
    margin-bottom: 48px;
  }
  .brand-mark span {
    display: block;
    width: 12px;
    height: 24px;
    border-radius: 4px 4px 1px 1px;
    background: var(--copper);
    transform: skew(-16deg);
  }
  .brand-mark span:nth-child(2) {
    height: 32px;
    margin-top: -8px;
    background: #c87945;
  }
  .brand-mark span:nth-child(3) {
    height: 18px;
    margin-top: 6px;
    background: #835234;
  }
  h1 {
    margin: 12px 0 20px;
    font-size: clamp(2.5rem, 8vw, 4.4rem);
    line-height: 0.98;
    letter-spacing: -0.07em;
  }
  .feature-list {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin: 0 0 38px;
  }
  .feature-list span {
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 6px 9px;
    color: var(--muted);
    font-size: 0.67rem;
  }
  .auth-form {
    display: grid;
    gap: 14px;
  }
  .auth-form :global(.ui-button-lg) {
    width: 100%;
  }
  .auth-form :global(.ui-button-link) {
    justify-self: end;
  }
  .reset-target {
    display: grid;
    gap: 4px;
    margin-bottom: 18px;
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 13px 14px;
    background: #111417;
  }
  .reset-target > span {
    color: var(--dim);
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .reset-target strong {
    color: var(--ink);
    font-size: 1rem;
  }
  .reset-target small {
    color: var(--copper);
    font:
      0.75rem 'DM Mono',
      monospace;
  }
  .reset-expired {
    display: grid;
    gap: 8px;
    border: 1px solid color-mix(in srgb, var(--danger) 55%, var(--line));
    border-radius: 10px;
    padding: 16px;
    background: #171214;
  }
  .reset-expired strong {
    color: var(--ink);
  }
  .reset-expired p {
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.6;
  }
  label {
    display: grid;
    gap: 7px;
    color: var(--muted);
    font-size: 0.8rem;
  }
  .handle-input {
    display: flex;
    align-items: center;
    border: 1px solid var(--line);
    border-radius: 10px;
    color: var(--copper);
    background: var(--surface);
    overflow: hidden;
  }
  .handle-input:focus-within {
    border-color: var(--copper);
  }
  .handle-input > span {
    padding-left: 14px;
    color: var(--copper);
    font-weight: 700;
  }
  .handle-input input {
    border: 0;
    border-radius: 0;
    padding-left: 5px;
  }
  .handle-status {
    color: var(--dim);
    font-size: 0.68rem;
  }
  .handle-status.available {
    color: var(--success);
  }
  .handle-status.taken {
    color: var(--danger);
  }
  input {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 13px 14px;
    color: var(--ink);
    background: var(--surface);
    outline: none;
  }
  input:focus {
    border-color: var(--copper);
  }
  .oauth-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--dim);
    font:
      0.62rem 'DM Mono',
      monospace;
    text-transform: uppercase;
  }
  .oauth-divider::before,
  .oauth-divider::after {
    flex: 1;
    height: 1px;
    background: var(--line);
    content: '';
  }
  .reset-request {
    display: grid;
    gap: 9px;
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 12px;
    background: #111417;
  }
  .reset-request p {
    margin: 0;
    color: var(--muted);
    font-size: 0.72rem;
    line-height: 1.5;
  }
  .form-hint {
    margin: 0;
    color: var(--dim);
    font-size: 0.75rem;
    line-height: 1.6;
  }
  .status-message {
    margin-top: 18px;
    font-size: 0.8rem;
    line-height: 1.5;
  }
</style>
