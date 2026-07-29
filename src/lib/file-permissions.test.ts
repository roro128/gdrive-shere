import { describe, expect, it } from 'vitest';
import { canEditFileItem, canTrashFileItem } from './file-permissions';

describe('canTrashFileItem', () => {
  it('allows editor files and child folders', () => {
    expect(canTrashFileItem({ permission: 'editor', mimeType: 'video/mp4' })).toBe(true);
    expect(
      canTrashFileItem({
        permission: 'editor',
        mimeType: 'application/vnd.google-apps.folder',
        shared: true,
        sharedRoot: false
      })
    ).toBe(true);
  });

  it('keeps shared root folders and read-only items out of trash actions', () => {
    expect(
      canTrashFileItem({
        permission: 'editor',
        mimeType: 'application/vnd.google-apps.folder',
        shared: true,
        sharedRoot: true
      })
    ).toBe(false);
    expect(canTrashFileItem({ permission: 'viewer', mimeType: 'text/plain' })).toBe(false);
  });
});

describe('canEditFileItem', () => {
  it('allows an active editor item in a connected workspace', () => {
    expect(canEditFileItem({ permission: 'editor' }, true)).toBe(true);
  });

  it.each([
    [{ permission: 'editor' }, false],
    [{ permission: 'viewer' }, true],
    [{ permission: 'owner', trashed: true }, true],
    [{ permission: 'owner', isAdminSpace: true }, true]
  ])('rejects non-editable file state %#', (file, googleConnected) => {
    expect(canEditFileItem(file, googleConnected)).toBe(false);
  });
});
