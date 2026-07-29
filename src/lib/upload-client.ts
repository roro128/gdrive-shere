import {
  buildUploadSessionPayload,
  buildUploadChunkRequest,
  uploadProgress,
  type UploadChunkRequest
} from './upload-flow-model';
import { uploadChunkWithRetry } from './upload-chunk-workflow';
import { readResponseMessage } from './response-message';

type UploadFile = {
  name: string;
  type: string;
  size: number;
  slice: (start?: number, end?: number) => Blob;
};

type UploadRequest = (input: string, init: RequestInit) => Promise<Response>;

export class UploadConflictError extends Error {
  constructor(
    readonly existingFileId: string,
    readonly existingName: string,
    readonly existingMimeType: string
  ) {
    super('같은 이름의 파일이 이미 있습니다.');
    this.name = 'UploadConflictError';
  }
}

async function uploadChunks(input: {
  file: UploadFile;
  sessionId: string;
  chunkSize: number;
  offset: number;
  signal: AbortSignal;
  request: UploadRequest;
  sleep: (milliseconds: number) => Promise<void>;
  onProgress: (progress: number, sessionId: string) => void;
}): Promise<void> {
  if (input.file.size > 0 && input.offset >= input.file.size) return;
  const chunkRange: UploadChunkRequest = buildUploadChunkRequest(
    input.file.size,
    input.offset,
    input.chunkSize,
    Math.max(0, Math.min(input.chunkSize, input.file.size - input.offset))
  );
  const chunk = input.file.slice(chunkRange.start, chunkRange.end);
  const response = await uploadChunkWithRetry({
    request: () =>
      input.request(`/api/uploads/${input.sessionId}/chunks`, {
        method: 'PUT',
        headers: chunkRange.headers,
        body: chunk,
        signal: input.signal
      }),
    signal: input.signal,
    sleep: input.sleep
  });
  if (!response.ok) throw new Error('업로드 청크를 전송하지 못했습니다.');
  input.onProgress(uploadProgress(input.file.size, chunkRange.end), input.sessionId);
  if (input.file.size === 0) return;
  return uploadChunks({ ...input, offset: chunkRange.end });
}

export function cancelUploadSession(request: UploadRequest, sessionId: string): Promise<Response> {
  return request(`/api/uploads/${sessionId}`, { method: 'DELETE' });
}

export async function uploadFileInChunks(input: {
  file: UploadFile;
  targetParentId: string | null;
  conflictAction?: 'replace' | 'overwrite';
  existingFileId?: string;
  signal: AbortSignal;
  request: UploadRequest;
  sleep: (milliseconds: number) => Promise<void>;
  onProgress: (progress: number, sessionId: string) => void;
}): Promise<string> {
  const sessionResponse = await input.request('/api/uploads/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: input.signal,
    body: JSON.stringify(
      buildUploadSessionPayload({
        name: input.file.name,
        type: input.file.type,
        size: input.file.size,
        parentId: input.targetParentId,
        conflictAction: input.conflictAction,
        existingFileId: input.existingFileId
      })
    )
  });
  if (!sessionResponse.ok) {
    if (sessionResponse.status === 409) {
      const payload = (await sessionResponse.json().catch(() => null)) as {
        conflict?: {
          existingFileId?: unknown;
          existingName?: unknown;
          existingMimeType?: unknown;
        };
      } | null;
      const conflict = payload?.conflict;
      if (
        typeof conflict?.existingFileId === 'string' &&
        typeof conflict.existingName === 'string' &&
        typeof conflict.existingMimeType === 'string'
      ) {
        throw new UploadConflictError(
          conflict.existingFileId,
          conflict.existingName,
          conflict.existingMimeType
        );
      }
    }
    throw new Error(await readResponseMessage(sessionResponse, '업로드 세션을 만들지 못했습니다.'));
  }

  const session = (await sessionResponse.json()) as { uploadId: string; chunkSize: number };
  await uploadChunks({
    file: input.file,
    sessionId: session.uploadId,
    chunkSize: session.chunkSize,
    offset: 0,
    signal: input.signal,
    request: input.request,
    sleep: input.sleep,
    onProgress: input.onProgress
  });
  return session.uploadId;
}
