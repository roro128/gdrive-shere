import { describe, expect, it } from 'vitest';
import {
  buildDownloadHeaders,
  buildDriveFileUpdateRequest,
  buildDriveFolderBody,
  buildDriveListUrl,
  buildGoogleAuthorizeUrl,
  buildUploadChunkHeaders,
  buildUploadSessionRequest
} from './google-request-model';

describe('Google request models', () => {
  it('builds upload chunk headers immutably with optional content range', () => {
    expect(buildUploadChunkHeaders('12', 'text/plain', 'bytes 0-11/20')).toEqual({
      'content-length': '12',
      'content-type': 'text/plain',
      'content-range': 'bytes 0-11/20'
    });
    expect(buildUploadChunkHeaders('0', 'application/octet-stream')).toEqual({
      'content-length': '0',
      'content-type': 'application/octet-stream'
    });
  });

  it('omits the download range header when no range was requested', () => {
    expect(buildDownloadHeaders()).toEqual({});
    expect(buildDownloadHeaders('bytes=0-10')).toEqual({ range: 'bytes=0-10' });
  });

  it('builds immutable Drive file update requests', () => {
    const request = buildDriveFileUpdateRequest(
      'https://drive.test/v3',
      'file/id',
      { name: '  renamed.txt  ', parentId: 'next' },
      'previous'
    );
    const url = new URL(request.target);

    expect(url.pathname).toBe('/v3/files/file%2Fid');
    expect(url.searchParams.get('addParents')).toBe('next');
    expect(url.searchParams.get('removeParents')).toBe('previous');
    expect(JSON.parse(request.body)).toEqual({ name: 'renamed.txt' });
  });

  it('builds OAuth scopes without consent options by default', () => {
    const url = new URL(
      buildGoogleAuthorizeUrl({
        clientId: 'client',
        redirectUri: 'https://gshare.test/callback',
        state: 'state'
      })
    );

    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.has('prompt')).toBe(false);
    expect(url.searchParams.has('access_type')).toBe(false);
  });

  it('escapes Drive search values and keeps the query bounded', () => {
    const url = new URL(
      buildDriveListUrl('https://www.googleapis.com/drive/v3', 'root', "O'Reilly")
    );

    expect(url.searchParams.get('q')).toBe(
      "'root' in parents and trashed = false and name contains 'O\\'Reilly'"
    );
  });

  it('normalizes folder names and upload metadata at the request boundary', () => {
    expect(JSON.parse(buildDriveFolderBody('  폴더  ', 'root'))).toEqual({
      name: '폴더',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root']
    });
    expect(
      buildUploadSessionRequest('https://upload.test/files', 'root', {
        name: '  sample.txt ',
        mimeType: '',
        size: 2,
        parentId: null
      })
    ).toEqual({
      method: 'POST',
      target: 'https://upload.test/files?uploadType=resumable',
      body: JSON.stringify({
        name: 'sample.txt',
        mimeType: 'application/octet-stream',
        parents: ['root']
      })
    });
  });
});
