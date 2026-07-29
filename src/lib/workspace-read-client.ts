export type WorkspaceReadRequest = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export async function fetchWorkspaceFiles<T>(
  request: WorkspaceReadRequest,
  endpoint: string,
  signal: AbortSignal
): Promise<{ response: Response; files: T[]; message?: string }> {
  const response = await request(endpoint, { cache: 'no-store', signal });
  const result = (await response.json()) as { files?: T[]; message?: string };
  return { response, files: result.files ?? [], message: result.message };
}

export async function fetchStorageQuota<T>(request: WorkspaceReadRequest): Promise<T | null> {
  const response = await request('/api/storage');
  return response.ok ? ((await response.json()) as T) : null;
}
