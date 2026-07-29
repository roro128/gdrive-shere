import { describe, expect, it } from 'vitest';
import {
  buildActiveUploadSessionRecord,
  buildCompletedUploadPersistence,
  isCompletedUploadResponse,
  normalizeUploadSessionInput,
  resolveReceivedBytes,
  toCancelledUploadUpdate,
  toActiveUploadSessionRecord,
  toCompletedUploadPersistence,
  toUploadProgressUpdate,
  shouldRejectMissingOverwrite,
  shouldReplaceExisting
} from './upload-session-model';

describe('upload session model', () => {
  it('normalizes valid input and applies the MIME default', () => {
    const input = {
      name: 'video.mp4',
      size: 1024,
      parentId: '',
      conflictAction: 'overwrite' as const,
      existingFileId: 'file-1'
    };

    expect(normalizeUploadSessionInput(input)).toEqual({
      name: 'video.mp4',
      mimeType: 'application/octet-stream',
      size: 1024,
      parentId: null,
      conflictAction: 'overwrite',
      existingFileId: 'file-1'
    });
    expect(input).toEqual({
      name: 'video.mp4',
      size: 1024,
      parentId: '',
      conflictAction: 'overwrite',
      existingFileId: 'file-1'
    });
  });

  it.each([
    [{ name: '', size: 1 }],
    [{ name: 'file', size: -1 }],
    [{ name: 'file', size: 1.5 }],
    [{ name: 'file', size: Number.NaN }],
    [{ name: 'file', size: Number.MAX_SAFE_INTEGER + 1 }],
    [{ name: 'file' }]
  ])('rejects invalid input: %o', (input) => {
    expect(normalizeUploadSessionInput(input)).toBeNull();
  });

  it('keeps conflict decisions pure and explicit', () => {
    expect(shouldRejectMissingOverwrite('overwrite', null)).toBe(true);
    expect(shouldRejectMissingOverwrite('overwrite', 'file-1')).toBe(false);
    expect(shouldReplaceExisting('replace', 'file-1')).toBe(true);
    expect(shouldReplaceExisting('replace', null)).toBe(false);
    expect(shouldReplaceExisting(undefined, 'file-1')).toBe(false);
  });

  it('builds an active upload session with bounded name and stable timestamps', () => {
    const record = toActiveUploadSessionRecord({
      id: 'session-1',
      userId: 'user-1',
      parentId: 'parent-1',
      ownerUserId: 'owner-1',
      name: 'a'.repeat(300),
      mimeType: 'text/plain',
      totalBytes: 10,
      driveSessionUrl: 'encrypted-url',
      driveFileId: null,
      expiresAt: 'expires',
      createdAt: 'created'
    });
    expect(record).toEqual({
      id: 'session-1',
      user_id: 'user-1',
      parent_drive_id: 'parent-1',
      owner_user_id: 'owner-1',
      name: 'a'.repeat(255),
      mime_type: 'text/plain',
      total_bytes: 10,
      received_bytes: 0,
      drive_session_url: 'encrypted-url',
      drive_file_id: null,
      status: 'active',
      expires_at: 'expires',
      created_at: 'created',
      updated_at: 'created'
    });
  });

  it('injects clock and ID effects when creating an active session', () => {
    const record = buildActiveUploadSessionRecord(
      {
        userId: 'user-1',
        parentId: 'parent-1',
        ownerUserId: 'owner-1',
        name: 'sample.txt',
        mimeType: 'text/plain',
        totalBytes: 10,
        driveSessionUrl: 'encrypted-url',
        driveFileId: null,
        ttlMs: 7 * 24 * 60 * 60 * 1000
      },
      {
        now: () => '2026-07-29T00:00:00.000Z',
        newId: () => 'session-1'
      }
    );

    expect(record).toMatchObject({
      id: 'session-1',
      expires_at: '2026-08-05T00:00:00.000Z',
      created_at: '2026-07-29T00:00:00.000Z',
      updated_at: '2026-07-29T00:00:00.000Z'
    });
  });

  it('resolves received bytes from upstream, requested range, or fallback', () => {
    expect(resolveReceivedBytes(8, 3, 20)).toBe(8);
    expect(resolveReceivedBytes(null, 3, 20)).toBe(4);
    expect(resolveReceivedBytes(null, null, 20)).toBe(20);
    expect(resolveReceivedBytes(-1, null, 20)).toBe(0);
  });

  it('recognizes completed Drive upload responses', () => {
    expect(isCompletedUploadResponse(200)).toBe(true);
    expect(isCompletedUploadResponse(201)).toBe(true);
    expect(isCompletedUploadResponse(308)).toBe(false);
  });

  it('builds normalized progress and cancellation updates without mutating input', () => {
    expect(toUploadProgressUpdate(-4, 'updated')).toEqual({
      received_bytes: 0,
      updated_at: 'updated'
    });
    expect(toUploadProgressUpdate(12, 'updated')).toEqual({
      received_bytes: 12,
      updated_at: 'updated'
    });
    expect(toCancelledUploadUpdate('cancelled')).toEqual({
      status: 'cancelled',
      updated_at: 'cancelled'
    });
  });

  it('builds consistent session and Drive persistence payloads for completion', () => {
    const payload = {
      id: 'drive-file',
      name: 'sample.txt',
      mimeType: 'text/plain',
      parents: [] as string[]
    };
    const result = toCompletedUploadPersistence(payload, {
      parentId: 'parent-1',
      userId: 'user-1',
      ownerUserId: 'owner-1',
      rowId: 'row-1',
      totalBytes: 42,
      completedAt: 'completed'
    });

    expect(result.session).toEqual({
      drive_file_id: 'drive-file',
      received_bytes: 42,
      status: 'complete',
      updated_at: 'completed'
    });
    expect(result.file.values).toMatchObject({
      id: 'row-1',
      drive_file_id: 'drive-file',
      size_bytes: 42,
      parent_drive_id: 'parent-1',
      created_by: 'user-1',
      owner_user_id: 'owner-1',
      created_at: 'completed',
      updated_at: 'completed'
    });
    expect(result.file.update.updated_at).toBe('completed');
    expect(payload).toEqual({
      id: 'drive-file',
      name: 'sample.txt',
      mimeType: 'text/plain',
      parents: []
    });
  });

  it('injects completion clock and row ID effects', () => {
    const result = buildCompletedUploadPersistence(
      { id: 'drive-file', name: 'sample.txt', mimeType: 'text/plain' },
      {
        parentId: 'parent-1',
        userId: 'user-1',
        ownerUserId: 'owner-1',
        totalBytes: 42
      },
      {
        now: () => '2026-07-29T00:00:00.000Z',
        newId: () => 'row-1'
      }
    );

    expect(result.file.values).toMatchObject({
      id: 'row-1',
      created_at: '2026-07-29T00:00:00.000Z'
    });
    expect(result.session.updated_at).toBe('2026-07-29T00:00:00.000Z');
  });
});
