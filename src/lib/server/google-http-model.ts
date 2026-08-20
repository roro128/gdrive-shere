export class GoogleApiError extends Error {
  readonly reason: string | null;

  constructor(
    readonly status: number,
    body: string
  ) {
    super(googleRequestError(status, body));
    this.name = 'GoogleApiError';
    this.reason = googleErrorReason(body);
  }
}

export function parseGoogleJson<T>(input: { ok: boolean; status: number; body: string }): T {
  if (!input.ok) throw new GoogleApiError(input.status, input.body);
  return input.body ? (JSON.parse(input.body) as T) : ({} as T);
}

export function googleRequestError(status: number, body: string): string {
  return `Google API ${status}: ${body.slice(0, 500)}`;
}

function googleErrorReason(body: string): string | null {
  try {
    const payload = JSON.parse(body) as {
      error?: string | { errors?: Array<{ reason?: unknown }> };
    };
    if (typeof payload.error === 'string') return payload.error;
    const reason = payload.error?.errors?.find((item) => typeof item.reason === 'string')?.reason;
    return typeof reason === 'string' ? reason : null;
  } catch {
    return null;
  }
}

export function googleApiUserMessage(error: GoogleApiError): string {
  if (error.reason === 'storageQuotaExceeded')
    return 'Google Drive 저장 공간이 부족합니다. 기존 파일을 정리한 뒤 다시 시도해주세요.';
  if (error.reason === 'invalid_grant')
    return 'Google Drive 연결 권한이 만료되었습니다. 관리자 Google 계정으로 Drive 연결을 한 번만 다시 완료해주세요.';
  if (
    error.reason === 'insufficientFilePermissions' ||
    error.reason === 'cannotDownloadFile' ||
    error.reason === 'fileNotDownloadable'
  )
    return 'Google Drive 파일 다운로드 권한이 없습니다. 관리자에게 Drive 연결을 다시 요청해주세요.';
  if (error.status === 401 || error.reason === 'authError')
    return 'Google Drive 연결이 만료되었습니다. 관리자에게 Drive 연결을 다시 요청해주세요.';
  return 'Google Drive 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
}
