import { describe, expect, it } from 'vitest';
import {
  GoogleApiError,
  googleApiUserMessage,
  googleRequestError,
  parseGoogleJson
} from './google-http-model';

describe('google http model', () => {
  it('parses successful JSON and empty response bodies', () => {
    expect(
      parseGoogleJson<{ id: string }>({ ok: true, status: 200, body: '{"id":"file-1"}' })
    ).toEqual({
      id: 'file-1'
    });
    expect(parseGoogleJson({ ok: true, status: 204, body: '' })).toEqual({});
  });

  it('normalizes HTTP failures and malformed JSON as explicit errors', () => {
    expect(() =>
      parseGoogleJson({ ok: false, status: 403, body: 'forbidden'.repeat(100) })
    ).toThrow(googleRequestError(403, 'forbidden'.repeat(100)));
    const quotaError = (() => {
      try {
        parseGoogleJson({
          ok: false,
          status: 403,
          body: '{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}'
        });
      } catch (error) {
        return error;
      }
      return null;
    })();
    expect(quotaError).toBeInstanceOf(GoogleApiError);
    expect(googleApiUserMessage(quotaError as GoogleApiError)).toContain('저장 공간이 부족합니다');
    const revokedTokenError = (() => {
      try {
        parseGoogleJson({ ok: false, status: 400, body: '{"error":"invalid_grant"}' });
      } catch (error) {
        return error;
      }
      return null;
    })();
    expect(revokedTokenError).toBeInstanceOf(GoogleApiError);
    expect(googleApiUserMessage(revokedTokenError as GoogleApiError)).toContain('권한이 만료');
    const filePermissionError = new GoogleApiError(
      403,
      '{"error":{"errors":[{"reason":"insufficientFilePermissions"}]}}'
    );
    expect(googleApiUserMessage(filePermissionError)).toContain('파일 다운로드 권한');
    expect(() => parseGoogleJson({ ok: true, status: 200, body: '{invalid' })).toThrow(SyntaxError);
  });
});
