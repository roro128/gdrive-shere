import { describe, expect, it } from 'vitest';
import {
  handleAvailabilityFromResponse,
  isCurrentHandleCheck,
  isValidHandle,
  nextHandleCheckSequence,
  normalizeHandle
} from './handle-availability';

describe('invite handle availability', () => {
  it('normalizes the displayed login id before checking it', () => {
    expect(normalizeHandle(' @@Member.Name ')).toBe('member.name');
  });

  it('accepts only the supported three-to-thirty-two character format', () => {
    expect(isValidHandle('abc')).toBe(true);
    expect(isValidHandle('a')).toBe(false);
    expect(isValidHandle('한글아이디')).toBe(false);
  });

  it('maps stale or failed availability responses to a non-submit state', () => {
    expect(handleAvailabilityFromResponse({ valid: true, available: true })).toBe('available');
    expect(handleAvailabilityFromResponse({ valid: true, available: false })).toBe('taken');
    expect(handleAvailabilityFromResponse({ valid: false, available: true })).toBe('invalid');
    expect(handleAvailabilityFromResponse({ valid: true, available: true }, false)).toBe('invalid');
  });

  it('guards asynchronous availability responses with an immutable sequence value', () => {
    const next = nextHandleCheckSequence(8);

    expect(next).toBe(9);
    expect(isCurrentHandleCheck(next, 9)).toBe(true);
    expect(isCurrentHandleCheck(8, next)).toBe(false);
  });
});
