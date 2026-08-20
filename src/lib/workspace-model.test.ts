import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceCacheKey,
  buildWorkspaceRequest,
  deriveWorkspaceCollections,
  describeMoveResult,
  formatBytes,
  getFileKind,
  getWorkspaceViewFlags,
  isPreviewableFile,
  sortWorkspaceFiles,
  storagePercent,
  summarizeActiveUploads,
  updatePendingIds
} from './workspace-model';

describe('workspace request model', () => {
  it('Given a member shared root When files load Then it uses the shares endpoint only', () => {
    expect(
      buildWorkspaceRequest({
        folderId: null,
        trash: false,
        search: 'ignored',
        showShared: true,
        isAdmin: false
      })
    ).toBe('/api/shares');
  });

  it('Given an admin root When files load Then it uses the user-space endpoint', () => {
    expect(
      buildWorkspaceRequest({
        folderId: null,
        trash: false,
        search: '',
        showShared: false,
        isAdmin: true
      })
    ).toBe('/api/admin/spaces');
  });

  it('Given a nested trash search When files load Then every query value is encoded', () => {
    expect(
      buildWorkspaceRequest({
        folderId: 'folder/a',
        trash: true,
        search: '분기 보고서 & 원본',
        showShared: false,
        isAdmin: false
      })
    ).toBe(
      '/api/files?parentId=folder%2Fa&trash=1&search=%EB%B6%84%EA%B8%B0+%EB%B3%B4%EA%B3%A0%EC%84%9C+%26+%EC%9B%90%EB%B3%B8'
    );
  });

  it('Given equivalent view state When a cache key is built Then property order cannot change it', () => {
    expect(
      buildWorkspaceCacheKey({
        folderId: 'folder',
        trash: false,
        search: 'report',
        showShared: false,
        showRequests: false
      })
    ).toBe('folder|active|private|files|report');
  });
});

describe('workspace collection model', () => {
  const files = [
    {
      id: 'old-file',
      name: 'Zeta.txt',
      mimeType: 'text/plain',
      size: '20',
      modifiedTime: '2026-01-01'
    },
    {
      id: 'folder-b',
      name: 'Beta',
      mimeType: 'application/vnd.google-apps.folder',
      modifiedTime: '2026-01-03'
    },
    {
      id: 'folder-a',
      name: 'Alpha',
      mimeType: 'application/vnd.google-apps.folder',
      modifiedTime: '2026-01-02'
    },
    {
      id: 'new-file',
      name: 'Alpha.txt',
      mimeType: 'text/plain',
      size: '100',
      modifiedTime: '2026-01-04'
    }
  ] as const;

  it('Given unsorted items When sorting by name Then folders stay first and input is unchanged', () => {
    const result = sortWorkspaceFiles(files, 'name', false);

    expect(result.map((file) => file.id)).toEqual(['folder-a', 'folder-b', 'new-file', 'old-file']);
    expect(files.map((file) => file.id)).toEqual(['old-file', 'folder-b', 'folder-a', 'new-file']);
  });

  it('Given descending size sort When sorting Then folders remain first and files reverse', () => {
    expect(sortWorkspaceFiles(files, 'size', true).map((file) => file.id)).toEqual([
      'folder-b',
      'folder-a',
      'new-file',
      'old-file'
    ]);
  });

  it('computes each name sort key once instead of during every comparison', () => {
    let nameReads = 0;
    const sortableFiles = Array.from({ length: 32 }, (_, index) => {
      const file = {
        id: `file-${index}`,
        mimeType: 'text/plain',
        size: String(index),
        modifiedTime: `2026-01-${String(index + 1).padStart(2, '0')}`
      } as { id: string; name: string; mimeType: string; size: string; modifiedTime: string };
      Object.defineProperty(file, 'name', {
        get() {
          nameReads += 1;
          return `File ${index}`;
        }
      });
      return file;
    });

    sortWorkspaceFiles(sortableFiles, 'name', false);

    expect(nameReads).toBe(sortableFiles.length);
  });

  it('Given uploads with invalid progress When summarized Then only active values are clamped', () => {
    expect(
      summarizeActiveUploads([
        { status: 'uploading', progress: 120 },
        { status: 'uploading', progress: -20 },
        { status: 'complete', progress: 100 }
      ])
    ).toEqual({ count: 2, progress: 50 });
    expect(summarizeActiveUploads([{ status: 'complete', progress: 100 }])).toEqual({
      count: 0,
      progress: 0
    });
  });

  it('derives sorted selection, upload, and share collections without mutating inputs', () => {
    const result = deriveWorkspaceCollections({
      files,
      selectedIds: new Set(['new-file', 'folder-a']),
      sortBy: 'name',
      descending: false,
      uploads: [
        { id: 'upload-1', status: 'uploading', progress: 40 },
        { id: 'upload-2', status: 'complete', progress: 100 }
      ],
      shareMembers: [
        { id: 'member-1', displayName: 'One' },
        { id: 'member-2', displayName: 'Two' }
      ],
      sharedMemberIds: new Set(['member-2'])
    });

    expect(result.visibleFiles.map((file) => file.id)).toEqual([
      'folder-a',
      'folder-b',
      'new-file',
      'old-file'
    ]);
    expect(result.selectedFiles.map((file) => file.id)).toEqual(['folder-a', 'new-file']);
    expect(result.activeUploads.map((upload) => upload.id)).toEqual(['upload-1']);
    expect(result.uploadProgress).toBe(40);
    expect(result.currentShareMembers.map((member) => member.id)).toEqual(['member-2']);
    expect(result.availableShareMembers.map((member) => member.id)).toEqual(['member-1']);
  });

  it('Given pending ids When adding and removing Then prior sets are never mutated', () => {
    const original = new Set(['a']);
    const added = updatePendingIds(original, ['b', 'a'], 'add');
    const removed = updatePendingIds(added, ['a', 'missing'], 'remove');

    expect([...original]).toEqual(['a']);
    expect([...added]).toEqual(['a', 'b']);
    expect([...removed]).toEqual(['b']);
  });

  it('Given duplicate pending ids When applying a batch Then membership changes are calculated once', () => {
    const original = new Set(['a', 'c']);

    expect([...updatePendingIds(original, ['b', 'b', 'a'], 'add')]).toEqual(['a', 'c', 'b']);
    expect([...updatePendingIds(original, ['a', 'a', 'missing'], 'remove')]).toEqual(['c']);
    expect([...original]).toEqual(['a', 'c']);
  });
});

describe('workspace presentation primitives', () => {
  it.each([
    ['video/mp4', 'video', true],
    ['image/png', 'image', true],
    ['audio/mpeg', 'audio', true],
    ['application/pdf', 'pdf', true],
    ['text/plain', 'text', true],
    ['application/zip', 'file', false],
    ['application/vnd.google-apps.folder', 'folder', false]
  ] as const)('classifies %s as %s', (mimeType, kind, previewable) => {
    expect(getFileKind(mimeType)).toBe(kind);
    expect(isPreviewableFile(mimeType)).toBe(previewable);
  });

  it('clamps storage percentages and rejects unusable byte values', () => {
    expect(storagePercent({ usage: 150, limit: 100 })).toBe(100);
    expect(storagePercent({ usage: -10, limit: 100 })).toBe(0);
    expect(storagePercent({ usage: 10, limit: 0 })).toBe(0);
    expect(formatBytes('1536')).toBe('1.5 KB');
    expect(formatBytes('-1')).toBe('—');
    expect(formatBytes('not-a-number')).toBe('—');
  });

  it('maps each destination to one exclusive view flag', () => {
    expect(getWorkspaceViewFlags('requests')).toEqual({
      showShared: false,
      showRequests: true,
      trash: false
    });
  });

  it('describes successful, partial, and no-op move results without side effects', () => {
    expect(describeMoveResult({ moved: [], failed: [] }, '보관함')).toBe('');
    expect(
      describeMoveResult(
        {
          moved: [{ name: '완료.txt' }],
          failed: [{ file: { name: '실패.txt' }, message: '권한이 없습니다.' }]
        },
        '보관함'
      )
    ).toBe('1개 이동 완료 · 실패.txt: 권한이 없습니다.');
    expect(describeMoveResult({ moved: [{ name: '완료.txt' }], failed: [] }, '보관함')).toBe(
      '1개 항목을 “보관함” 폴더로 이동했습니다.'
    );
  });
});
