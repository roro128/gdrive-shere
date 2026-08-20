import { describe, expect, it } from 'vitest';
import { buildShareLinkUrl, shareLinkError } from './share-link-model';

describe('share link file policy', () => {
  it('builds a preview URL without putting the raw token in the query string', () => {
    expect(buildShareLinkUrl('https://gshare.test', 'token/a')).toBe(
      'https://gshare.test/share/token%2Fa'
    );
  });

  it('rejects trashed files before creating a link', () => {
    expect(shareLinkError({ mime_type: 'text/plain', trashed: 1 })).toBe(
      '휴지통에 있는 파일은 공유할 수 없습니다.'
    );
  });

  it('rejects folders and accepts active files', () => {
    expect(shareLinkError({ mime_type: 'application/vnd.google-apps.folder', trashed: 0 })).toBe(
      '폴더 공유 링크는 아직 지원하지 않습니다.'
    );
    expect(shareLinkError({ mime_type: 'text/plain', trashed: 0 })).toBeNull();
  });
});
