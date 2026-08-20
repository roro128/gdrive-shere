import type { ToastItem } from '../toast-model';

export function ToastView({
  toasts,
  onDismiss
}: {
  toasts: readonly ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container" role="region" aria-label="알림 메시지" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item toast-${toast.type}`} role="status">
          <span className="toast-icon" aria-hidden="true">
            {toast.type === 'success' && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
          </span>
          <p className="toast-message">{toast.message}</p>
          <button
            className="toast-close"
            aria-label="알림 닫기"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
