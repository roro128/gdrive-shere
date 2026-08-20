import { describe, expect, it } from 'vitest';
import { planUploadConflictResolution, splitUploadConflicts } from './upload-conflicts';

const existing = [
  { id: 'file-1', name: '이미 있음.txt', mimeType: 'text/plain' },
  { id: 'folder-1', name: '폴더', mimeType: 'application/vnd.google-apps.folder' }
];

describe('upload conflict selection', () => {
  it('plans skip and apply-all decisions without mutating queued conflicts', () => {
    const conflicts = [{ id: 'first' }, { id: 'second' }];

    expect(planUploadConflictResolution(conflicts, 'skip', false)).toEqual({
      uploads: [],
      remaining: [{ id: 'second' }]
    });
    expect(planUploadConflictResolution(conflicts, 'replace', true)).toEqual({
      uploads: conflicts,
      remaining: []
    });
    expect(conflicts).toEqual([{ id: 'first' }, { id: 'second' }]);
  });

  it('keeps every non-conflicting file and queues each conflicting filename once', () => {
    const incoming = [
      { name: '이미 있음.txt' },
      { name: '새 파일.txt' },
      { name: '이미 있음.txt' }
    ];
    const result = splitUploadConflicts(
      incoming,
      existing,
      (file) => file.mimeType === 'application/vnd.google-apps.folder',
      'folder-1'
    );

    expect(result.ready).toEqual([{ name: '새 파일.txt' }]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      file: { name: '이미 있음.txt' },
      existing: { id: 'file-1' },
      targetParentId: 'folder-1'
    });
    expect(incoming).toEqual([
      { name: '이미 있음.txt' },
      { name: '새 파일.txt' },
      { name: '이미 있음.txt' }
    ]);
  });

  it('does not treat a same-named folder as an upload conflict', () => {
    const result = splitUploadConflicts(
      [{ name: '폴더' }],
      existing,
      (file) => file.mimeType === 'application/vnd.google-apps.folder',
      null
    );

    expect(result).toEqual({ ready: [{ name: '폴더' }], conflicts: [] });
  });

  it('uploads only the first duplicate incoming filename', () => {
    const incoming = [
      { name: '새 파일.txt', content: 'first' },
      { name: '새 파일.txt', content: 'duplicate' },
      { name: '다른 파일.txt', content: 'other' }
    ];

    const result = splitUploadConflicts(incoming, [], () => false, null);

    expect(result).toEqual({
      ready: [incoming[0], incoming[2]],
      conflicts: []
    });
  });
});
