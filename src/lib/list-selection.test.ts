import { describe, expect, it } from 'vitest';
import {
  nextSelectedIds,
  removeSelectedIdSet,
  removeSelectedIds,
  selectableIdSet,
  selectableIds,
  updateSelectedId
} from './list-selection';

describe('selectableIds', () => {
  it('selects only visible, non-admin rows', () => {
    expect(
      selectableIds([{ id: 'folder' }, { id: 'file' }, { id: 'admin-space', isAdminSpace: true }])
    ).toEqual(['folder', 'file']);
  });

  it('removes items that were moved away from the current list', () => {
    expect(removeSelectedIds(['folder', 'file', 'other'], ['file', 'missing'])).toEqual([
      'folder',
      'other'
    ]);
  });

  it('returns an immutable selection set for state transitions', () => {
    const selectedIds = new Set(['folder', 'file']);
    expect(removeSelectedIdSet(selectedIds, ['file'])).toEqual(new Set(['folder']));
    expect(selectedIds).toEqual(new Set(['folder', 'file']));
  });

  it('builds a selection set without administrator spaces', () => {
    expect(selectableIdSet([{ id: 'folder' }, { id: 'admin', isAdminSpace: true }])).toEqual(
      new Set(['folder'])
    );
  });

  it('updates one selected id without mutating the original set', () => {
    const selectedIds = new Set(['a']);

    expect(updateSelectedId(selectedIds, 'b', true)).toEqual(new Set(['a', 'b']));
    expect(updateSelectedId(selectedIds, 'a', false)).toEqual(new Set());
    expect(selectedIds).toEqual(new Set(['a']));
  });

  it('Given a shift selection When both anchors are visible Then it selects the inclusive range', () => {
    const selectedIds = new Set(['a']);
    expect(
      nextSelectedIds({
        selectedIds,
        visibleItems: [{ id: 'a' }, { id: 'b' }, { id: 'admin', isAdminSpace: true }, { id: 'c' }],
        targetId: 'c',
        checked: true,
        shiftKey: true,
        anchorId: 'a'
      })
    ).toEqual(new Set(['a', 'b', 'c']));
    expect(selectedIds).toEqual(new Set(['a']));
  });

  it('Given a stale shift anchor When selecting Then it selects only the requested item', () => {
    expect(
      nextSelectedIds({
        selectedIds: new Set(['old']),
        visibleItems: [{ id: 'a' }, { id: 'b' }],
        targetId: 'b',
        checked: true,
        shiftKey: true,
        anchorId: 'missing'
      })
    ).toEqual(new Set(['old', 'b']));
  });

  it('Given an administrator space When toggled Then selection remains unchanged', () => {
    const selectedIds = new Set(['file']);
    const result = nextSelectedIds({
      selectedIds,
      visibleItems: [{ id: 'admin', isAdminSpace: true }, { id: 'file' }],
      targetId: 'admin',
      checked: true,
      shiftKey: false,
      anchorId: null
    });

    expect(result).toEqual(new Set(['file']));
    expect(result).not.toBe(selectedIds);
  });
});
