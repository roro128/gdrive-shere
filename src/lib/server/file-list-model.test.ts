import { describe, expect, it } from 'vitest';
import {
  buildDriveFileSyncInputs,
  buildChangedDriveFileSyncOperations,
  buildDriveFileSyncOperations,
  folderIdsForSharedLookup,
  toDriveFileSyncMetadata,
  toDriveFileSyncOperation,
  toDriveFileSyncRecord
} from './file-list-model';

describe('file list model', () => {
  it('builds sync inputs through injected runtime effects', () => {
    const files = [
      { id: 'folder-1', name: 'Folder', mimeType: 'application/vnd.google-apps.folder' }
    ];
    let idIndex = 0;
    let timeIndex = 0;

    expect(
      buildDriveFileSyncInputs(files, {
        newId: () => `id-${++idIndex}`,
        now: () => `time-${++timeIndex}`
      })
    ).toEqual([{ file: files[0], id: 'id-1', createdAt: 'time-1' }]);
  });

  it('selects only folder IDs for shared-folder lookup', () => {
    expect(
      folderIdsForSharedLookup([
        { id: 'folder-1', name: 'Folder', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'file-1', name: 'File', mimeType: 'text/plain' }
      ])
    ).toEqual(['folder-1']);
  });

  it('normalizes Drive metadata into immutable D1 sync values', () => {
    const file = {
      id: 'drive-file',
      name: 'sample.txt',
      mimeType: 'text/plain',
      size: '12',
      parents: ['folder'],
      trashed: false
    };

    expect(toDriveFileSyncMetadata(file, 'fallback-parent', 'owner-1')).toEqual({
      drive_file_id: 'drive-file',
      name: 'sample.txt',
      mime_type: 'text/plain',
      size_bytes: 12,
      parent_drive_id: 'folder',
      owner_user_id: 'owner-1',
      trashed: 0
    });
    expect(file).toEqual({
      id: 'drive-file',
      name: 'sample.txt',
      mimeType: 'text/plain',
      size: '12',
      parents: ['folder'],
      trashed: false
    });
  });

  it('uses safe defaults for missing Drive metadata', () => {
    expect(
      toDriveFileSyncMetadata(
        { id: 'folder', name: 'Folder', mimeType: 'application/vnd.google-apps.folder' },
        'root',
        'owner-1'
      )
    ).toMatchObject({ size_bytes: 0, parent_drive_id: 'root', trashed: 0 });
  });

  it('builds a complete immutable Drive sync record from effect-provided values', () => {
    const file = {
      id: 'drive-file',
      name: 'sample.txt',
      mimeType: 'text/plain',
      modifiedTime: 'drive-updated'
    };
    const context = {
      parentId: 'parent-1',
      ownerUserId: 'owner-1',
      createdBy: 'creator-1',
      id: 'row-1',
      createdAt: 'created'
    };

    expect(toDriveFileSyncRecord(file, context)).toEqual({
      id: 'row-1',
      drive_file_id: 'drive-file',
      name: 'sample.txt',
      mime_type: 'text/plain',
      size_bytes: 0,
      parent_drive_id: 'parent-1',
      owner_user_id: 'owner-1',
      trashed: 0,
      created_by: 'creator-1',
      created_at: 'created',
      updated_at: 'drive-updated'
    });
    expect(file).toEqual({
      id: 'drive-file',
      name: 'sample.txt',
      mimeType: 'text/plain',
      modifiedTime: 'drive-updated'
    });
  });

  it('keeps insert-only identity fields out of the conflict update payload', () => {
    const operation = toDriveFileSyncOperation(
      { id: 'drive-file', name: 'sample.txt', mimeType: 'text/plain' },
      {
        parentId: 'parent-1',
        ownerUserId: 'owner-1',
        createdBy: 'creator-1',
        id: 'row-1',
        createdAt: 'created'
      }
    );

    expect(operation.update).toEqual({
      drive_file_id: 'drive-file',
      name: 'sample.txt',
      mime_type: 'text/plain',
      size_bytes: 0,
      parent_drive_id: 'parent-1',
      owner_user_id: 'owner-1',
      trashed: 0,
      updated_at: 'created'
    });
    expect(operation.update).not.toHaveProperty('id');
    expect(operation.update).not.toHaveProperty('created_by');
    expect(operation.update).not.toHaveProperty('created_at');
  });

  it('plans multiple Drive sync operations without mutating input entries', () => {
    const inputs = [
      {
        file: { id: 'file-1', name: 'one.txt', mimeType: 'text/plain' },
        id: 'row-1',
        createdAt: 'created-1'
      },
      {
        file: { id: 'file-2', name: 'two.txt', mimeType: 'text/plain' },
        id: 'row-2',
        createdAt: 'created-2'
      }
    ];

    expect(
      buildDriveFileSyncOperations(inputs, {
        parentId: 'parent-1',
        ownerUserId: 'owner-1',
        createdBy: 'creator-1'
      }).map(({ values }) => [values.id, values.drive_file_id, values.created_at])
    ).toEqual([
      ['row-1', 'file-1', 'created-1'],
      ['row-2', 'file-2', 'created-2']
    ]);
    expect(inputs).toEqual([
      {
        file: { id: 'file-1', name: 'one.txt', mimeType: 'text/plain' },
        id: 'row-1',
        createdAt: 'created-1'
      },
      {
        file: { id: 'file-2', name: 'two.txt', mimeType: 'text/plain' },
        id: 'row-2',
        createdAt: 'created-2'
      }
    ]);
  });

  it('skips unchanged Drive rows and creates operations only for new or changed files', () => {
    let idCalls = 0;
    let nowCalls = 0;
    const files = [
      {
        id: 'unchanged',
        name: 'same.txt',
        mimeType: 'text/plain',
        size: '12',
        parents: ['parent-1'],
        modifiedTime: 'modified-1'
      },
      {
        id: 'changed',
        name: 'new-name.txt',
        mimeType: 'text/plain',
        size: '14',
        parents: ['parent-1'],
        modifiedTime: 'modified-2'
      },
      { id: 'new', name: 'new.txt', mimeType: 'text/plain', parents: ['parent-1'] }
    ];

    const operations = buildChangedDriveFileSyncOperations(
      files,
      new Map([
        [
          'unchanged',
          {
            drive_file_id: 'unchanged',
            name: 'same.txt',
            mime_type: 'text/plain',
            size_bytes: 12,
            parent_drive_id: 'parent-1',
            owner_user_id: 'owner-1',
            trashed: 0,
            updated_at: 'modified-1'
          }
        ],
        [
          'changed',
          {
            drive_file_id: 'changed',
            name: 'old-name.txt',
            mime_type: 'text/plain',
            size_bytes: 12,
            parent_drive_id: 'parent-1',
            owner_user_id: 'owner-1',
            trashed: 0,
            updated_at: 'modified-1'
          }
        ]
      ]),
      {
        parentId: 'parent-1',
        ownerUserId: 'owner-1',
        createdBy: 'creator-1',
        newId: () => `row-${++idCalls}`,
        now: () => `created-${++nowCalls}`
      }
    );

    expect(operations.map(({ values }) => values.drive_file_id)).toEqual(['changed', 'new']);
    expect(idCalls).toBe(2);
    expect(nowCalls).toBe(2);
  });
});
