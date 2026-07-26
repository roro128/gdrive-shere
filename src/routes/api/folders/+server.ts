import type { RequestHandler } from './$types';
import { and, eq, sql } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database, newId, now } from '$lib/server/db';
import { createDriveFolder } from '$lib/server/google';
import { assertSameOrigin, badRequest, forbidden, readJson, ok } from '$lib/server/http';
import { driveFiles } from '$lib/server/drizzle/auth-schema';
import { ensureUserSpace, requireEditor, requireFolderAccess } from '$lib/server/space-access';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

export const POST: RequestHandler = async (event) => {
  const user = await requireUser(event);
  if (user.role === 'admin')
    forbidden('관리자는 사용자 파일을 업로드하거나 새 폴더를 만들 수 없습니다.');
  assertSameOrigin(event.request, event.url.origin);
  const input = await readJson<{ name?: string; parentId?: string | null }>(event.request);
  const name = input.name?.trim();
  if (!name) badRequest('폴더 이름이 필요합니다.');
  const parentId = input.parentId || (await ensureUserSpace(event, user));
  const parentAccess = requireEditor(await requireFolderAccess(event, user, parentId));
  const existing = await database(event)
    .select({ id: driveFiles.id })
    .from(driveFiles)
    .where(
      and(
        eq(driveFiles.parent_drive_id, parentId),
        eq(driveFiles.mime_type, FOLDER_MIME),
        eq(driveFiles.trashed, 0),
        sql`lower(${driveFiles.name}) = ${name.toLocaleLowerCase()}`
      )
    )
    .get();
  if (existing) badRequest('같은 이름의 폴더가 이미 있습니다. 다른 이름을 입력해주세요.');
  const folder = await createDriveFolder(event, name, parentId);
  await database(event)
    .insert(driveFiles)
    .values({
      id: newId(),
      drive_file_id: folder.id,
      name: folder.name,
      mime_type: folder.mimeType,
      size_bytes: 0,
      parent_drive_id: parentId,
      created_by: user.id,
      owner_user_id: parentAccess.ownerUserId,
      trashed: 0,
      created_at: now(),
      updated_at: now()
    })
    .run();
  return ok(
    {
      file: {
        ...folder,
        shared: parentAccess.permission !== 'owner',
        permission: parentAccess.permission,
        canShare: parentAccess.permission === 'owner'
      }
    },
    { status: 201 }
  );
};
