import { describe, expect, it, vi } from 'vitest';
import { defaultAvatarUrl } from './avatar';

describe('server avatar adapter', () => {
  it('injects the hash effect before projecting the identicon', async () => {
    const hash = vi.fn(async (value: string) => {
      expect(value).toBe('gdrive-share/avatar/v1:user-1');
      return '0123456789abcdef';
    });

    const avatar = await defaultAvatarUrl('user-1', hash);

    expect(hash).toHaveBeenCalledOnce();
    expect(avatar).toMatch(/^data:image\/svg\+xml,/);
  });
});
