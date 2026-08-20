const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type ShareLinkFile = {
  mime_type: string;
  trashed: number;
};

export function buildShareLinkUrl(origin: string, token: string): string {
  return new URL(`/share/${encodeURIComponent(token)}`, origin).toString();
}

export function shareLinkError(file: ShareLinkFile): string | null {
  if (file.trashed) return '휴지통에 있는 파일은 공유할 수 없습니다.';
  if (file.mime_type === FOLDER_MIME) return '폴더 공유 링크는 아직 지원하지 않습니다.';
  return null;
}
