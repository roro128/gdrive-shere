import { readResponseMessage } from './response-message';
import { shouldRetryUploadResponse, uploadRetryDelay } from './upload-flow-model';

export type UploadChunkWorkflowInput = {
  request: () => Promise<Response>;
  signal: AbortSignal;
  sleep: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
};

export async function uploadChunkWithRetry(
  input: UploadChunkWorkflowInput,
  attempt = 0
): Promise<Response> {
  let response: Response;
  try {
    response = await input.request();
  } catch (cause) {
    if (input.signal.aborted || attempt >= (input.maxAttempts ?? 3) - 1) throw cause;
    await input.sleep(uploadRetryDelay(attempt));
    return uploadChunkWithRetry(input, attempt + 1);
  }
  if (response.ok) return response;
  if (!shouldRetryUploadResponse(response.status, attempt, input.maxAttempts)) {
    throw new Error(await readResponseMessage(response, '업로드 청크를 전송하지 못했습니다.'));
  }
  await input.sleep(uploadRetryDelay(attempt));
  return uploadChunkWithRetry(input, attempt + 1);
}
