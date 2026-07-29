import { data } from 'react-router';

export function loader() {
  throw data({ message: '페이지를 찾을 수 없습니다.' }, { status: 404 });
}

export default function NotFound() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>404</h1>
        <p>페이지를 찾을 수 없습니다.</p>
      </section>
    </main>
  );
}
