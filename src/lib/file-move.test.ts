import { describe, expect, it, vi } from 'vitest';
import {
  INTERNAL_FILE_DRAG_TYPE,
  createInternalDragPayload,
  moveFiles,
  readInternalDragIds,
  type MovableFile
} from './file-move';

const files: MovableFile[] = [
  { id: 'video-1', name: 'clip.mp4', parents: ['folder-a'] },
  { id: 'folder-b', name: '정리 폴더', parents: ['folder-a'] }
];

describe('internal file drag payload', () => {
  it('round-trips every selected file id through the internal MIME type', () => {
    const data = new Map<string, string>();
    const transfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? ''
    };

    createInternalDragPayload(transfer, files);

    expect(data.get(INTERNAL_FILE_DRAG_TYPE)).toBe('["video-1","folder-b"]');
    expect(readInternalDragIds(transfer)).toEqual(['video-1', 'folder-b']);
  });

  it('accepts the legacy single-id payload used by an in-progress browser drag', () => {
    const transfer = { getData: () => 'video-1' };

    expect(readInternalDragIds(transfer)).toEqual(['video-1']);
  });

  it('rejects malformed and non-string JSON payloads', () => {
    expect(readInternalDragIds({ getData: () => '{broken' })).toEqual([]);
    expect(readInternalDragIds({ getData: () => '[1,null]' })).toEqual([]);
  });
});

describe('moveFiles', () => {
  it('moves files and folders to a child folder and reports all successes', async () => {
    const patch = vi.fn(async () => new Response(null, { status: 200 }));

    const result = await moveFiles(files, 'target-folder', patch);

    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenNthCalledWith(1, 'video-1', 'target-folder');
    expect(patch).toHaveBeenNthCalledWith(2, 'folder-b', 'target-folder');
    expect(result).toEqual({ moved: files, failed: [] });
  });

  it('does not request a no-op move or move a folder into itself', async () => {
    const patch = vi.fn(async () => new Response(null, { status: 200 }));

    const result = await moveFiles(files, 'folder-a', patch);
    const selfResult = await moveFiles([files[1]], 'folder-b', patch);

    expect(patch).not.toHaveBeenCalled();
    expect(result).toEqual({ moved: [], failed: [] });
    expect(selfResult).toEqual({ moved: [], failed: [] });
  });

  it('keeps failed items visible while removing only successfully moved items', async () => {
    const patch = vi.fn(async (id: string) =>
      id === 'folder-b'
        ? new Response('대상 폴더에 접근할 수 없습니다.', { status: 403 })
        : new Response(null, { status: 200 })
    );

    const result = await moveFiles(files, 'target-folder', patch);

    expect(result.moved).toEqual([files[0]]);
    expect(result.failed).toEqual([
      { file: files[1], message: '대상 폴더에 접근할 수 없습니다.' }
    ]);
  });
});
