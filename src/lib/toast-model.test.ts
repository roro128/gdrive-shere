import { describe, expect, it } from 'vitest';
import {
  addToast,
  initialToastState,
  removeToast,
  toastReducer,
  type ToastItem
} from './toast-model';

describe('toast-model', () => {
  it('adds a new toast with unique id and type', () => {
    const initial: ToastItem[] = [];
    const updated = addToast(initial, {
      id: 'toast-1',
      message: '파일을 다운로드했습니다.',
      type: 'success',
      timestamp: 1000
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]).toEqual({
      id: 'toast-1',
      message: '파일을 다운로드했습니다.',
      type: 'success',
      timestamp: 1000
    });
  });

  it('limits the max number of visible toasts', () => {
    const list: ToastItem[] = [
      { id: '1', message: '첫 번째', type: 'info', timestamp: 1 },
      { id: '2', message: '두 번째', type: 'info', timestamp: 2 },
      { id: '3', message: '세 번째', type: 'info', timestamp: 3 }
    ];

    const updated = addToast(
      list,
      { id: '4', message: '네 번째', type: 'success', timestamp: 4 },
      3
    );

    expect(updated).toHaveLength(3);
    expect(updated.map((t) => t.id)).toEqual(['2', '3', '4']);
  });

  it('removes a toast by id', () => {
    const list: ToastItem[] = [
      { id: '1', message: '메시지 1', type: 'info', timestamp: 1 },
      { id: '2', message: '메시지 2', type: 'error', timestamp: 2 }
    ];

    const updated = removeToast(list, '1');
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('2');
  });

  it('handles toastReducer actions correctly', () => {
    let state = initialToastState;
    expect(state.toasts).toEqual([]);

    state = toastReducer(state, {
      type: 'add',
      toast: { id: 't1', message: '저장 완료', type: 'success', timestamp: 100 }
    });
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].message).toBe('저장 완료');

    state = toastReducer(state, { type: 'remove', id: 't1' });
    expect(state.toasts).toHaveLength(0);

    state = toastReducer(
      {
        toasts: [
          { id: '1', message: 'a', type: 'info', timestamp: 1 },
          { id: '2', message: 'b', type: 'info', timestamp: 2 }
        ]
      },
      { type: 'clear' }
    );
    expect(state.toasts).toEqual([]);
  });
});
