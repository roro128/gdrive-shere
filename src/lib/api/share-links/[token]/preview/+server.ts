import type { RequestHandler } from '$lib/server/runtime';
import { buildFileResponseHeaders } from '$lib/file-response-model';
import { downloadDriveFile } from '$lib/server/google';
import { notFound } from '$lib/server/http';
import { resolvePublicShareFile } from '$lib/server/share-link-access';
import { isPreviewableFile } from '$lib/workspace-model';

export const GET: RequestHandler = async (event) => {
  const file = await resolvePublicShareFile(event);
  if (!isPreviewableFile(file.mimeType)) notFound('미리보기를 지원하지 않는 파일입니다.');

  const upstream = await downloadDriveFile(event, file.fileId);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: new Headers({
      ...Object.fromEntries(upstream.headers),
      ...buildFileResponseHeaders(file.mimeType, file.name, 'inline'),
      'cache-control': 'private, no-store'
    })
  });
};
