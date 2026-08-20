import { Skeleton as UiSkeleton } from './ui/skeleton';

export function Skeleton({
  className = '',
  width,
  height,
  borderRadius
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}) {
  return (
    <UiSkeleton
      className={`skeleton-pulse ${className}`}
      style={{
        width: width ?? '100%',
        height: height ?? '1rem',
        borderRadius: borderRadius ?? '0.375rem'
      }}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="table-skeleton" aria-label="목록을 불러오는 중…" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="file-row skeleton-row" key={i}>
          <Skeleton width="1.1rem" height="1.1rem" borderRadius="0.25rem" />
          <Skeleton width="1.1rem" height="1.1rem" borderRadius="0.25rem" />
          <div className="file-main">
            <Skeleton width="2.4rem" height="2.4rem" borderRadius="0.5rem" />
            <div className="file-copy" style={{ gap: '0.35rem' }}>
              <Skeleton width={`${Math.floor(45 + (i % 4) * 15)}%`} height="0.95rem" />
              <Skeleton width={`${Math.floor(25 + (i % 3) * 12)}%`} height="0.7rem" />
            </div>
          </div>
          <div className="file-meta">
            <Skeleton width="3rem" height="0.8rem" />
          </div>
          <div className="file-meta">
            <Skeleton width="4.5rem" height="0.8rem" />
          </div>
          <div className="row-actions skeleton-actions">
            <Skeleton width="4.5rem" height="1.8rem" borderRadius="0.35rem" />
            <Skeleton width="3.5rem" height="1.8rem" borderRadius="0.35rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <main className="app-shell" aria-busy="true" aria-label="GShare 불러오는 중">
      <section className="workspace">
        <header className="topbar">
          <div className="product-lockup">
            <Skeleton width="2.2rem" height="2.2rem" borderRadius="0.4rem" />
            <div style={{ display: 'grid', gap: '0.2rem' }}>
              <Skeleton width="4.5rem" height="0.95rem" />
              <Skeleton width="5.5rem" height="0.7rem" />
            </div>
          </div>
          <div className="account-summary">
            <Skeleton width="2.2rem" height="2.2rem" borderRadius="50%" />
            <div style={{ display: 'grid', gap: '0.2rem' }}>
              <Skeleton width="5rem" height="0.85rem" />
              <Skeleton width="3.5rem" height="0.7rem" />
            </div>
          </div>
        </header>

        <nav className="workspace-nav" aria-hidden="true" style={{ pointerEvents: 'none' }}>
          <div className="nav-primary">
            <Skeleton width="5.5rem" height="2.25rem" borderRadius="0.375rem" />
            <Skeleton width="5.5rem" height="2.25rem" borderRadius="0.375rem" />
            <Skeleton width="5rem" height="2.25rem" borderRadius="0.375rem" />
          </div>
          <div className="nav-utility">
            <Skeleton width="4.5rem" height="2.25rem" borderRadius="0.375rem" />
            <Skeleton width="4.5rem" height="2.25rem" borderRadius="0.375rem" />
          </div>
        </nav>

        <section className="workspace-heading" aria-hidden="true">
          <div>
            <Skeleton width="4.5rem" height="0.75rem" />
            <div style={{ marginTop: '0.5rem' }}>
              <Skeleton width="12rem" height="2rem" />
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <Skeleton width="18rem" height="0.9rem" />
            </div>
          </div>
          <div className="workspace-stats">
            <Skeleton width="6rem" height="2.5rem" borderRadius="0.375rem" />
            <Skeleton width="10rem" height="2.5rem" borderRadius="0.375rem" />
          </div>
        </section>

        <section className="workspace-file-area">
          <div className="toolbar">
            <div className="toolbar-actions">
              <Skeleton width="6.5rem" height="2.4rem" borderRadius="0.375rem" />
              <Skeleton width="5.5rem" height="2.4rem" borderRadius="0.375rem" />
            </div>
            <div className="toolbar-controls">
              <Skeleton width="16rem" height="2.4rem" borderRadius="0.375rem" />
              <Skeleton width="7rem" height="2.4rem" borderRadius="0.375rem" />
            </div>
          </div>
          <div className="table-head">
            <span />
            <span />
            <span>이름</span>
            <span>크기</span>
            <span>수정</span>
            <span>작업</span>
          </div>
          <TableSkeleton rows={5} />
        </section>
      </section>
    </main>
  );
}
