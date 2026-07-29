import { describe, expect, it } from 'vitest';
import { deleteDriveFilesSequentially } from './drive-deletion-workflow';

describe('deleteDriveFilesSequentially', () => {
  it('preserves input order and treats configured missing files as success', async () => {
    const calls: string[] = [];

    await deleteDriveFilesSequentially(['parent', 'child'], {
      deleteFile: async (id) => {
        calls.push(id);
        if (id === 'parent') throw new Error('missing');
      },
      isMissingFileError: (cause) => cause instanceof Error && cause.message === 'missing'
    });

    expect(calls).toEqual(['parent', 'child']);
  });

  it('stops at the first non-missing failure', async () => {
    const calls: string[] = [];
    const operation = deleteDriveFilesSequentially(['one', 'two', 'three'], {
      deleteFile: async (id) => {
        calls.push(id);
        if (id === 'two') throw new Error('temporary');
      },
      isMissingFileError: () => false
    });

    await expect(operation).rejects.toThrow('temporary');
    expect(calls).toEqual(['one', 'two']);
  });
});
