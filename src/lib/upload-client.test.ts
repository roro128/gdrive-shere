import { describe, expect, it, vi } from 'vitest';
import { cancelUploadSession, UploadConflictError, uploadFileInChunks } from './upload-client';

describe('upload client', () => {
  it('builds an upload session cancellation request', async () => {
    const response = new Response(null, { status: 204 });
    const request = vi.fn().mockResolvedValue(response);

    await expect(cancelUploadSession(request, 'session-1')).resolves.toBe(response);
    expect(request).toHaveBeenCalledWith('/api/uploads/session-1', { method: 'DELETE' });
  });

  it('creates a session, retries transient chunks, and reports immutable progress', async () => {
    const requests: Array<{ input: string; init: RequestInit }> = [];
    let chunkAttempts = 0;
    const progress: Array<[number, string]> = [];
    const sleeps: number[] = [];
    const file = new Blob(['abcdefghij']) as Blob & { name: string; type: string };
    Object.defineProperties(file, {
      name: { value: 'sample.txt' },
      type: { value: 'text/plain' }
    });
    const request = async (input: string, init: RequestInit) => {
      requests.push({ input, init });
      if (input === '/api/uploads/session')
        return new Response(JSON.stringify({ uploadId: 'session-1', chunkSize: 5 }), {
          status: 200
        });
      chunkAttempts += 1;
      return chunkAttempts === 1
        ? new Response('retry', { status: 503 })
        : new Response(null, { status: 200 });
    };

    await expect(
      uploadFileInChunks({
        file,
        targetParentId: null,
        signal: new AbortController().signal,
        request,
        sleep: async (milliseconds) => {
          sleeps.push(milliseconds);
        },
        onProgress: (value, sessionId) => progress.push([value, sessionId])
      })
    ).resolves.toBe('session-1');

    expect(requests).toHaveLength(4);
    expect(sleeps).toEqual([250]);
    expect(progress).toEqual([
      [50, 'session-1'],
      [100, 'session-1']
    ]);
    expect(requests[1]?.init.headers).toMatchObject({
      'content-length': '5',
      'content-range': 'bytes 0-4/10'
    });
  });

  it('does not retry a permanent chunk failure', async () => {
    let chunkRequests = 0;
    const request = async (input: string) => {
      if (input === '/api/uploads/session')
        return new Response(JSON.stringify({ uploadId: 'session-1', chunkSize: 10 }), {
          status: 200
        });
      chunkRequests += 1;
      return new Response(JSON.stringify({ message: 'bad chunk' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    };

    await expect(
      uploadFileInChunks({
        file: new Blob(['data']) as never,
        targetParentId: null,
        signal: new AbortController().signal,
        request,
        sleep: async () => undefined,
        onProgress: () => undefined
      })
    ).rejects.toThrow('bad chunk');
    expect(chunkRequests).toBe(1);
  });

  it('surfaces a server-side name conflict as a resolvable upload conflict', async () => {
    const request = async () =>
      new Response(
        JSON.stringify({
          message: '같은 이름의 파일이 이미 있습니다.',
          conflict: {
            existingFileId: 'existing-1',
            existingName: 'thumbnail.jpg',
            existingMimeType: 'image/jpeg'
          }
        }),
        { status: 409, headers: { 'content-type': 'application/json' } }
      );

    await expect(
      uploadFileInChunks({
        file: new Blob(['data']) as never,
        targetParentId: 'folder-1',
        signal: new AbortController().signal,
        request,
        sleep: async () => undefined,
        onProgress: () => undefined
      })
    ).rejects.toBeInstanceOf(UploadConflictError);
  });
});
