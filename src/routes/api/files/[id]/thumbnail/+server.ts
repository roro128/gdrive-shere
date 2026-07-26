import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { requireFileAccess } from '$lib/server/space-access';
import { getDriveFileThumbnail } from '$lib/server/google';
import { notFound } from '$lib/server/http';

const THUMBNAIL_CACHE = {
  'cache-control': 'private, max-age=86400, stale-while-revalidate=604800',
  'content-security-policy': "default-src 'none'; img-src 'self' data:;",
  'x-content-type-options': 'nosniff'
};

export const GET: RequestHandler = async (event) => {
  const user = await requireUser(event);
  await requireFileAccess(event, user, event.params.id);
  const thumbnail = await getDriveFileThumbnail(event, event.params.id);
  if (!thumbnail) notFound('썸네일을 지원하지 않는 파일입니다.');

  const headers = new Headers(THUMBNAIL_CACHE);
  headers.set('content-type', thumbnail.headers.get('content-type') || 'image/jpeg');
  return new Response(thumbnail.body, { headers });
};
