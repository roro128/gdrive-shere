export type WorkspaceLoadDecision<T> =
  { type: 'unauthorized' } | { type: 'files'; files: T[]; message?: string };

export function interpretWorkspaceFilesResponse<T>(input: {
  status: number;
  ok: boolean;
  files: T[];
  message?: string;
}): WorkspaceLoadDecision<T> {
  if (input.status === 401) return { type: 'unauthorized' };
  return {
    type: 'files',
    files: input.files,
    ...(input.ok ? {} : { message: input.message ?? '파일을 불러오지 못했습니다.' })
  };
}

export function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'AbortError';
}
