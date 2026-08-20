export type ToastType = 'info' | 'success' | 'error';

export type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  timestamp: number;
};

export type ToastState = {
  toasts: readonly ToastItem[];
};

export type ToastAction =
  | { type: 'add'; toast: ToastItem; max?: number }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

export const initialToastState: ToastState = {
  toasts: []
};

export function addToast(toasts: readonly ToastItem[], toast: ToastItem, max = 4): ToastItem[] {
  const next = [...toasts, toast];
  if (next.length > max) {
    return next.slice(next.length - max);
  }
  return next;
}

export function removeToast(toasts: readonly ToastItem[], id: string): ToastItem[] {
  return toasts.filter((item) => item.id !== id);
}

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'add':
      return { toasts: addToast(state.toasts, action.toast, action.max) };
    case 'remove':
      return { toasts: removeToast(state.toasts, action.id) };
    case 'clear':
      return { toasts: [] };
  }
}
