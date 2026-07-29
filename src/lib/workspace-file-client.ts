export type WorkspaceRequest = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonRequest(body: unknown): RequestInit {
  return {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

export function createFolder(
  request: WorkspaceRequest,
  name: string,
  parentId: string | null
): Promise<Response> {
  return request('/api/folders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, parentId })
  });
}

export function renameFile(
  request: WorkspaceRequest,
  fileId: string,
  name: string
): Promise<Response> {
  return request(`/api/files/${fileId}`, jsonRequest({ name }));
}

export function moveFile(
  request: WorkspaceRequest,
  fileId: string,
  parentId: string
): Promise<Response> {
  return request(`/api/files/${fileId}`, jsonRequest({ parentId }));
}

export function trashFile(request: WorkspaceRequest, fileId: string): Promise<Response> {
  return request(`/api/files/${fileId}`, { method: 'DELETE' });
}

export function restoreFile(request: WorkspaceRequest, fileId: string): Promise<Response> {
  return request(`/api/files/${fileId}/restore`, { method: 'POST' });
}

export function permanentlyDeleteFile(
  request: WorkspaceRequest,
  fileId: string
): Promise<Response> {
  return request(`/api/files/${fileId}/permanent`, { method: 'DELETE' });
}
