import { describe, expect, it } from 'vitest';
import {
  canManageFolderShares,
  normalizeRequestedShares,
  normalizeShareSearchQuery,
  prepareRequestedShares,
  selectEligibleShareIds
} from './share-management';

describe('folder share management', () => {
  it('allows the folder owner and an administrator to manage shares', () => {
    expect(canManageFolderShares('owner')).toBe(true);
    expect(canManageFolderShares('admin')).toBe(true);
  });

  it('does not let viewers or editors change the shared-user list', () => {
    expect(canManageFolderShares('viewer')).toBe(false);
    expect(canManageFolderShares('editor')).toBe(false);
  });

  it('normalizes share search queries and strips only the leading handle marker', () => {
    expect(normalizeShareSearchQuery('  @Ada  ')).toBe('ada');
    expect(normalizeShareSearchQuery('@@Ada')).toBe('@ada');
    expect(normalizeShareSearchQuery('a'.repeat(100))).toHaveLength(80);
  });

  it('keeps only valid share requests and preserves their order', () => {
    expect(
      normalizeRequestedShares([
        { userId: 'u-1', permission: 'viewer' },
        { userId: 'u-2', permission: 'editor' },
        { userId: 'u-3', permission: 'admin' },
        { permission: 'viewer' },
        null
      ])
    ).toEqual([
      { userId: 'u-1', permission: 'viewer' },
      { userId: 'u-2', permission: 'editor' }
    ]);
  });

  it('deduplicates requests, excludes the owner, and applies the limit', () => {
    const prepared = prepareRequestedShares(
      [
        { userId: 'owner', permission: 'viewer' },
        { userId: 'u-1', permission: 'viewer' },
        { userId: 'u-1', permission: 'editor' },
        { userId: 'u-2', permission: 'viewer' }
      ],
      'owner',
      1
    );

    expect(prepared.userIds).toEqual(['u-1']);
    expect(prepared.permissions.get('u-1')).toBe('editor');
    expect(prepared.permissions.get('owner')).toBe('viewer');
  });

  it('selects active eligible ids and reports rejected targets', () => {
    expect(selectEligibleShareIds(['u-1', 'u-2'], new Set(['u-1']))).toEqual({
      userIds: ['u-1'],
      hasIneligibleUsers: true
    });
    expect(selectEligibleShareIds([], new Set())).toEqual({
      userIds: [],
      hasIneligibleUsers: false
    });
  });
});
