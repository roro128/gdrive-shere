import { animate } from 'motion';
import type {
  AnimationOptions,
  AnimationPlaybackControlsWithThen,
  DOMKeyframesDefinition
} from 'motion';

export function animateElement(
  element: HTMLElement,
  keyframes: DOMKeyframesDefinition,
  options: AnimationOptions
): AnimationPlaybackControlsWithThen | null {
  try {
    return animate(element, keyframes, options);
  } catch {
    return null;
  }
}
