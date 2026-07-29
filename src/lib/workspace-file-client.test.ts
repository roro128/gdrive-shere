import { describe, expect, it, vi } from 'vitest';
import {
  createFolder,
  moveFile,
  permanentlyDeleteFile,
  renameFile,
  restoreFile,
  trashFile
} from './workspace-file-client';

describe('workspace file client', () => {
  it('builds a folder creation request at the effect boundary', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    await createFolder(request, '새 폴더', null);

    expect(request).toHaveBeenCalledWith('/api/folders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '새 폴더', parentId: null })
    });
  });

  it('keeps the response available for domain-specific error messages', async () => {
    const response = new Response(JSON.stringify({ message: '권한이 없습니다.' }), { status: 403 });
    const request = vi.fn().mockResolvedValue(response);

    await expect(renameFile(request, 'file-1', '이름')).resolves.toBe(response);
  });

  it('uses the expected mutation endpoints for move, trash, restore, and permanent delete', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await moveFile(request, 'file-1', 'folder-1');
    await trashFile(request, 'file-1');
    await restoreFile(request, 'file-1');
    await permanentlyDeleteFile(request, 'file-1');

    expect(request.mock.calls).toEqual([
      [
        '/api/files/file-1',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ parentId: 'folder-1' })
        }
      ],
      ['/api/files/file-1', { method: 'DELETE' }],
      ['/api/files/file-1/restore', { method: 'POST' }],
      ['/api/files/file-1/permanent', { method: 'DELETE' }]
    ]);
  });
});
