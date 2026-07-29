import { describe, expect, it, vi } from 'vitest';
import { fetchStorageQuota, fetchWorkspaceFiles } from './workspace-read-client';

describe('workspace read client', () => {
  it('decodes the workspace response while preserving the response metadata', async () => {
    const response = new Response(
      JSON.stringify({ files: [{ id: 'file-1' }], message: '부분 결과' }),
      { status: 206 }
    );
    const request = vi.fn().mockResolvedValue(response);
    const controller = new AbortController();

    await expect(
      fetchWorkspaceFiles(request, '/api/files?folderId=root', controller.signal)
    ).resolves.toEqual({
      response,
      files: [{ id: 'file-1' }],
      message: '부분 결과'
    });
    expect(request).toHaveBeenCalledWith('/api/files?folderId=root', {
      cache: 'no-store',
      signal: controller.signal
    });
  });

  it('returns an empty list for missing files and null for unavailable storage quota', async () => {
    const filesRequest = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const storageRequest = vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 }));

    await expect(
      fetchWorkspaceFiles(filesRequest, '/api/files', new AbortController().signal)
    ).resolves.toMatchObject({ files: [], message: undefined });
    await expect(fetchStorageQuota(storageRequest)).resolves.toBeNull();
  });

  it('decodes a successful storage quota response', async () => {
    const quota = { usage: '10', limit: '100', available: true };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(quota), { status: 200 }));

    await expect(fetchStorageQuota(request)).resolves.toEqual(quota);
  });
});
