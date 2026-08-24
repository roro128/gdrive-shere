import { describe, expect, it } from 'vitest';
import { canEditFileItem, canTrashFileItem } from './file-permissions';
import { buildFileResponseHeaders } from './file-response-model';
import { mergeSharePermissions, mergeShareSearchResults } from './share-state';
import { buildDriveListUrl } from './server/google-request-model';
import { toDriveFileSyncMetadata } from './server/file-list-model';
import { normalizeUploadSessionInput } from './server/upload-session-model';

describe('adversarial boundary behavior', () => {
  it('rejects malformed upload session roots and blank names', () => {
    expect(normalizeUploadSessionInput(null as never)).toBeNull();
    expect(normalizeUploadSessionInput([] as never)).toBeNull();
    expect(normalizeUploadSessionInput({ name: '   ', size: 0 })).toBeNull();
    expect(normalizeUploadSessionInput({ name: { toString: () => 'file' }, size: 0 } as never)).toBe(
      null
    );
  });

  it('rejects upload session fields with the wrong runtime types', () => {
    expect(
      normalizeUploadSessionInput({ name: 'file', size: 0, mimeType: 7 } as never)
    ).toBeNull();
    expect(
      normalizeUploadSessionInput({ name: 'file', size: 0, parentId: 7 } as never)
    ).toBeNull();
  });

  it('does not offer edit or trash actions when permission metadata is absent', () => {
    expect(canEditFileItem({}, true)).toBe(false);
    expect(canTrashFileItem({})).toBe(false);
  });

  it('escapes backslashes in Drive string literals', () => {
    const url = new URL(buildDriveListUrl('https://drive.test/v3', 'root\\folder', 'a\\b'));

    expect(url.searchParams.get('q')).toBe(
      "'root\\\\folder' in parents and trashed = false and name contains 'a\\\\b'"
    );
  });

  it('normalizes invalid Drive sizes instead of persisting NaN or negatives', () => {
    expect(
      toDriveFileSyncMetadata(
        { id: 'file-1', name: 'file', mimeType: 'text/plain', size: 'not-a-number' },
        'root',
        'owner'
      ).size_bytes
    ).toBe(0);
    expect(
      toDriveFileSyncMetadata(
        { id: 'file-2', name: 'file', mimeType: 'text/plain', size: '-1' },
        'root',
        'owner'
      ).size_bytes
    ).toBe(0);
  });

  it('falls back from a control-character MIME value before building headers', () => {
    expect(
      buildFileResponseHeaders('application/octet-stream\r\nX-Leak: yes', 'file.bin', 'attachment')
    ).toMatchObject({ 'content-type': 'application/octet-stream' });
  });

  it('deduplicates unknown users when merging share grants', () => {
    expect(
      mergeSharePermissions([], [
        { userId: 'user-1', displayName: 'First', permission: 'viewer' },
        { userId: 'user-1', displayName: 'Last', permission: 'editor' }
      ])
    ).toEqual([
      {
        id: 'user-1',
        displayName: 'Last',
        handle: undefined,
        permission: 'editor',
        status: undefined
      }
    ]);
  });

  it('deduplicates duplicate search results by user id', () => {
    expect(
      mergeShareSearchResults(
        [],
        [
          { id: 'user-1', displayName: 'First' },
          { id: 'user-1', displayName: 'Last', permission: 'editor' }
        ],
        new Set()
      )
    ).toEqual([{ id: 'user-1', displayName: 'Last', permission: 'editor' }]);
  });
});
