import { describe, expect, it } from 'vitest';
import {
  buildStoredFileUpdate,
  hasFileUpdate,
  isCrossSpaceMove,
  isSelfParent,
  toTrashStateUpdate
} from './file-update-model';

describe('file update model', () => {
  it('recognizes empty and meaningful PATCH input', () => {
    expect(hasFileUpdate({})).toBe(false);
    expect(hasFileUpdate({ name: 'renamed.txt' })).toBe(true);
    expect(hasFileUpdate({ parentId: 'folder' })).toBe(true);
  });

  it('detects self moves and cross-space moves', () => {
    expect(isSelfParent('file', 'file')).toBe(true);
    expect(isSelfParent('file', 'folder')).toBe(false);
    expect(isCrossSpaceMove('owner-a', 'owner-b')).toBe(true);
    expect(isCrossSpaceMove('owner-a', 'owner-a')).toBe(false);
  });

  it('builds stored metadata without mutating the Drive response', () => {
    const updated = { name: 'renamed.txt', parents: ['next-folder'] };
    expect(buildStoredFileUpdate(updated, 'previous-folder', 'now')).toEqual({
      name: 'renamed.txt',
      parent_drive_id: 'next-folder',
      updated_at: 'now'
    });
    expect(updated).toEqual({ name: 'renamed.txt', parents: ['next-folder'] });
  });

  it('maps trash and restore state to stable database values', () => {
    expect(toTrashStateUpdate(true, 'trashed')).toEqual({ trashed: 1, updated_at: 'trashed' });
    expect(toTrashStateUpdate(false, 'restored')).toEqual({ trashed: 0, updated_at: 'restored' });
  });
});
