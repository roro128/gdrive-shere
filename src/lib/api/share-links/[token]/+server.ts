import type { RequestHandler } from '$lib/server/runtime';
import { downloadDriveFile } from '$lib/server/google';
import { buildFileResponseHeaders } from '$lib/file-response-model';
import { resolvePublicShareFile } from '$lib/server/share-link-access';

export const GET: RequestHandler = async (event) => {
  const file = await resolvePublicShareFile(event);
  const upstream = await downloadDriveFile(event, file.fileId);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: new Headers({
      ...Object.fromEntries(upstream.headers),
      ...buildFileResponseHeaders(file.mimeType, file.name, 'attachment'),
      'cache-control': 'private, no-store'
    })
  });
};
