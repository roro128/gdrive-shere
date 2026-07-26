import { describe, expect, it } from 'vitest';
import { identiconFromHash } from './avatar';

describe('identiconFromHash', () => {
  it('is deterministic for the same hashed seed', () => {
    expect(identiconFromHash('same-user')).toBe(identiconFromHash('same-user'));
  });

  it('changes when the hashed seed changes', () => {
    expect(identiconFromHash('user-a')).not.toBe(identiconFromHash('user-b'));
  });

  it('returns a self-contained SVG data URL', () => {
    expect(identiconFromHash('user')).toMatch(/^data:image\/svg\+xml,/);
    expect(identiconFromHash('user')).toContain('%3Csvg');
  });
});
