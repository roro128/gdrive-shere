import { describe, expect, it } from 'vitest';
import { processTrashCleanup } from './trash-cleanup-workflow';

describe('processTrashCleanup', () => {
  it('deletes the database row only after Drive deletion succeeds', async () => {
    const calls: string[] = [];
    const results = await processTrashCleanup([{ id: 'row-1', driveFileId: 'drive-1' }], {
      deleteDriveFile: async (id) => {
        calls.push(`drive:${id}`);
      },
      deleteDatabaseRow: async (id) => {
        calls.push(`db:${id}`);
      }
    });

    expect(calls).toEqual(['drive:drive-1', 'db:row-1']);
    expect(results).toEqual([
      { target: { id: 'row-1', driveFileId: 'drive-1' }, status: 'deleted' }
    ]);
  });

  it('keeps a failed Drive deletion retryable and continues with later targets', async () => {
    const calls: string[] = [];
    const results = await processTrashCleanup(
      [
        { id: 'row-1', driveFileId: 'drive-1' },
        { id: 'row-2', driveFileId: 'drive-2' }
      ],
      {
        deleteDriveFile: async (id) => {
          calls.push(`drive:${id}`);
          if (id === 'drive-1') throw new Error('temporary failure');
        },
        deleteDatabaseRow: async (id) => {
          calls.push(`db:${id}`);
        }
      }
    );

    expect(calls).toEqual(['drive:drive-1', 'drive:drive-2', 'db:row-2']);
    expect(results).toEqual([
      {
        target: { id: 'row-1', driveFileId: 'drive-1' },
        status: 'retry',
        error: 'temporary failure'
      },
      { target: { id: 'row-2', driveFileId: 'drive-2' }, status: 'deleted' }
    ]);
  });
});
