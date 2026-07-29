import type { RequestHandler } from '$lib/server/runtime';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database, newId, now } from '$lib/server/db';
import { listDriveFiles } from '$lib/server/google';
import { ok } from '$lib/server/http';
import { canManageFolderShares } from '$lib/share-management';
import {
  driveFiles,
  folderShareInvitations,
  folderShares,
  users
} from '$lib/server/drizzle/auth-schema';
import { ensureUserSpace, requireFolderAccess } from '$lib/server/space-access';
import {
  buildDriveFileSyncInputs,
  collectSharedFolderIds,
  buildDriveFileSyncOperations,
  decorateListedFiles,
  folderIdsForSharedLookup,
  mapTrashedFiles
} from '$lib/server/file-list-model';

const LIST_CACHE_INIT = {
  headers: {
    'cache-control': 'private, max-age=15, stale-while-revalidate=45',
    vary: 'cookie'
  }
} satisfies ResponseInit;

export const GET: RequestHandler = async (event) => {
  const user = await requireUser(event);
  const trash = event.url.searchParams.get('trash') === '1';
  if (trash) {
    const search = event.url.searchParams.get('search')?.trim().toLowerCase() ?? '';
    const selection = {
      drive_file_id: driveFiles.drive_file_id,
      name: driveFiles.name,
      mime_type: driveFiles.mime_type,
      size_bytes: driveFiles.size_bytes,
      parent_drive_id: driveFiles.parent_drive_id,
      trashed: driveFiles.trashed,
      updated_at: driveFiles.updated_at,
      owner_name: users.display_name
    };
    const rows =
      user.role === 'admin'
        ? await database(event)
            .select(selection)
            .from(driveFiles)
            .innerJoin(users, eq(users.id, driveFiles.owner_user_id))
            .where(eq(driveFiles.trashed, 1))
            .orderBy(desc(driveFiles.updated_at))
            .all()
        : await database(event)
            .select({ ...selection, owner_name: driveFiles.owner_user_id })
            .from(driveFiles)
            .where(and(eq(driveFiles.trashed, 1), eq(driveFiles.owner_user_id, user.id)))
            .orderBy(desc(driveFiles.updated_at))
            .all();
    return ok(
      {
        files: mapTrashedFiles(rows, search, user.role === 'admin')
      },
      LIST_CACHE_INIT
    );
  }
  const parentId = event.url.searchParams.get('parentId') || (await ensureUserSpace(event, user));
  const parentAccess = await requireFolderAccess(event, user, parentId);
  const search = event.url.searchParams.get('search') ?? '';
  const files = await listDriveFiles(event, parentId, search);
  const syncOperations = buildDriveFileSyncOperations(
    buildDriveFileSyncInputs(files, { newId, now }),
    { parentId, ownerUserId: parentAccess.ownerUserId, createdBy: user.id }
  );
  if (syncOperations.length) {
    const db = database(event);
    const queries = syncOperations.map((operation) =>
      db.insert(driveFiles).values(operation.values).onConflictDoUpdate({
        target: driveFiles.drive_file_id,
        set: operation.update
      })
    );
    const [first, ...rest] = queries;
    if (first) await db.batch([first, ...rest] as [typeof first, ...typeof rest]);
  }
  const metadata = await database(event)
    .select({
      id: driveFiles.drive_file_id,
      uploadedBy: users.display_name,
      uploadedAt: driveFiles.created_at
    })
    .from(driveFiles)
    .leftJoin(users, eq(users.id, driveFiles.created_by))
    .where(eq(driveFiles.parent_drive_id, parentId))
    .all();
  const folderIds = folderIdsForSharedLookup(files);
  const sharedFolderIds = folderIds.length
    ? await (async () => {
        const [shares, invitations] = await Promise.all([
          database(event)
            .select({ id: folderShares.folder_drive_id })
            .from(folderShares)
            .where(inArray(folderShares.folder_drive_id, folderIds))
            .all(),
          database(event)
            .select({ id: folderShareInvitations.folder_drive_id })
            .from(folderShareInvitations)
            .where(
              and(
                inArray(folderShareInvitations.folder_drive_id, folderIds),
                eq(folderShareInvitations.status, 'pending')
              )
            )
            .all()
        ]);
        return collectSharedFolderIds(shares, invitations);
      })()
    : new Set<string>();
  return ok(
    {
      files: decorateListedFiles(
        files,
        metadata,
        sharedFolderIds,
        parentAccess.permission,
        canManageFolderShares(parentAccess.permission)
      )
    },
    LIST_CACHE_INIT
  );
};
