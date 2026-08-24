export type GoogleAuthorizeOptions = {
  clientId: string;
  redirectUri: string;
  state: string;
  requestDriveAccess?: boolean;
  forceConsent?: boolean;
};

export function buildGoogleAuthorizeUrl(options: GoogleAuthorizeOptions): string {
  const requestDriveAccess = options.requestDriveAccess ?? false;
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: [
      'openid',
      'email',
      ...(requestDriveAccess
        ? [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.readonly'
          ]
        : [])
    ].join(' '),
    state: options.state,
    ...(requestDriveAccess ? { access_type: 'offline' } : {}),
    ...(options.forceConsent ? { prompt: 'consent' } : {})
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function quoteDrive(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

export function buildDriveListUrl(apiBase: string, parentId: string, search = ''): string {
  const normalizedSearch = search.trim().slice(0, 100);
  const clauses = [
    `${quoteDrive(parentId)} in parents`,
    'trashed = false',
    ...(normalizedSearch ? [`name contains ${quoteDrive(normalizedSearch)}`] : [])
  ];
  const params = new URLSearchParams({
    q: clauses.join(' and '),
    spaces: 'drive',
    pageSize: '1000',
    orderBy: 'folder,name',
    fields: 'files(id,name,mimeType,size,parents,trashed,modifiedTime,webContentLink,thumbnailLink)'
  });
  return `${apiBase}/files?${params}`;
}

export function buildDriveFolderBody(name: string, parentId: string): string {
  return JSON.stringify({
    name: name.trim().slice(0, 255),
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId]
  });
}

export type UploadSessionRequest = {
  method: 'POST' | 'PATCH';
  target: string;
  body: string;
};

export function buildUploadChunkHeaders(
  contentLength: string,
  mimeType: string,
  contentRange?: string
): Record<string, string> {
  return {
    'content-length': contentLength,
    'content-type': mimeType,
    ...(contentRange ? { 'content-range': contentRange } : {})
  };
}

export function buildDownloadHeaders(range?: string): Record<string, string> {
  return range ? { range } : {};
}

export type DriveFileUpdateRequest = {
  target: string;
  body: string;
};

export function buildDriveFileUpdateRequest(
  apiBase: string,
  fileId: string,
  changes: { name?: string; parentId?: string },
  currentParentId?: string
): DriveFileUpdateRequest {
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,size,parents,modifiedTime,trashed',
    ...(changes.parentId ? { addParents: changes.parentId } : {}),
    ...(changes.parentId && currentParentId ? { removeParents: currentParentId } : {})
  });
  return {
    target: `${apiBase}/files/${encodeURIComponent(fileId)}?${params}`,
    body: JSON.stringify(
      changes.name === undefined ? {} : { name: changes.name.trim().slice(0, 255) }
    )
  };
}

export function buildUploadSessionRequest(
  uploadBase: string,
  rootId: string,
  metadata: {
    name: string;
    mimeType: string;
    size: number;
    parentId: string | null;
    overwriteFileId?: string;
  }
): UploadSessionRequest {
  const target = metadata.overwriteFileId
    ? `${uploadBase}/${encodeURIComponent(metadata.overwriteFileId)}?uploadType=resumable`
    : `${uploadBase}?uploadType=resumable`;
  return {
    method: metadata.overwriteFileId ? 'PATCH' : 'POST',
    target,
    body: JSON.stringify({
      name: metadata.name.trim().slice(0, 255),
      mimeType: metadata.mimeType || 'application/octet-stream',
      ...(metadata.overwriteFileId ? {} : { parents: [metadata.parentId || rootId] })
    })
  };
}
