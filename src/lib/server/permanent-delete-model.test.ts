import { describe, expect, it } from 'vitest';
import { collectTrashedDescendantIds, orderDriveDeletionIds } from './permanent-delete-model';

describe('permanent delete descendant selection', () => {
  it('orders Drive deletion from descendants back to the root', () => {
    const ids = ['root', 'child', 'grandchild'];
    expect(orderDriveDeletionIds(ids)).toEqual(['grandchild', 'child', 'root']);
    expect(ids).toEqual(['root', 'child', 'grandchild']);
  });

  it('returns the root followed by every nested descendant in breadth-first order', () => {
    expect(
      collectTrashedDescendantIds('root', [
        { id: 'child-a', parentId: 'root' },
        { id: 'child-b', parentId: 'root' },
        { id: 'grandchild', parentId: 'child-a' }
      ])
    ).toEqual(['root', 'child-a', 'child-b', 'grandchild']);
  });

  it('deduplicates malformed repeated links and stops at the depth boundary', () => {
    expect(
      collectTrashedDescendantIds(
        'root',
        [
          { id: 'child', parentId: 'root' },
          { id: 'child', parentId: 'root' },
          { id: 'grandchild', parentId: 'child' },
          { id: 'deep', parentId: 'grandchild' }
        ],
        2
      )
    ).toEqual(['root', 'child', 'grandchild']);
  });

  it('does not follow unrelated files or cycles back to the root', () => {
    expect(
      collectTrashedDescendantIds('root', [
        { id: 'child', parentId: 'root' },
        { id: 'root', parentId: 'child' },
        { id: 'other', parentId: 'elsewhere' }
      ])
    ).toEqual(['root', 'child']);
  });
});
