import type { RequestHandler } from '$lib/server/runtime';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database, now, type UserRow } from '$lib/server/db';
import { trashDriveFile, updateDriveFile } from '$lib/server/google';
import { assertSameOrigin, badRequest, forbidden, notFound, readJson, ok } from '$lib/server/http';
import {
  driveFiles,
  folderShareInvitations,
  folderShares,
  shareLinks,
  userSpaces
} from '$lib/server/drizzle/auth-schema';
import { requireEditor, requireFileAccess, requireFolderAccess } from '$lib/server/space-access';
import { wouldCreateFolderCycle } from '$lib/server/file-hierarchy-model';
import {
  buildStoredFileUpdate,
  hasFileUpdate,
  isCrossSpaceMove,
  isSelfParent,
  toTrashStateUpdate
} from '$lib/file-update-model';

async function knownFile(event: Parameters<RequestHandler>[0], user: UserRow, id: string) {
  const access = await requireFileAccess(event, user, id);
  if (access.file.trashed) notFound('앱에서 관리하는 파일이 아닙니다.');
  return access;
}

async function assertDoesNotModifyUserSpace(
  event: Parameters<RequestHandler>[0],
  driveFileId: string
) {
  const space = await database(event)
    .select({ user_id: userSpaces.user_id })
    .from(userSpaces)
    .where(eq(userSpaces.root_drive_id, driveFileId))
    .get();
  if (space) forbidden('사용자 개인 공간 자체는 변경하거나 삭제할 수 없습니다.');
}

async function assertNotSharedFolder(event: Parameters<RequestHandler>[0], driveFileId: string) {
  const share = await database(event)
    .select({ id: folderShares.id })
    .from(folderShares)
    .where(eq(folderShares.folder_drive_id, driveFileId))
    .get();
  const invitation = await database(event)
    .select({ id: folderShareInvitations.id })
    .from(folderShareInvitations)
    .where(
      and(
        eq(folderShareInvitations.folder_drive_id, driveFileId),
        eq(folderShareInvitations.status, 'pending')
      )
    )
    .get();
  if (share || invitation) forbidden('공유를 해제하기 전에는 공유 폴더를 삭제할 수 없습니다.');
}

async function assertNotDescendant(
  event: Parameters<RequestHandler>[0],
  driveFileId: string,
  targetParentId: string
) {
  const loadParentLinks = async (
    currentId: string | null,
    depth: number,
    links: ReadonlyMap<string, string | null>
  ): Promise<ReadonlyMap<string, string | null>> => {
    if (!currentId || depth >= 64) return links;
    const parent = await database(event)
      .select({ parent_drive_id: driveFiles.parent_drive_id })
      .from(driveFiles)
      .where(eq(driveFiles.drive_file_id, currentId))
      .get();
    const nextLinks = new Map([...links, [currentId, parent?.parent_drive_id ?? null]]);
    return parent ? loadParentLinks(parent.parent_drive_id, depth + 1, nextLinks) : nextLinks;
  };

  const parentLinks = await loadParentLinks(targetParentId, 0, new Map());
  if (wouldCreateFolderCycle(driveFileId, targetParentId, parentLinks))
    badRequest('폴더를 하위 폴더 안으로 이동할 수 없습니다.');
}

export const PATCH: RequestHandler = async (event) => {
  const user = await requireUser(event);
  assertSameOrigin(event.request, event.url.origin);
  const access = requireEditor(await knownFile(event, user, event.params.id));
  await assertDoesNotModifyUserSpace(event, access.file.drive_file_id);
  const file = access.file;
  const input = await readJson<{ name?: string; parentId?: string }>(event.request);
  if (!hasFileUpdate(input)) badRequest('변경할 이름 또는 폴더가 필요합니다.');
  if (input.parentId) {
    if (isSelfParent(file.drive_file_id, input.parentId))
      badRequest('파일 자신을 상위 폴더로 지정할 수 없습니다.');
    const target = requireEditor(await requireFolderAccess(event, user, input.parentId));
    if (isCrossSpaceMove(access.ownerUserId, target.ownerUserId))
      badRequest('개인 공간과 공유 공간 사이에서는 이동할 수 없습니다.');
    await assertNotDescendant(event, file.drive_file_id, input.parentId);
    if (file.mime_type === 'application/vnd.google-apps.folder') {
      const duplicate = await database(event)
        .select({ id: driveFiles.id })
        .from(driveFiles)
        .where(
          and(
            eq(driveFiles.parent_drive_id, input.parentId),
            eq(driveFiles.mime_type, file.mime_type),
            eq(driveFiles.trashed, 0),
            ne(driveFiles.drive_file_id, file.drive_file_id),
            sql`lower(${driveFiles.name}) = ${file.name.toLocaleLowerCase()}`
          )
        )
        .get();
      if (duplicate)
        return Response.json({ message: '같은 이름의 항목이 이미 있습니다.' }, { status: 409 });
    }
  }
  const updated = await updateDriveFile(event, file.drive_file_id, {
    name: input.name,
    parentId: input.parentId
  });
  await database(event)
    .update(driveFiles)
    .set(buildStoredFileUpdate(updated, file.parent_drive_id, now()))
    .where(eq(driveFiles.drive_file_id, file.drive_file_id))
    .run();
  return ok({ file: updated });
};

export const DELETE: RequestHandler = async (event) => {
  const user = await requireUser(event);
  assertSameOrigin(event.request, event.url.origin);
  const file = requireEditor(await knownFile(event, user, event.params.id)).file;
  await assertDoesNotModifyUserSpace(event, file.drive_file_id);
  if (file.mime_type === 'application/vnd.google-apps.folder')
    await assertNotSharedFolder(event, file.drive_file_id);
  const updated = await trashDriveFile(event, file.drive_file_id, true);
  const trashedAt = now();
  const db = database(event);
  await db.batch([
    db
      .update(driveFiles)
      .set(toTrashStateUpdate(true, trashedAt))
      .where(eq(driveFiles.drive_file_id, file.drive_file_id)),
    db
      .update(shareLinks)
      .set({ revoked_at: trashedAt })
      .where(and(eq(shareLinks.drive_file_id, file.drive_file_id), isNull(shareLinks.revoked_at)))
  ]);
  return ok({ file: updated });
};
