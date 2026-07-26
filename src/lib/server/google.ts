import type { RequestEvent } from '@sveltejs/kit';
import { decrypt, encrypt } from './crypto';
import { getSetting, setSetting, type UploadSessionRow } from './db';
import { badRequest } from './http';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

function env(event: RequestEvent): Env {
  if (!event.platform?.env) throw new Error('Cloudflare environment is not configured');
  return event.platform.env;
}

function encryptionSecret(event: RequestEvent): string {
  const value = env(event).APP_ENCRYPTION_KEY;
  if (!value) throw new Error('APP_ENCRYPTION_KEY is not configured');
  return value;
}

function googleConfig(event: RequestEvent) {
  const runtime = env(event);
  const clientId = runtime.GOOGLE_CLIENT_ID?.replace(/^\uFEFF/, '').trim();
  const clientSecret = runtime.GOOGLE_CLIENT_SECRET?.replace(/^\uFEFF/, '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth client secrets are not configured');
  }
  return { runtime, clientId, clientSecret };
}

async function storedRefreshToken(event: RequestEvent): Promise<string | null> {
  const encrypted = await getSetting(event, 'google_refresh_token');
  return encrypted ? decrypt(encrypted, encryptionSecret(event)) : null;
}

async function accessToken(event: RequestEvent): Promise<string> {
  const refreshToken = await storedRefreshToken(event);
  if (!refreshToken) throw new Error('Google Drive가 아직 연결되지 않았습니다.');
  const { clientId, clientSecret } = googleConfig(event);
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  if (!response.ok) throw new Error('Google access token을 갱신하지 못했습니다.');
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error('Google access token이 응답되지 않았습니다.');
  return payload.access_token;
}

async function googleFetch(
  event: RequestEvent,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await accessToken(event);
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  const apiKey = env(event).GOOGLE_API_KEY;
  const target =
    apiKey && url.startsWith('https://www.googleapis.com/')
      ? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`
      : url;
  return fetch(target, { ...init, headers });
}

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) throw new Error(`Google API ${response.status}: ${text.slice(0, 500)}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function googleAuthorizeUrl(
  event: RequestEvent,
  state: string,
  options: { requestDriveAccess?: boolean; forceConsent?: boolean } = {}
): string {
  const { runtime, clientId } = googleConfig(event);
  const redirectUri = runtime.GOOGLE_REDIRECT_URI || `${event.url.origin}/api/auth/google/callback`;
  const requestDriveAccess = options.requestDriveAccess ?? false;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'openid',
      'email',
      ...(requestDriveAccess
        ? [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.metadata.readonly'
          ]
        : [])
    ].join(' '),
    state
  });
  if (requestDriveAccess) params.set('access_type', 'offline');
  if (options.forceConsent) params.set('prompt', 'consent');
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export interface GoogleConnection {
  refreshToken: string | null;
  email: string | null;
  subject: string | null;
  name: string | null;
}

export async function exchangeGoogleCode(
  event: RequestEvent,
  code: string
): Promise<GoogleConnection> {
  const { runtime, clientId, clientSecret } = googleConfig(event);
  const redirectUri = runtime.GOOGLE_REDIRECT_URI || `${event.url.origin}/api/auth/google/callback`;
  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });
  const tokenPayload = await responseJson<{ refresh_token?: string; access_token?: string }>(
    tokenResponse
  );
  let email: string | null = null;
  let subject: string | null = null;
  let name: string | null = null;
  if (tokenPayload.access_token) {
    const profile = await fetch(USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${tokenPayload.access_token}` }
    });
    if (profile.ok) {
      const payload = (await profile.json()) as { email?: string; sub?: string; name?: string };
      email = payload.email ?? null;
      subject = payload.sub ?? null;
      name = payload.name ?? null;
    }
  }
  return { refreshToken: tokenPayload.refresh_token ?? null, email, subject, name };
}

export async function persistGoogleConnection(
  event: RequestEvent,
  connection: GoogleConnection
): Promise<void> {
  if (!connection.refreshToken) {
    if (await storedRefreshToken(event)) return;
    throw new Error('Google refresh token이 발급되지 않았습니다. Drive 연결을 다시 시도해주세요.');
  }
  await setSetting(
    event,
    'google_refresh_token',
    await encrypt(connection.refreshToken, encryptionSecret(event))
  );
  await setSetting(event, 'google_account_email', connection.email ?? 'connected');
  await ensureRootFolder(event);
}

export async function ensureRootFolder(event: RequestEvent): Promise<string> {
  const existing = await getSetting(event, 'drive_root_id');
  if (existing) return existing;
  const response = await googleFetch(event, `${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'GDrive Share', mimeType: 'application/vnd.google-apps.folder' })
  });
  const folder = await responseJson<{ id?: string }>(response);
  if (!folder.id) throw new Error('GDrive Share 루트 폴더를 만들지 못했습니다.');
  await setSetting(event, 'drive_root_id', folder.id);
  return folder.id;
}

export async function driveConnected(event: RequestEvent): Promise<boolean> {
  return Boolean(await getSetting(event, 'google_refresh_token'));
}

export type DriveStorageQuota = {
  limit: number | null;
  usage: number;
};

export async function getDriveStorageQuota(event: RequestEvent): Promise<DriveStorageQuota> {
  const response = await googleFetch(event, `${DRIVE_API}/about?fields=storageQuota`);
  const payload = await responseJson<{
    storageQuota?: { limit?: string; usage?: string };
  }>(response);
  const limit = payload.storageQuota?.limit ? Number(payload.storageQuota.limit) : null;
  const usage = Number(payload.storageQuota?.usage ?? 0);
  return {
    limit: limit !== null && Number.isFinite(limit) ? limit : null,
    usage: Number.isFinite(usage) ? usage : 0
  };
}

function quoteDrive(value: string): string {
  return `'${value.replaceAll("'", "\\'")}'`;
}

export interface DriveApiFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  trashed?: boolean;
  modifiedTime?: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

export async function listDriveFiles(
  event: RequestEvent,
  parentId: string | null,
  search = ''
): Promise<DriveApiFile[]> {
  const rootId = await ensureRootFolder(event);
  const parent = parentId || rootId;
  const clauses = [`${quoteDrive(parent)} in parents`, 'trashed = false'];
  if (search.trim()) clauses.push(`name contains ${quoteDrive(search.trim().slice(0, 100))}`);
  const params = new URLSearchParams({
    q: clauses.join(' and '),
    spaces: 'drive',
    pageSize: '1000',
    orderBy: 'folder,name',
    fields: 'files(id,name,mimeType,size,parents,trashed,modifiedTime,webContentLink,thumbnailLink)'
  });
  const response = await googleFetch(event, `${DRIVE_API}/files?${params}`);
  const payload = await responseJson<{ files?: DriveApiFile[] }>(response);
  return payload.files ?? [];
}

export async function createDriveFolder(
  event: RequestEvent,
  name: string,
  parentId: string | null
): Promise<DriveApiFile> {
  const rootId = await ensureRootFolder(event);
  const response = await googleFetch(
    event,
    `${DRIVE_API}/files?fields=id,name,mimeType,parents,modifiedTime`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: name.trim().slice(0, 255),
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId || rootId]
      })
    }
  );
  return responseJson<DriveApiFile>(response);
}

export async function updateDriveFile(
  event: RequestEvent,
  fileId: string,
  changes: { name?: string; parentId?: string }
): Promise<DriveApiFile> {
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,size,parents,modifiedTime,trashed'
  });
  const body: Record<string, unknown> = {};
  if (changes.name !== undefined) body.name = changes.name.trim().slice(0, 255);
  if (changes.parentId) {
    const current = await googleFetch(
      event,
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=parents`
    );
    const currentFile = await responseJson<{ parents?: string[] }>(current);
    params.set('addParents', changes.parentId);
    if (currentFile.parents?.[0]) params.set('removeParents', currentFile.parents[0]);
  }
  return responseJson<DriveApiFile>(
    await googleFetch(event, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?${params}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  );
}

export async function trashDriveFile(
  event: RequestEvent,
  fileId: string,
  trashed: boolean
): Promise<DriveApiFile> {
  return responseJson<DriveApiFile>(
    await googleFetch(
      event,
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,trashed`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trashed })
      }
    )
  );
}

export async function deleteDriveFile(event: RequestEvent, fileId: string): Promise<void> {
  await responseJson<unknown>(
    await googleFetch(event, `${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE'
    })
  );
}

export async function createUploadSession(
  event: RequestEvent,
  metadata: {
    name: string;
    mimeType: string;
    size: number;
    parentId: string | null;
    overwriteFileId?: string;
  }
): Promise<{ location: string }> {
  const rootId = await ensureRootFolder(event);
  const target = metadata.overwriteFileId
    ? `${DRIVE_UPLOAD_API}/${encodeURIComponent(metadata.overwriteFileId)}?uploadType=resumable`
    : `${DRIVE_UPLOAD_API}?uploadType=resumable`;
  const response = await googleFetch(event, target, {
    method: metadata.overwriteFileId ? 'PATCH' : 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': metadata.mimeType,
      'x-upload-content-length': String(metadata.size)
    },
    body: JSON.stringify({
      name: metadata.name.trim().slice(0, 255),
      mimeType: metadata.mimeType || 'application/octet-stream',
      ...(metadata.overwriteFileId ? {} : { parents: [metadata.parentId || rootId] })
    })
  });
  if (!response.ok) throw new Error(`Google upload session ${response.status}`);
  const location = response.headers.get('location');
  if (!location) throw new Error('Google upload session URL이 없습니다.');
  return { location };
}

export async function uploadChunk(
  event: RequestEvent,
  session: UploadSessionRow
): Promise<Response> {
  if (!event.request.body) badRequest('업로드 chunk 본문이 없습니다.');
  const contentLength = event.request.headers.get('content-length');
  const contentRange = event.request.headers.get('content-range');
  if (!contentLength || (session.total_bytes > 0 && !contentRange))
    badRequest('Content-Length와 Content-Range가 필요합니다.');
  const headers = new Headers({
    'content-length': contentLength,
    'content-type': session.mime_type
  });
  if (contentRange) headers.set('content-range', contentRange);
  return fetch(session.drive_session_url, {
    method: 'PUT',
    headers,
    body: event.request.body
  });
}

export async function queryUploadSession(session: UploadSessionRow): Promise<Response> {
  return fetch(session.drive_session_url, {
    method: 'PUT',
    headers: { 'content-range': `bytes */${session.total_bytes}` }
  });
}

export async function downloadDriveFile(event: RequestEvent, fileId: string): Promise<Response> {
  const headers = new Headers();
  const range = event.request.headers.get('range');
  if (range) headers.set('range', range);
  const response = await googleFetch(
    event,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google download ${response.status}: ${text.slice(0, 300)}`);
  }
  return response;
}

export async function getDriveFileThumbnail(
  event: RequestEvent,
  fileId: string
): Promise<Response | null> {
  const metadata = await googleFetch(
    event,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=mimeType,thumbnailLink`
  );
  if (!metadata.ok) return null;
  const payload = await responseJson<{ mimeType?: string; thumbnailLink?: string }>(metadata);
  if (
    !payload.thumbnailLink ||
    (!payload.mimeType?.startsWith('image/') && !payload.mimeType?.startsWith('video/'))
  ) {
    return null;
  }
  const thumbnail = await fetch(payload.thumbnailLink);
  return thumbnail.ok ? thumbnail : null;
}
