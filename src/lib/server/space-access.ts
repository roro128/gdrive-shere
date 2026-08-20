import type { RequestEvent } from '$lib/server/runtime';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';
import { database, newId, now, recordAudit, type DriveFileRow, type UserRow } from './db';
import { createDriveFolder, ensureRootFolder } from './google';
import { badRequest, forbidden, notFound } from './http';
import {
  driveFiles,
  folderShareInvitations,
  folderShares,
  users,
  userSpaces
} from './drizzle/auth-schema';
import {
  canManageFolderShares,
  normalizeShareSearchQuery,
  prepareRequestedShares,
  selectEligibleShareIds
} from '../share-management';
import { collectAccessPath, resolveFileAccess, type SpacePermission } from './space-access-model';
import { buildOwnedSharedFolderListings, mergeSharedFolderListings } from './shared-folder-model';
import { buildFolderShareMutations, buildShareInvitationResponse } from './share-persistence-model';
import { buildUserSpaceCreationRecords } from './db-record-model';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MAX_ANCESTOR_DEPTH = 64;

export interface SpaceAccess {
  file: DriveFileRow;
  ownerUserId: string;
  permission: SpacePermission;
}

export async function ensureUserSpace(event: RequestEvent, user: UserRow): Promise<string> {
  if (user.role === 'admin') forbidden('관리자 계정에는 개인 파일 공간이 없습니다.');
  const existing = await database(event)
    .select({ root_drive_id: userSpaces.root_drive_id })
    .from(userSpaces)
    .where(eq(userSpaces.user_id, user.id))
    .get();
  if (existing) return existing.root_drive_id;

  const appRootId = await ensureRootFolder(event);
  const label = `${user.display_name} · ${user.login_id ?? 'admin'}`.slice(0, 120);
  const folder = await createDriveFolder(event, label, appRootId);
  const records = buildUserSpaceCreationRecords(
    {
      driveFileId: folder.id,
      name: folder.name,
      mimeType: folder.mimeType,
      parentDriveId: appRootId,
      userId: user.id
    },
    { now, newId }
  );
  const d1 = event.platform?.env.DB;
  if (!d1) throw new Error('Cloudflare D1 binding DB is not configured');
  try {
    await d1.batch([
      d1
        .prepare(
          `INSERT INTO drive_files (
            id, drive_file_id, name, mime_type, size_bytes, parent_drive_id,
            created_by, owner_user_id, trashed, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?)`
        )
        .bind(
          records.driveFile.id,
          records.driveFile.drive_file_id,
          records.driveFile.name,
          records.driveFile.mime_type,
          records.driveFile.parent_drive_id,
          records.driveFile.created_by,
          records.driveFile.owner_user_id,
          records.driveFile.created_at,
          records.driveFile.updated_at
        ),
      d1
        .prepare('INSERT INTO user_spaces (user_id, root_drive_id, created_at) VALUES (?, ?, ?)')
        .bind(
          records.userSpace.user_id,
          records.userSpace.root_drive_id,
          records.userSpace.created_at
        )
    ]);
  } catch (cause) {
    const raced = await database(event)
      .select({ root_drive_id: userSpaces.root_drive_id })
      .from(userSpaces)
      .where(eq(userSpaces.user_id, user.id))
      .get();
    if (raced) return raced.root_drive_id;
    throw cause;
  }
  await recordAudit(event, user.id, 'space.created', folder.id);
  return folder.id;
}

async function fileAccess(
  event: RequestEvent,
  user: UserRow,
  driveFileId: string
): Promise<SpaceAccess | null> {
  const requested = await database(event)
    .select()
    .from(driveFiles)
    .where(eq(driveFiles.drive_file_id, driveFileId))
    .get();
  if (!requested) return null;

  if (user.role === 'admin') {
    return resolveFileAccess(requested, [requested], new Map(), user.id, true);
  }

  const path = await collectAccessPath(
    requested,
    user.id,
    {
      findShare: async (folderDriveId) => {
        const share = await database(event)
          .select({ permission: folderShares.permission })
          .from(folderShares)
          .where(
            and(eq(folderShares.folder_drive_id, folderDriveId), eq(folderShares.user_id, user.id))
          )
          .get();
        return share?.permission === 'viewer' ? 'viewer' : share ? 'editor' : null;
      },
      findParent: async (parentDriveId) =>
        (await database(event)
          .select()
          .from(driveFiles)
          .where(eq(driveFiles.drive_file_id, parentDriveId))
          .get()) ?? null
    },
    MAX_ANCESTOR_DEPTH
  );
  return resolveFileAccess(requested, path.ancestors, path.shares, user.id, false);
}

export async function requireFileAccess(
  event: RequestEvent,
  user: UserRow,
  driveFileId: string
): Promise<SpaceAccess> {
  const access = await fileAccess(event, user, driveFileId);
  if (!access) notFound('접근할 수 있는 파일이 아닙니다.');
  return access;
}

export async function requireFolderAccess(
  event: RequestEvent,
  user: UserRow,
  folderDriveId: string
): Promise<SpaceAccess> {
  const access = await requireFileAccess(event, user, folderDriveId);
  if (access.file.mime_type !== FOLDER_MIME || access.file.trashed)
    badRequest('사용할 수 있는 폴더가 아닙니다.');
  return access;
}

export function requireEditor(access: SpaceAccess): SpaceAccess {
  if (access.permission === 'viewer') forbidden('읽기 전용 공유 폴더에서는 변경할 수 없습니다.');
  return access;
}

export async function listSharedFolders(event: RequestEvent, user: UserRow) {
  const received = await database(event)
    .select({
      id: driveFiles.drive_file_id,
      name: driveFiles.name,
      mimeType: driveFiles.mime_type,
      modifiedTime: driveFiles.updated_at,
      ownerName: users.display_name,
      permission: folderShares.permission
    })
    .from(folderShares)
    .innerJoin(driveFiles, eq(driveFiles.drive_file_id, folderShares.folder_drive_id))
    .innerJoin(users, eq(users.id, driveFiles.owner_user_id))
    .where(and(eq(folderShares.user_id, user.id), eq(driveFiles.trashed, 0)))
    .all();

  const owned = await database(event)
    .select({
      id: driveFiles.drive_file_id,
      name: driveFiles.name,
      mimeType: driveFiles.mime_type,
      modifiedTime: driveFiles.updated_at
    })
    .from(driveFiles)
    .where(
      and(
        eq(driveFiles.owner_user_id, user.id),
        eq(driveFiles.mime_type, FOLDER_MIME),
        eq(driveFiles.trashed, 0)
      )
    )
    .all();

  const [accepted, pending] = owned.length
    ? await Promise.all([
        database(event)
          .select({ folderId: folderShares.folder_drive_id, displayName: users.display_name })
          .from(folderShares)
          .innerJoin(driveFiles, eq(driveFiles.drive_file_id, folderShares.folder_drive_id))
          .innerJoin(users, eq(users.id, folderShares.user_id))
          .where(
            and(
              eq(driveFiles.owner_user_id, user.id),
              eq(driveFiles.mime_type, FOLDER_MIME),
              eq(driveFiles.trashed, 0)
            )
          )
          .all(),
        database(event)
          .select({
            folderId: folderShareInvitations.folder_drive_id,
            displayName: users.display_name
          })
          .from(folderShareInvitations)
          .innerJoin(
            driveFiles,
            eq(driveFiles.drive_file_id, folderShareInvitations.folder_drive_id)
          )
          .innerJoin(users, eq(users.id, folderShareInvitations.invited_user_id))
          .where(
            and(
              eq(driveFiles.owner_user_id, user.id),
              eq(driveFiles.mime_type, FOLDER_MIME),
              eq(driveFiles.trashed, 0),
              eq(folderShareInvitations.status, 'pending')
            )
          )
          .all()
      ])
    : [[], []];
  const ownedShared = buildOwnedSharedFolderListings(owned, user.display_name, [
    ...accepted,
    ...pending
  ]);

  return mergeSharedFolderListings(received, ownedShared);
}

export async function listAdminSpaces(event: RequestEvent, admin: UserRow) {
  if (admin.role !== 'admin') forbidden('관리자 권한이 필요합니다.');
  return database(event)
    .select({
      id: userSpaces.root_drive_id,
      name: users.display_name,
      handle: users.handle,
      loginId: users.login_id,
      modifiedTime: userSpaces.created_at
    })
    .from(userSpaces)
    .innerJoin(users, eq(users.id, userSpaces.user_id))
    .where(and(eq(users.role, 'member'), eq(users.status, 'active')))
    .all();
}

export async function shareableUsers(
  event: RequestEvent,
  user: UserRow,
  query = '',
  excludedUserId = user.id
) {
  const normalized = normalizeShareSearchQuery(query);
  return database(event)
    .select({
      id: users.id,
      displayName: users.display_name,
      handle: users.handle,
      loginId: users.login_id,
      avatarUrl: users.avatar_url
    })
    .from(users)
    .where(
      and(
        eq(users.status, 'active'),
        ne(users.id, excludedUserId),
        normalized
          ? or(
              sql`lower(coalesce(${users.handle}, '')) LIKE ${`%${normalized}%`}`,
              sql`lower(coalesce(${users.login_id}, '')) LIKE ${`%${normalized}%`}`,
              sql`lower(${users.display_name}) LIKE ${`%${normalized}%`}`
            )
          : undefined
      )
    )
    .limit(20)
    .all();
}

export async function folderShareState(
  event: RequestEvent,
  manager: UserRow,
  folderDriveId: string
) {
  const access = await requireFolderAccess(event, manager, folderDriveId);
  if (!canManageFolderShares(access.permission))
    forbidden('폴더 소유자 또는 관리자만 공유 설정을 변경할 수 있습니다.');
  const shares = await database(event)
    .select({
      userId: folderShares.user_id,
      displayName: users.display_name,
      handle: users.handle,
      permission: folderShares.permission,
      status: folderShareInvitations.status
    })
    .from(folderShares)
    .innerJoin(users, eq(users.id, folderShares.user_id))
    .leftJoin(
      folderShareInvitations,
      and(
        eq(folderShareInvitations.folder_drive_id, folderShares.folder_drive_id),
        eq(folderShareInvitations.invited_user_id, folderShares.user_id)
      )
    )
    .where(eq(folderShares.folder_drive_id, folderDriveId))
    .all();
  const pending = await database(event)
    .select({
      userId: folderShareInvitations.invited_user_id,
      displayName: users.display_name,
      handle: users.handle,
      permission: folderShareInvitations.permission,
      status: folderShareInvitations.status
    })
    .from(folderShareInvitations)
    .innerJoin(users, eq(users.id, folderShareInvitations.invited_user_id))
    .where(
      and(
        eq(folderShareInvitations.folder_drive_id, folderDriveId),
        eq(folderShareInvitations.status, 'pending')
      )
    )
    .all();
  return {
    shares: [...shares, ...pending],
    users: await shareableUsers(event, manager, '', access.ownerUserId)
  };
}

export async function replaceFolderShares(
  event: RequestEvent,
  manager: UserRow,
  folderDriveId: string,
  requestedUsers: { userId: string; permission: 'viewer' | 'editor' }[]
) {
  const access = await requireFolderAccess(event, manager, folderDriveId);
  if (!canManageFolderShares(access.permission))
    forbidden('폴더 소유자 또는 관리자만 공유 설정을 변경할 수 있습니다.');

  const prepared = prepareRequestedShares(requestedUsers, access.ownerUserId);
  const { permissions, userIds: uniqueIds } = prepared;
  const eligible = uniqueIds.length
    ? await database(event)
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.status, 'active')))
        .all()
    : [];
  const eligibleSet = new Set(eligible.map((entry) => entry.id));
  const eligibleSelection = selectEligibleShareIds(uniqueIds, eligibleSet);
  if (eligibleSelection.hasIneligibleUsers)
    badRequest('공유 대상에 사용할 수 없는 사용자가 있습니다.');
  const userIds = eligibleSelection.userIds;

  const d1 = event.platform?.env.DB;
  if (!d1) throw new Error('Cloudflare D1 binding DB is not configured');
  const accepted = await database(event)
    .select({ userId: folderShareInvitations.invited_user_id })
    .from(folderShareInvitations)
    .where(
      and(
        eq(folderShareInvitations.folder_drive_id, folderDriveId),
        eq(folderShareInvitations.status, 'accepted')
      )
    )
    .all();
  const acceptedIds = new Set(accepted.map((entry) => entry.userId));
  const mutations = buildFolderShareMutations(
    folderDriveId,
    userIds,
    permissions,
    acceptedIds,
    manager.id,
    { now, newId }
  );
  await d1.batch(
    mutations.map((mutation) => {
      switch (mutation.kind) {
        case 'delete-grants':
          return d1
            .prepare('DELETE FROM folder_shares WHERE folder_drive_id = ?')
            .bind(mutation.folderId);
        case 'revoke-pending':
          return d1
            .prepare(
              "UPDATE folder_share_invitations SET status = 'revoked', responded_at = ? WHERE folder_drive_id = ? AND status = 'pending'"
            )
            .bind(mutation.respondedAt, mutation.folderId);
        case 'accept-invitation':
          return d1
            .prepare(
              "UPDATE folder_share_invitations SET permission = ?, status = 'accepted' WHERE folder_drive_id = ? AND invited_user_id = ?"
            )
            .bind(mutation.permission, mutation.folderId, mutation.userId);
        case 'insert-grant':
          return d1
            .prepare(
              'INSERT INTO folder_shares (id, folder_drive_id, user_id, permission, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'
            )
            .bind(
              mutation.id,
              mutation.folderId,
              mutation.userId,
              mutation.permission,
              mutation.createdBy,
              mutation.createdAt
            );
        case 'upsert-invitation':
          return d1
            .prepare(
              `INSERT INTO folder_share_invitations
          (id, folder_drive_id, invited_user_id, permission, invited_by, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)
         ON CONFLICT(folder_drive_id, invited_user_id) DO UPDATE SET permission = excluded.permission, status = 'pending', responded_at = NULL`
            )
            .bind(
              mutation.id,
              mutation.folderId,
              mutation.userId,
              mutation.permission,
              mutation.invitedBy,
              mutation.createdAt
            );
        default:
          throw new Error(`Unknown folder share mutation: ${String(mutation)}`);
      }
    })
  );
  await recordAudit(event, manager.id, 'folder.shares.updated', folderDriveId, {
    sharedUserCount: userIds.length
  });
  return folderShareState(event, manager, folderDriveId);
}

export async function listShareInvitations(event: RequestEvent, user: UserRow) {
  return database(event)
    .select({
      id: folderShareInvitations.id,
      folderId: folderShareInvitations.folder_drive_id,
      folderName: driveFiles.name,
      ownerName: users.display_name,
      permission: folderShareInvitations.permission,
      status: folderShareInvitations.status,
      createdAt: folderShareInvitations.created_at
    })
    .from(folderShareInvitations)
    .innerJoin(driveFiles, eq(driveFiles.drive_file_id, folderShareInvitations.folder_drive_id))
    .innerJoin(users, eq(users.id, folderShareInvitations.invited_by))
    .where(
      and(
        eq(folderShareInvitations.invited_user_id, user.id),
        eq(folderShareInvitations.status, 'pending'),
        eq(driveFiles.trashed, 0)
      )
    )
    .orderBy(desc(folderShareInvitations.created_at))
    .all();
}

export async function respondToShareInvitation(
  event: RequestEvent,
  user: UserRow,
  id: string,
  accept: boolean
) {
  const invitation = await database(event)
    .select()
    .from(folderShareInvitations)
    .where(
      and(
        eq(folderShareInvitations.id, id),
        eq(folderShareInvitations.invited_user_id, user.id),
        eq(folderShareInvitations.status, 'pending')
      )
    )
    .get();
  if (!invitation) notFound('공유 폴더 신청을 찾을 수 없습니다.');
  const d1 = event.platform?.env.DB;
  if (!d1) throw new Error('Cloudflare D1 binding DB is not configured');
  const mutations = buildShareInvitationResponse(
    {
      id: invitation.id,
      folderId: invitation.folder_drive_id,
      permission: invitation.permission === 'editor' ? 'editor' : 'viewer',
      invitedBy: invitation.invited_by
    },
    user.id,
    accept,
    { now, newId }
  );
  await d1.batch(
    mutations.map((mutation) => {
      switch (mutation.kind) {
        case 'decline-invitation':
          return d1
            .prepare(
              "UPDATE folder_share_invitations SET status = 'declined', responded_at = ? WHERE id = ?"
            )
            .bind(mutation.respondedAt, mutation.invitationId);
        case 'accept-invitation-response':
          return d1
            .prepare(
              "UPDATE folder_share_invitations SET status = 'accepted', responded_at = ? WHERE id = ?"
            )
            .bind(mutation.respondedAt, mutation.invitationId);
        case 'upsert-accepted-grant':
          return d1
            .prepare(
              'INSERT INTO folder_shares (id, folder_drive_id, user_id, permission, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(folder_drive_id, user_id) DO UPDATE SET permission = excluded.permission'
            )
            .bind(
              mutation.id,
              mutation.folderId,
              mutation.userId,
              mutation.permission,
              mutation.createdBy,
              mutation.createdAt
            );
        default:
          throw new Error(`Unknown invitation mutation: ${String(mutation)}`);
      }
    })
  );
  return { accepted: accept };
}
