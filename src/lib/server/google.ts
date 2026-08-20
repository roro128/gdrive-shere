import type { RequestEvent } from '$lib/server/runtime';
import type { GoogleConnectionStatus } from '$lib/google-connection-status';
import { decrypt, encrypt } from './crypto';
import { getSetting, setSetting, type UploadSessionRow } from './db';
import { badRequest, payloadTooLarge } from './http';
import { GoogleApiError, parseGoogleJson } from './google-http-model';
import {
  buildDriveFileUpdateRequest,
  buildDriveFolderBody,
  buildDriveListUrl,
  buildDownloadHeaders,
  buildGoogleAuthorizeUrl,
  buildUploadChunkHeaders,
  buildUploadSessionRequest
} from './google-request-model';
import {
  normalizeStorageQuota,
  planGoogleConnectionPersistence,
  toGoogleConnection,
  toGoogleToken,
  type GoogleConnection,
  type GoogleProfilePayload,
  type GoogleTokenPayload
} from './google-response-model';
import { validateUploadChunk } from './upload-utils';

export type { GoogleConnection } from './google-response-model';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const accessTokenRequests = new WeakMap<RequestEvent, Promise<string>>();

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

async function refreshAccessToken(event: RequestEvent): Promise<string> {
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
  const token = toGoogleToken(await responseJson<GoogleTokenPayload>(response));
  if (!token.accessToken) throw new Error('Google access token이 응답되지 않았습니다.');
  if (token.refreshToken && token.refreshToken !== refreshToken) {
    await setSetting(
      event,
      'google_refresh_token',
      await encrypt(token.refreshToken, encryptionSecret(event))
    );
  }
  return token.accessToken;
}

async function accessToken(event: RequestEvent): Promise<string> {
  const existing = accessTokenRequests.get(event);
  if (existing) return existing;

  const request = refreshAccessToken(event);
  accessTokenRequests.set(event, request);
  try {
    return await request;
  } catch (cause) {
    accessTokenRequests.delete(event);
    throw cause;
  }
}

async function googleRequest(
  event: RequestEvent,
  url: string,
  init: RequestInit
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

async function googleFetch(
  event: RequestEvent,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const response = await googleRequest(event, url, init);
  if (response.status !== 401) return response;

  await response.body?.cancel();
  accessTokenRequests.delete(event);
  return googleRequest(event, url, init);
}

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return parseGoogleJson<T>({ ok: response.ok, status: response.status, body: text });
}

async function currentDriveParentId(
  event: RequestEvent,
  fileId: string,
  shouldRead: boolean
): Promise<string | undefined> {
  if (!shouldRead) return undefined;
  const response = await googleFetch(
    event,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=parents`
  );
  const file = await responseJson<{ parents?: string[] }>(response);
  return file.parents?.[0];
}

export function googleAuthorizeUrl(
  event: RequestEvent,
  state: string,
  options: { requestDriveAccess?: boolean; forceConsent?: boolean } = {}
): string {
  const { runtime, clientId } = googleConfig(event);
  const redirectUri = runtime.GOOGLE_REDIRECT_URI || `${event.url.origin}/api/auth/google/callback`;
  return buildGoogleAuthorizeUrl({ clientId, redirectUri, state, ...options });
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
  const tokenPayload = await responseJson<GoogleTokenPayload>(tokenResponse);
  const token = toGoogleToken(tokenPayload);
  const profilePayload = token.accessToken
    ? await fetch(USERINFO_ENDPOINT, {
        headers: { authorization: `Bearer ${token.accessToken}` }
      }).then(async (profile) =>
        profile.ok ? ((await profile.json()) as GoogleProfilePayload) : undefined
      )
    : undefined;
  return toGoogleConnection(tokenPayload, profilePayload);
}

export async function persistGoogleConnection(
  event: RequestEvent,
  connection: GoogleConnection
): Promise<void> {
  const plan = planGoogleConnectionPersistence(
    connection,
    Boolean(await storedRefreshToken(event))
  );
  if (plan.kind === 'reuse-existing') return;
  if (plan.kind === 'error') throw new Error(plan.message);
  await setSetting(
    event,
    'google_refresh_token',
    await encrypt(plan.refreshToken, encryptionSecret(event))
  );
  await setSetting(event, 'google_account_email', plan.email);
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

export async function getGoogleConnectionStatus(
  event: RequestEvent
): Promise<GoogleConnectionStatus> {
  if (!(await getSetting(event, 'google_refresh_token'))) return 'missing';
  try {
    const response = await googleFetch(event, `${DRIVE_API}/about?fields=storageQuota`);
    if (response.ok) {
      await response.arrayBuffer();
      return 'connected';
    }
    const error = new GoogleApiError(response.status, await response.text());
    return error.status === 401 || error.reason === 'invalid_grant'
      ? 'reauthorization-required'
      : 'unavailable';
  } catch (cause) {
    return cause instanceof GoogleApiError && cause.reason === 'invalid_grant'
      ? 'reauthorization-required'
      : 'unavailable';
  }
}

export async function driveConnected(event: RequestEvent): Promise<boolean> {
  return (await getGoogleConnectionStatus(event)) === 'connected';
}

export type DriveStorageQuota = {
  limit: number | null;
  usage: number;
};

export async function getDriveStorageQuota(event: RequestEvent): Promise<DriveStorageQuota> {
  const response = await googleFetch(event, `${DRIVE_API}/about?fields=storageQuota`);
  const payload = await responseJson<{ storageQuota?: { limit?: string; usage?: string } }>(
    response
  );
  return normalizeStorageQuota(payload);
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
  const response = await googleFetch(event, buildDriveListUrl(DRIVE_API, parent, search));
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
      body: buildDriveFolderBody(name, parentId || rootId)
    }
  );
  return responseJson<DriveApiFile>(response);
}

export async function updateDriveFile(
  event: RequestEvent,
  fileId: string,
  changes: { name?: string; parentId?: string }
): Promise<DriveApiFile> {
  const currentParentId = await currentDriveParentId(event, fileId, Boolean(changes.parentId));
  const update = buildDriveFileUpdateRequest(DRIVE_API, fileId, changes, currentParentId);
  return responseJson<DriveApiFile>(
    await googleFetch(event, update.target, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: update.body
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
  const uploadRequest = buildUploadSessionRequest(DRIVE_UPLOAD_API, rootId, metadata);
  const response = await googleFetch(event, uploadRequest.target, {
    method: uploadRequest.method,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': metadata.mimeType,
      'x-upload-content-length': String(metadata.size)
    },
    body: uploadRequest.body
  });
  if (!response.ok) throw new GoogleApiError(response.status, await response.text());
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
  const validation = validateUploadChunk(contentLength, contentRange, session.total_bytes);
  if (!validation.valid) {
    if (validation.status === 413) payloadTooLarge(validation.message);
    badRequest(validation.message);
  }
  return fetch(session.drive_session_url, {
    method: 'PUT',
    headers: buildUploadChunkHeaders(
      String(validation.contentLength),
      session.mime_type,
      contentRange ?? undefined
    ),
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
  const range = event.request.headers.get('range');
  const response = await googleFetch(
    event,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: buildDownloadHeaders(range ?? undefined) }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new GoogleApiError(response.status, text);
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
