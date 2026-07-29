import { describe, expect, it } from 'vitest';
import {
  buildBetterAuthRegistrationBody,
  isAllowedEmail,
  normalizeAllowedEmails,
  normalizeLoginIdValue
} from './auth-model';

describe('login id normalization', () => {
  it('builds the Better Auth registration body without effects', () => {
    expect(
      buildBetterAuthRegistrationBody({
        displayName: 'Member',
        loginId: 'member-1',
        password: 'password'
      })
    ).toEqual({
      name: 'Member',
      email: 'member-1@users.gdrive-share.invalid',
      password: 'password',
      username: 'member-1',
      displayUsername: 'member-1'
    });
  });

  it('trims and lowercases valid login ids', () => {
    expect(normalizeLoginIdValue('  Member.Name-1  ')).toBe('member.name-1');
  });

  it.each(['ab', '-starts-with-dash', 'has space', '한글아이디', 'a'.repeat(33)])(
    'returns null for invalid login id %s',
    (value) => {
      expect(normalizeLoginIdValue(value)).toBeNull();
    }
  );
});

describe('Google admin email policy', () => {
  it('normalizes configured email lists', () => {
    expect(normalizeAllowedEmails(' Admin@Example.com, ,Owner@example.com ')).toEqual([
      'admin@example.com',
      'owner@example.com'
    ]);
  });

  it('matches emails case-insensitively and rejects missing values', () => {
    const allowed = normalizeAllowedEmails('admin@example.com');
    expect(isAllowedEmail(allowed, ' ADMIN@EXAMPLE.COM ')).toBe(true);
    expect(isAllowedEmail(allowed, 'other@example.com')).toBe(false);
    expect(isAllowedEmail(allowed, null)).toBe(false);
  });
});
