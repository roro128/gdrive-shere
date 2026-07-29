import { describe, expect, it } from 'vitest';
import {
  filesFromDragIds,
  planDraggedMove,
  resolveDropTarget,
  selectDraggedFiles
} from './drag-drop-model';

const files = [
  { id: 'file-a', name: 'A' },
  { id: 'file-b', name: 'B' },
  { id: 'file-c', name: 'C' }
];

describe('drag and drop models', () => {
  it('selects all selected movable files or only the direct source', () => {
    expect(selectDraggedFiles(files, 'file-b', new Set(['file-a', 'file-b']), () => true)).toEqual([
      files[0],
      files[1]
    ]);
    expect(selectDraggedFiles(files, 'file-c', new Set(['file-a']), () => true)).toEqual([
      files[2]
    ]);
    expect(selectDraggedFiles(files, 'file-c', new Set(), () => true)).toEqual([files[2]]);
    expect(
      selectDraggedFiles(
        files,
        'file-b',
        new Set(['file-a', 'file-b']),
        (file) => file.id !== 'file-a'
      )
    ).toEqual([files[1]]);
  });

  it('prefers a valid hit target and rejects dropping onto the source', () => {
    expect(resolveDropTarget('file-a', 'folder', 'fallback')).toBe('folder');
    expect(resolveDropTarget('file-a', 'file-a', 'fallback')).toBe('fallback');
    expect(resolveDropTarget('file-a', null, null)).toBeNull();
  });

  it('plans no move when the target is forbidden and preserves the selection policy otherwise', () => {
    const input = {
      files,
      sourceId: 'file-b',
      selectedIds: new Set(['file-a', 'file-b']),
      canMove: () => true
    };
    expect(planDraggedMove({ ...input, targetAllowed: false })).toEqual([]);
    expect(planDraggedMove({ ...input, targetAllowed: true })).toEqual([files[0], files[1]]);
    expect(
      planDraggedMove({ ...input, targetAllowed: true, canMove: (file) => file.id !== 'file-a' })
    ).toEqual([files[1]]);
  });

  it('resolves payload ids in payload order and ignores missing files', () => {
    expect(filesFromDragIds(['file-c', 'missing', 'file-a'], files)).toEqual([files[2], files[0]]);
  });
});
