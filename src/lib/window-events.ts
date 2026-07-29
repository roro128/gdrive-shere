export type WindowEventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;
export type WindowEventSubscription = readonly [string, EventListener];

export function subscribeWindowEvents(
  target: WindowEventTarget,
  subscriptions: readonly WindowEventSubscription[]
): () => void {
  subscriptions.forEach(([type, listener]) => {
    target.addEventListener(type, listener);
  });
  return () => {
    subscriptions.forEach(([type, listener]) => {
      target.removeEventListener(type, listener);
    });
  };
}
