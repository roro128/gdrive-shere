import { describe, expect, it } from 'vitest';
import {
  actionableFiles,
  countSuccessful,
  downloadableFiles,
  uploadConflictTargets
} from './workspace-actions-model';

describe('workspace action models', () => {
  const files = [
    { id: 'folder', mimeType: 'application/vnd.google-apps.folder' },
    { id: 'file', mimeType: 'text/plain' }
  ];

  it('selects only downloadable files', () => {
    expect(downloadableFiles(files, (file) => file.mimeType.endsWith('.folder'))).toEqual([
      files[1]
    ]);
  });

  it('excludes pending files from otherwise actionable targets', () => {
    expect(actionableFiles(files, (file) => file.id !== 'folder', new Set(['file']))).toEqual([]);
  });

  it('resolves one or all upload conflicts without mutating the queue', () => {
    const conflicts = ['first', 'second', 'third'];
    expect(uploadConflictTargets(conflicts, false)).toEqual({
      targets: ['first'],
      remaining: ['second', 'third']
    });
    expect(uploadConflictTargets(conflicts, true)).toEqual({
      targets: conflicts,
      remaining: []
    });
    expect(conflicts).toEqual(['first', 'second', 'third']);
  });

  it('counts successful operations independently of their execution effects', () => {
    expect(countSuccessful([true, false, true])).toBe(2);
  });
});
