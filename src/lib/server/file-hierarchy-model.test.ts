import { describe, expect, it } from 'vitest';
import { wouldCreateFolderCycle } from './file-hierarchy-model';

describe('file hierarchy model', () => {
  it('rejects moving a folder into one of its descendants', () => {
    const parents = new Map([
      ['child', 'folder'],
      ['folder', 'root'],
      ['root', null]
    ]);

    expect(wouldCreateFolderCycle('folder', 'child', parents)).toBe(true);
    expect(wouldCreateFolderCycle('folder', 'root', parents)).toBe(false);
  });

  it('stops traversing at the configured depth', () => {
    const parents = new Map([
      ['level-1', 'level-2'],
      ['level-2', 'folder']
    ]);

    expect(wouldCreateFolderCycle('folder', 'level-1', parents, 1)).toBe(false);
    expect(wouldCreateFolderCycle('folder', 'level-1', parents, 2)).toBe(true);
  });

  it('handles missing parent links as a root boundary', () => {
    expect(wouldCreateFolderCycle('folder', 'unknown', new Map())).toBe(false);
  });
});
