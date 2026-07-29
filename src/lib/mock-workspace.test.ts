import { beforeEach, describe, expect, it } from 'vitest';
import {
  createMockWorkspaceAdapter,
  createMockFolder,
  getMockFolderShares,
  listMockFiles,
  listMockShareUsers,
  listMockSharedFolders,
  moveMockFile,
  permanentlyDeleteMockFile,
  renameMockFile,
  resetMockWorkspace,
  restoreMockFile,
  saveMockFolderShares,
  trashMockFile,
  uploadMockFile
} from './mock-workspace';

beforeEach(() => resetMockWorkspace());

describe('mock workspace drag flow', () => {
  it('keeps adapter state isolated and accepts deterministic runtime effects', async () => {
    const first = createMockWorkspaceAdapter({
      now: () => '2026-07-29T00:00:00.000Z',
      newId: (prefix) => `${prefix}-deterministic`
    });
    const second = createMockWorkspaceAdapter({
      now: () => '2026-07-29T00:00:00.000Z',
      newId: (prefix) => `${prefix}-other`
    });

    const created = await first.createFolder('isolated', null);
    expect(created.ok).toBe(true);
    expect(first.listFiles(null)).toContainEqual(
      expect.objectContaining({ id: 'mock-folder-deterministic' })
    );
    expect(second.listFiles(null)).not.toContainEqual(
      expect.objectContaining({ name: 'isolated' })
    );
  });

  it('resets browser mock state to the initial fixture', async () => {
    await moveMockFile('mock-file-root', 'mock-folder-a');
    await saveMockFolderShares('mock-folder-a', [
      { userId: 'mock-member-1', permission: 'viewer' }
    ]);

    resetMockWorkspace();

    expect(listMockFiles(null)).toContainEqual(expect.objectContaining({ id: 'mock-file-root' }));
    expect(getMockFolderShares('mock-folder-a')).toEqual([]);
  });

  it('moves an uploaded file into a child folder and back to the workspace root', async () => {
    expect(listMockFiles(null).some((file) => file.id === 'mock-file-root')).toBe(true);

    const intoChild = await moveMockFile('mock-file-root', 'mock-folder-a');
    expect(intoChild.ok).toBe(true);
    expect(listMockFiles(null).some((file) => file.id === 'mock-file-root')).toBe(false);
    expect(listMockFiles('mock-folder-a').some((file) => file.id === 'mock-file-root')).toBe(true);

    const backToRoot = await moveMockFile('mock-file-root', 'mock-space');
    expect(backToRoot.ok).toBe(true);
    expect(listMockFiles(null).some((file) => file.id === 'mock-file-root')).toBe(true);
    expect(listMockFiles('mock-folder-a').some((file) => file.id === 'mock-file-root')).toBe(false);
  });

  it('rejects a missing folder target without changing the file location', async () => {
    const response = await moveMockFile('mock-file-root', 'missing-folder');

    expect(response.status).toBe(404);
    expect(listMockFiles(null).some((file) => file.id === 'mock-file-root')).toBe(true);
  });

  it('rejects moving a folder into one of its descendants', async () => {
    const created = await createMockFolder('순환 방지 폴더', 'mock-folder-a');
    const body = (await created.json()) as { file: { id: string } };
    const child = body.file;
    const response = await moveMockFile('mock-folder-a', child.id);

    expect(response.status).toBe(400);
    expect(listMockFiles(null).some((file) => file.id === 'mock-folder-a')).toBe(true);
  });

  it('adds a mock upload to the active folder and rejects duplicate names', async () => {
    const upload = await uploadMockFile('mock-upload.txt', 'text/plain', 4, null);
    expect(upload.status).toBe(200);
    expect(listMockFiles(null).some((file) => file.name === 'mock-upload.txt')).toBe(true);

    const duplicate = await uploadMockFile('MOCK-UPLOAD.TXT', 'text/plain', 4, null);
    expect(duplicate.status).toBe(409);
  });

  it('creates and renames folders while rejecting duplicate names', async () => {
    const created = await createMockFolder('모킹 폴더', null);
    expect(created.ok).toBe(true);
    const folder = listMockFiles(null).find((file) => file.name === '모킹 폴더');
    expect(folder).toBeDefined();

    const renamed = await renameMockFile(folder!.id, '이름 변경 폴더');
    expect(renamed.ok).toBe(true);
    expect(listMockFiles(null).some((file) => file.name === '이름 변경 폴더')).toBe(true);

    const duplicate = await createMockFolder('이름 변경 폴더', null);
    expect(duplicate.status).toBe(409);
  });

  it('does not create a folder inside a trashed folder', async () => {
    await trashMockFile('mock-folder-b');

    const response = await createMockFolder('휴지통 안 폴더', 'mock-folder-b');

    expect(response.status).toBe(404);
    await restoreMockFile('mock-folder-b');
  });

  it('keeps overwrite on the existing file but replaces with a new file', async () => {
    const overwriteUpload = await uploadMockFile('모킹 덮어쓰기.txt', 'text/plain', 1, null);
    const overwriteBody = (await overwriteUpload.json()) as { file: { id: string } };
    const overwrite = await uploadMockFile(
      '모킹 덮어쓰기.txt',
      'text/plain',
      2,
      null,
      'overwrite',
      overwriteBody.file.id
    );
    expect(overwrite.ok).toBe(true);
    const overwrittenBody = (await overwrite.json()) as { file: { id: string } };
    expect(overwrittenBody.file.id).toBe(overwriteBody.file.id);

    const replaceUpload = await uploadMockFile('모킹 교체.txt', 'text/plain', 1, null);
    const replaceBody = (await replaceUpload.json()) as { file: { id: string } };
    const replace = await uploadMockFile(
      '모킹 교체.txt',
      'text/plain',
      2,
      null,
      'replace',
      replaceBody.file.id
    );
    const replacedBody = (await replace.json()) as { file: { id: string } };
    expect(replace.ok).toBe(true);
    expect(replacedBody.file.id).not.toBe(replaceBody.file.id);
    expect(listMockFiles(null, '', true)).toContainEqual(
      expect.objectContaining({ id: replaceBody.file.id, trashed: true })
    );
  });

  it('moves items to and from the mocked trash', async () => {
    const trashed = await trashMockFile('mock-file-root');
    expect(trashed.ok).toBe(true);
    expect(listMockFiles(null)).not.toContainEqual(
      expect.objectContaining({ id: 'mock-file-root' })
    );
    expect(listMockFiles(null, '', true)).toContainEqual(
      expect.objectContaining({ id: 'mock-file-root', trashed: true })
    );
    const restored = await restoreMockFile('mock-file-root');
    expect(restored.ok).toBe(true);
    expect(listMockFiles(null)).toContainEqual(expect.objectContaining({ id: 'mock-file-root' }));
  });

  it('permanently deletes trashed files and their trashed descendants', async () => {
    const child = await createMockFolder('휴지통 하위 폴더', 'mock-folder-a');
    const childBody = (await child.json()) as { file: { id: string } };
    await trashMockFile('mock-folder-a');
    await trashMockFile(childBody.file.id);

    const deleted = await permanentlyDeleteMockFile('mock-folder-a');

    expect(deleted.ok).toBe(true);
    expect(listMockFiles(null, '', true)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'mock-folder-a' }),
        expect.objectContaining({ id: childBody.file.id })
      ])
    );
  });

  it('rejects permanent deletion for active files', async () => {
    await expect(permanentlyDeleteMockFile('mock-file-root')).resolves.toMatchObject({
      status: 400
    });
  });

  it('allows an active item to reuse a name after the old item is trashed', async () => {
    await trashMockFile('mock-file-root');
    const upload = await uploadMockFile('업로드 완료 파일.mp4', 'video/mp4', 12, null);

    expect(upload.ok).toBe(true);
    expect(listMockFiles(null)).toContainEqual(
      expect.objectContaining({ name: '업로드 완료 파일.mp4' })
    );
    const replacement = listMockFiles(null).find(
      (file) => file.name === '업로드 완료 파일.mp4' && file.id !== 'mock-file-root'
    );
    if (replacement) await trashMockFile(replacement.id);
    await restoreMockFile('mock-file-root');
  });

  it('saves folder shares and exposes them in the mocked shared view', async () => {
    const users = listMockShareUsers();
    const response = await saveMockFolderShares('mock-folder-a', [
      { userId: users[0].id, permission: 'editor' }
    ]);

    expect(response.ok).toBe(true);
    expect(getMockFolderShares('mock-folder-a')).toEqual([
      { userId: users[0].id, permission: 'editor' }
    ]);
    expect(listMockSharedFolders()).toContainEqual(
      expect.objectContaining({ id: 'mock-folder-a' })
    );
    expect(listMockFiles('mock-folder-a')).toContainEqual(
      expect.objectContaining({ id: 'mock-file-nested' })
    );
    await expect(trashMockFile('mock-folder-a')).resolves.toMatchObject({ status: 403 });
    await expect(saveMockFolderShares('mock-folder-a', [])).resolves.toMatchObject({ ok: true });
    expect(listMockSharedFolders()).not.toContainEqual(
      expect.objectContaining({ id: 'mock-folder-a' })
    );
    await expect(
      saveMockFolderShares('mock-folder-a', [{ userId: 'missing', permission: 'viewer' }])
    ).resolves.toMatchObject({ status: 400 });
  });
});
