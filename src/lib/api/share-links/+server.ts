import type { RequestHandler } from '$lib/server/runtime';
import { and, eq, isNull } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database, newId, now } from '$lib/server/db';
import { assertSameOrigin, badRequest, notFound, ok, readJson } from '$lib/server/http';
import { randomToken, sha256 } from '$lib/server/crypto';
import { shareLinks } from '$lib/server/drizzle/auth-schema';
import { requireEditor, requireFileAccess } from '$lib/server/space-access';
import { buildShareLinkUrl, shareLinkError } from '$lib/server/share-link-model';

export const POST: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const user = await requireUser(event);
  const input = await readJson<{ fileId?: string }>(event.request);
  if (!input.fileId?.trim()) badRequest('공유할 파일이 필요합니다.');
  const access = await requireFileAccess(event, user, input.fileId);
  requireEditor(access);
  const fileError = shareLinkError(access.file);
  if (fileError) badRequest(fileError);

  const token = randomToken();
  const db = database(event);
  const createdAt = now();
  const revokeExisting = db
    .update(shareLinks)
    .set({ revoked_at: createdAt })
    .where(and(eq(shareLinks.drive_file_id, input.fileId), isNull(shareLinks.revoked_at)));
  const insertNew = db.insert(shareLinks).values({
    id: newId(),
    drive_file_id: input.fileId,
    token_hash: await sha256(token),
    created_by: user.id,
    created_at: createdAt,
    revoked_at: null
  });
  await db.batch([revokeExisting, insertNew]);
  return ok({ link: buildShareLinkUrl(event.url.origin, token) }, { status: 201 });
};

export const DELETE: RequestHandler = async (event) => {
  assertSameOrigin(event.request, event.url.origin);
  const user = await requireUser(event);
  const input = await readJson<{ linkId?: string }>(event.request);
  if (!input.linkId?.trim()) badRequest('해제할 공유 링크가 필요합니다.');
  const link = await database(event)
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.id, input.linkId))
    .get();
  if (!link) notFound('공유 링크를 찾을 수 없습니다.');
  const access = await requireFileAccess(event, user, link.drive_file_id);
  requireEditor(access);
  await database(event)
    .update(shareLinks)
    .set({ revoked_at: now() })
    .where(and(eq(shareLinks.id, link.id), isNull(shareLinks.revoked_at)))
    .run();
  return ok({ revoked: true });
};
