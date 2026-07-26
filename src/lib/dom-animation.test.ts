import { describe, expect, it, vi } from 'vitest';

const motionAnimate = vi.hoisted(() => vi.fn());
vi.mock('motion', () => ({ animate: motionAnimate }));

import { animateElement } from './dom-animation';

describe('animateElement', () => {
  it('delegates property keyframes to motion with second-based timing', () => {
    const element = {} as HTMLElement;
    const keyframes = {
      opacity: [0, 1],
      transform: ['translateY(10px)', 'translateY(0)']
    };

    animateElement(element, keyframes, { duration: 0.38, ease: 'easeOut' });

    expect(motionAnimate).toHaveBeenCalledWith(element, keyframes, {
      duration: 0.38,
      ease: 'easeOut'
    });
  });

  it('does not break the interaction when Motion rejects an animation', () => {
    motionAnimate.mockImplementationOnce(() => {
      throw new Error('animation unavailable');
    });

    expect(
      animateElement({} as HTMLElement, { scale: [1, 1.015, 1] }, { duration: 0.26 })
    ).toBeNull();
  });
});
