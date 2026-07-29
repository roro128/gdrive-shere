import { describe, expect, it } from 'vitest';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, isValidPasswordLength } from './password-policy';

describe('password policy', () => {
  it('accepts exactly the inclusive length boundaries', () => {
    expect(isValidPasswordLength('a'.repeat(MIN_PASSWORD_LENGTH))).toBe(true);
    expect(isValidPasswordLength('a'.repeat(MAX_PASSWORD_LENGTH))).toBe(true);
    expect(isValidPasswordLength('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
    expect(isValidPasswordLength('a'.repeat(MAX_PASSWORD_LENGTH + 1))).toBe(false);
  });

  it('uses character length consistently for Unicode input', () => {
    expect(isValidPasswordLength('가'.repeat(MIN_PASSWORD_LENGTH))).toBe(true);
    expect(isValidPasswordLength('가'.repeat(MAX_PASSWORD_LENGTH + 1))).toBe(false);
  });
});
