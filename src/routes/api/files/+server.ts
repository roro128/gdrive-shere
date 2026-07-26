import type { RequestHandler } from './$types';
import { and, desc, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth';
import { database, newId, now } from '$lib/server/db';
import { listDriveFiles } from '$lib/server/google';
import { ok } from '$lib/server/http';
import { driveFiles, users } from '$lib/server/drizzle/auth-schema';
import { ensureUserSpace, requireFolderAccess } from '$lib/server/space-access';

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
        files: rows
          .filter((file) => !search || file.name.toLowerCase().includes(search.slice(0, 100)))
          .map((file) => ({
            id: file.drive_file_id,
            name: file.name,
            mimeType: file.mime_type,
            size: String(file.size_bytes),
            parents: file.parent_drive_id ? [file.parent_drive_id] : [],
            trashed: Boolean(file.trashed),
            modifiedTime: file.updated_at,
            ownerName: user.role === 'admin' ? file.owner_name : undefined
          }))
      },
      LIST_CACHE_INIT
    );
  }
  const parentId = event.url.searchParams.get('parentId') || (await ensureUserSpace(event, user));
  const parentAccess = await requireFolderAccess(event, user, parentId);
  const search = event.url.searchParams.get('search') ?? '';
  const files = await listDriveFiles(event, parentId, search);
  for (const file of files) {
    await database(event)
      .insert(driveFiles)
      .values({
        id: newId(),
        drive_file_id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        size_bytes: Number(file.size ?? 0),
        parent_drive_id: file.parents?.[0] ?? parentId,
        created_by: user.id,
        owner_user_id: parentAccess.ownerUserId,
        trashed: file.trashed ? 1 : 0,
        created_at: now(),
        updated_at: file.modifiedTime ?? now()
      })
      .onConflictDoUpdate({
        target: driveFiles.drive_file_id,
        set: {
          name: file.name,
          mime_type: file.mimeType,
          size_bytes: Number(file.size ?? 0),
          parent_drive_id: file.parents?.[0] ?? parentId,
          owner_user_id: parentAccess.ownerUserId,
          trashed: file.trashed ? 1 : 0,
          updated_at: file.modifiedTime ?? now()
        }
      })
      .run();
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
  const metadataById = new Map(metadata.map((item) => [item.id, item]));
  return ok(
    {
      files: files.map((file) => ({
        ...file,
        uploadedBy: metadataById.get(file.id)?.uploadedBy ?? undefined,
        uploadedAt: metadataById.get(file.id)?.uploadedAt ?? undefined,
        shared: parentAccess.permission === 'editor',
        permission: parentAccess.permission,
        canShare:
          user.role !== 'admin' &&
          parentAccess.permission === 'owner' &&
          file.mimeType === 'application/vnd.google-apps.folder'
      }))
    },
    LIST_CACHE_INIT
  );
};
