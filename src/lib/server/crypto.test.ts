import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  decrypt,
  encrypt,
  hashPassword,
  randomToken,
  sha256,
  verifyPassword
} from './crypto';

describe('server crypto helpers', () => {
  const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  it('round-trips encrypted secrets', async () => {
    const encrypted = await encrypt('refresh-token-value', key);
    expect(encrypted).not.toContain('refresh-token-value');
    await expect(decrypt(encrypted, key)).resolves.toBe('refresh-token-value');
  });

  it('rejects a wrong encryption key', async () => {
    const encrypted = await encrypt('private-value', key);
    await expect(
      decrypt(encrypted, 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')
    ).rejects.toBeTruthy();
  });

  it('creates stable hashes and non-empty random tokens', async () => {
    await expect(sha256('same')).resolves.toBe(await sha256('same'));
    expect(randomToken()).toHaveLength(43);
    expect(constantTimeEqual('same', 'same')).toBe(true);
    expect(constantTimeEqual('same', 'different')).toBe(false);
  });

  it('hashes passwords with a unique salt and verifies only the original password', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');
    expect(first).not.toBe(second);
    await expect(verifyPassword('correct horse battery staple', first)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', first)).resolves.toBe(false);
  });
});
