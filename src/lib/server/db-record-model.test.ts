import { describe, expect, it } from 'vitest';
import {
  buildUserSpaceCreationRecords,
  toAuditEventRecord,
  toSettingRecord,
  toSettingUpdate,
  toUserSpaceCreationRecords
} from './db-record-model';

describe('db record model', () => {
  it('builds settings insert and conflict-update payloads with one timestamp', () => {
    expect(toSettingRecord({ key: 'theme', value: 'dark', updatedAt: 'updated' })).toEqual({
      key: 'theme',
      value: 'dark',
      updated_at: 'updated'
    });
    expect(toSettingUpdate({ value: 'dark', updatedAt: 'updated' })).toEqual({
      value: 'dark',
      updated_at: 'updated'
    });
  });

  it('serializes audit metadata without mutating the source object', () => {
    const metadata = { sharedUserCount: 2, source: 'admin' };
    expect(
      toAuditEventRecord({
        id: 'audit-1',
        userId: 'user-1',
        action: 'folder.updated',
        targetId: 'folder-1',
        metadata,
        createdAt: 'created'
      })
    ).toEqual({
      id: 'audit-1',
      user_id: 'user-1',
      action: 'folder.updated',
      target_id: 'folder-1',
      metadata: JSON.stringify(metadata),
      created_at: 'created'
    });
    expect(metadata).toEqual({ sharedUserCount: 2, source: 'admin' });
  });

  it('preserves null audit identities and empty metadata', () => {
    expect(
      toAuditEventRecord({
        id: 'audit-1',
        userId: null,
        action: 'system.cleanup',
        targetId: null,
        metadata: {},
        createdAt: 'created'
      })
    ).toMatchObject({ user_id: null, target_id: null, metadata: '{}' });
  });

  it('builds the personal space root records with one stable timestamp', () => {
    expect(
      toUserSpaceCreationRecords({
        fileRowId: 'row-1',
        driveFileId: 'drive-root',
        name: 'Member · member',
        mimeType: 'application/vnd.google-apps.folder',
        parentDriveId: 'app-root',
        userId: 'user-1',
        createdAt: 'created'
      })
    ).toEqual({
      driveFile: {
        id: 'row-1',
        drive_file_id: 'drive-root',
        name: 'Member · member',
        mime_type: 'application/vnd.google-apps.folder',
        size_bytes: 0,
        parent_drive_id: 'app-root',
        created_by: 'user-1',
        owner_user_id: 'user-1',
        trashed: 0,
        created_at: 'created',
        updated_at: 'created'
      },
      userSpace: {
        user_id: 'user-1',
        root_drive_id: 'drive-root',
        created_at: 'created'
      }
    });
  });

  it('injects row ID and timestamp effects for personal space records', () => {
    expect(
      buildUserSpaceCreationRecords(
        {
          driveFileId: 'drive-root',
          name: 'Member · member',
          mimeType: 'application/vnd.google-apps.folder',
          parentDriveId: 'app-root',
          userId: 'user-1'
        },
        { now: () => '2026-07-29T00:00:00.000Z', newId: () => 'row-1' }
      )
    ).toMatchObject({
      driveFile: { id: 'row-1', created_at: '2026-07-29T00:00:00.000Z' },
      userSpace: { created_at: '2026-07-29T00:00:00.000Z' }
    });
  });
});
