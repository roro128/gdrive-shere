import { describe, expect, it } from 'vitest';
import {
  filterShareUsers,
  isCurrentSearchGeneration,
  nextSearchGeneration
} from './share-search-model';

describe('share search model', () => {
  it('filters by normalized display name or handle without mutating members', () => {
    const members = [
      { id: '1', displayName: 'Ada Lovelace', handle: 'ada' },
      { id: '2', displayName: 'Grace Hopper', handle: null }
    ];

    expect(filterShareUsers(members, '  ADA ')).toEqual([members[0]]);
    expect(filterShareUsers(members, 'hopper')).toEqual([members[1]]);
    expect(filterShareUsers(members, '')).toEqual(members);
    expect(filterShareUsers(members, 'unknown')).toEqual([]);
    expect(filterShareUsers(members, 'ada')[0]).not.toBe(members[0]);
    expect(members).toEqual([
      { id: '1', displayName: 'Ada Lovelace', handle: 'ada' },
      { id: '2', displayName: 'Grace Hopper', handle: null }
    ]);
  });

  it('advances and compares search generations', () => {
    const next = nextSearchGeneration(4);

    expect(next).toBe(5);
    expect(isCurrentSearchGeneration(next, 5)).toBe(true);
    expect(isCurrentSearchGeneration(4, next)).toBe(false);
  });
});
