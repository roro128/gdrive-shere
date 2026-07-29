import { describe, expect, it, vi } from 'vitest';
import { subscribeWindowEvents } from './window-events';

describe('window event subscriptions', () => {
  it('registers each effect and removes the exact same listeners on cleanup', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    const first = vi.fn();
    const second = vi.fn();
    const subscriptions = [
      ['pointermove', first],
      ['pointerup', second]
    ] as const;

    const cleanup = subscribeWindowEvents(target, subscriptions);
    cleanup();

    expect(target.addEventListener.mock.calls).toEqual([
      ['pointermove', first],
      ['pointerup', second]
    ]);
    expect(target.removeEventListener.mock.calls).toEqual([
      ['pointermove', first],
      ['pointerup', second]
    ]);
  });

  it('supports an empty subscription set as a no-op cleanup', () => {
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const cleanup = subscribeWindowEvents(target, []);

    cleanup();

    expect(target.addEventListener).not.toHaveBeenCalled();
    expect(target.removeEventListener).not.toHaveBeenCalled();
  });
});
