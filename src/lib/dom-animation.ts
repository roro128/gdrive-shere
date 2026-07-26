export function animateElement(
  element: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions
): Animation | null {
  if (typeof element.animate !== 'function') return null;
  try {
    return element.animate(keyframes, { ...options, fill: options.fill ?? 'both' });
  } catch {
    return null;
  }
}
