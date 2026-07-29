export default function Setup() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">INITIAL SETUP</p>
        <h1>Google Drive 연결</h1>
        <p className="muted">
          관리자 계정으로 Google OAuth를 완료하면 작업공간을 사용할 수 있습니다.
        </p>
        <a className="primary-button" href="/api/auth/google/start?mode=setup">
          Google로 연결
        </a>
      </section>
    </main>
  );
}
