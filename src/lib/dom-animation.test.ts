import { describe, expect, it, vi } from 'vitest';
import { animateElement } from './dom-animation';

describe('animateElement', () => {
  it('uses the browser animation API without assigning array values to CSSStyleDeclaration', () => {
    const animate = vi.fn();
    const element = { animate } as unknown as HTMLElement;
    const keyframes: Keyframe[] = [
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ];

    animateElement(element, keyframes, { duration: 380, easing: 'ease-out' });

    expect(animate).toHaveBeenCalledWith(keyframes, {
      duration: 380,
      easing: 'ease-out',
      fill: 'both'
    });
  });

  it('does not break the interaction when animations are unavailable', () => {
    const element = {} as HTMLElement;

    expect(() => animateElement(element, [{ transform: 'scale(1)' }], { duration: 260 })).not.toThrow();
  });
});
