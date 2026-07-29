import { describe, expect, it } from 'vitest';
import {
  buildShareGrants,
  mergeSharePermissions,
  mergeShareSearchResults,
  selectedShareMembers,
  updateSharePermission
} from './share-state';

describe('share permission state', () => {
  it('preserves existing grants and defaults unshared members to viewer', () => {
    const members = [
      { id: 'one', displayName: 'One', permission: 'viewer' as const },
      { id: 'two', displayName: 'Two' }
    ];

    expect(mergeSharePermissions(members, [{ userId: 'one', permission: 'editor' }])).toEqual([
      { id: 'one', displayName: 'One', permission: 'editor' },
      { id: 'two', displayName: 'Two', permission: 'viewer' }
    ]);
  });

  it('keeps current shared members visible when they are absent from the search results', () => {
    const members = [{ id: 'two', displayName: 'Two' }];

    expect(
      mergeSharePermissions(members, [
        {
          userId: 'one',
          displayName: 'One',
          handle: 'one',
          permission: 'editor',
          status: 'accepted'
        }
      ])
    ).toEqual([
      { id: 'two', displayName: 'Two', permission: 'viewer' },
      {
        id: 'one',
        displayName: 'One',
        handle: 'one',
        permission: 'editor',
        status: 'accepted'
      }
    ]);
  });

  it('returns only selected users for the current shared-user section', () => {
    const members = [
      { id: 'one', displayName: 'One', permission: 'viewer' as const },
      { id: 'two', displayName: 'Two', permission: 'editor' as const }
    ];

    expect(selectedShareMembers(members, new Set(['two']))).toEqual([members[1]]);
  });

  it('builds grants with a viewer default from selected members', () => {
    expect(
      buildShareGrants(
        [
          { id: 'one', displayName: 'One' },
          { id: 'two', displayName: 'Two', permission: 'editor' }
        ],
        new Set(['one', 'two'])
      )
    ).toEqual([
      { userId: 'one', permission: 'viewer' },
      { userId: 'two', permission: 'editor' }
    ]);
  });

  it('keeps selected members hidden from a search result at the front', () => {
    const current = [
      { id: 'selected', displayName: 'Selected', permission: 'editor' as const },
      { id: 'other', displayName: 'Other', permission: 'viewer' as const }
    ];
    expect(mergeShareSearchResults(current, [current[1]], new Set(['selected']))).toEqual([
      current[0],
      current[1]
    ]);
  });

  it('updates only one member permission without mutating the source list', () => {
    const members = [
      { id: 'u-1', permission: 'viewer' as const },
      { id: 'u-2', permission: 'viewer' as const }
    ];
    expect(updateSharePermission(members, 'u-1', 'editor')).toEqual([
      { id: 'u-1', permission: 'editor' },
      { id: 'u-2', permission: 'viewer' }
    ]);
    expect(members[0].permission).toBe('viewer');
  });
});
