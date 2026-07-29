import { describe, expect, it } from 'vitest';
import { collectAccessPath, resolveFileAccess, type AccessFile } from './space-access-model';

const file = (id: string, owner: string | null, parent: string | null): AccessFile => ({
  drive_file_id: id,
  owner_user_id: owner,
  parent_drive_id: parent
});

describe('space access resolution', () => {
  it('collects an immutable ancestor path until the nearest share', async () => {
    const requested = file('child', 'other-owner', 'shared-folder');
    const sharedFolder = file('shared-folder', 'owner', 'root');
    const root = file('root', 'owner', null);
    const path = await collectAccessPath(requested, 'member', {
      findShare: async (id) => (id === 'shared-folder' ? 'viewer' : null),
      findParent: async (id) =>
        id === 'shared-folder' ? sharedFolder : id === 'root' ? root : null
    });

    expect(path.ancestors.map(({ drive_file_id }) => drive_file_id)).toEqual([
      'child',
      'shared-folder'
    ]);
    expect(path.shares).toEqual(new Map([['shared-folder', 'viewer']]));
  });

  it('stops at the configured depth without mutating accumulated state', async () => {
    const requested = file('child', 'other-owner', 'parent');
    const parent = file('parent', 'other-owner', 'root');
    const path = await collectAccessPath(
      requested,
      'member',
      {
        findShare: async () => null,
        findParent: async () => parent
      },
      1
    );

    expect(path.ancestors).toEqual([requested]);
    expect(path.shares).toEqual(new Map());
  });

  it('uses the nearest owner or share in the ancestor chain', () => {
    const requested = file('child', 'owner', 'shared-folder');
    const sharedFolder = file('shared-folder', 'other-owner', 'root');
    const result = resolveFileAccess(
      requested,
      [requested, sharedFolder],
      new Map([['shared-folder', 'viewer']]),
      'member',
      false
    );

    expect(result).toEqual({ file: requested, ownerUserId: 'other-owner', permission: 'viewer' });
  });

  it('prefers ownership over a share on the same ancestor', () => {
    const requested = file('root', 'owner', null);
    expect(
      resolveFileAccess(requested, [requested], new Map([['root', 'viewer']]), 'owner', false)
    ).toMatchObject({ permission: 'owner', ownerUserId: 'owner' });
  });

  it('returns admin access without requiring a share entry', () => {
    const requested = file('file', 'member', 'root');
    expect(resolveFileAccess(requested, [requested], new Map(), 'admin', true)).toEqual({
      file: requested,
      ownerUserId: 'member',
      permission: 'admin'
    });
  });

  it('returns null when the chain has no matching owner or share', () => {
    const requested = file('file', 'owner', 'root');
    expect(resolveFileAccess(requested, [requested], new Map(), 'member', false)).toBeNull();
  });
});
