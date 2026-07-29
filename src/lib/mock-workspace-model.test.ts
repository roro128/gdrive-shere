import { describe, expect, it } from 'vitest';
import {
  createFolder,
  createInitialMockWorkspace,
  moveFile,
  permanentlyDeleteFile,
  saveFolderShares,
  trashFile,
  uploadFile
} from './mock-workspace-model';

describe('mock workspace pure state transitions', () => {
  it('returns a new state for moves without mutating the input state', () => {
    const initial = createInitialMockWorkspace();
    const result = moveFile(initial, 'mock-file-root', 'mock-folder-a', '2026-07-29T00:00:00.000Z');

    expect(result.status).toBe(200);
    expect(initial.files.find((file) => file.id === 'mock-file-root')?.parents).toEqual([
      'mock-space'
    ]);
    expect(result.state.files.find((file) => file.id === 'mock-file-root')?.parents).toEqual([
      'mock-folder-a'
    ]);
  });

  it('Given a same-named item in the target folder When moving Then it rejects the duplicate', () => {
    const initial = createInitialMockWorkspace();
    const created = createFolder(
      initial,
      '하위 폴더 A',
      'mock-folder-b',
      'mock-duplicate',
      '2026-07-29T00:00:00.000Z'
    );

    const result = moveFile(
      created.state,
      'mock-folder-a',
      'mock-folder-b',
      '2026-07-29T00:01:00.000Z'
    );

    expect(result).toMatchObject({ status: 409, message: '같은 이름의 항목이 이미 있습니다.' });
    expect(result.state.files.find((file) => file.id === 'mock-folder-a')?.parents).toEqual([
      'mock-space'
    ]);
  });

  it('rejects trashing a shared folder without changing state', () => {
    const initial = createInitialMockWorkspace();
    const shared = saveFolderShares(initial, 'mock-folder-a', [
      { userId: 'mock-member-1', permission: 'viewer' }
    ]);
    const result = trashFile(shared.state, 'mock-folder-a', '2026-07-29T00:00:00.000Z');

    expect(result.status).toBe(403);
    expect(result.state.files.find((file) => file.id === 'mock-folder-a')?.trashed).toBeUndefined();
    expect(shared.state.folderShares.get('mock-folder-a')).toEqual([
      { userId: 'mock-member-1', permission: 'viewer' }
    ]);
  });

  it('overwrites a file in a new state while preserving its id', () => {
    const initial = createInitialMockWorkspace();
    const created = uploadFile(
      initial,
      'notes.txt',
      'text/plain',
      1,
      null,
      'mock-notes',
      '2026-07-29T00:00:00.000Z'
    );
    const overwritten = uploadFile(
      created.state,
      'notes.txt',
      'text/markdown',
      20,
      null,
      'unused-id',
      '2026-07-29T00:01:00.000Z',
      'overwrite',
      'mock-notes'
    );

    expect(overwritten.value).toMatchObject({
      id: 'mock-notes',
      mimeType: 'text/markdown',
      size: '20'
    });
    expect(created.state.files.find((file) => file.id === 'mock-notes')).toMatchObject({
      mimeType: 'text/plain',
      size: '1'
    });
  });

  it('deletes a trashed folder and all descendants, including their shares', () => {
    const initial = createInitialMockWorkspace();
    const created = createFolder(
      initial,
      'nested',
      'mock-folder-a',
      'mock-nested',
      '2026-07-29T00:00:00.000Z'
    );
    const shared = saveFolderShares(created.state, 'mock-nested', [
      { userId: 'mock-member-1', permission: 'editor' }
    ]);
    const trashed = trashFile(shared.state, 'mock-folder-a', '2026-07-29T00:01:00.000Z');
    const deleted = permanentlyDeleteFile(trashed.state, 'mock-folder-a');

    expect(deleted.status).toBe(200);
    expect(deleted.state.files.map((file) => file.id)).not.toEqual(
      expect.arrayContaining(['mock-folder-a', 'mock-file-nested', 'mock-nested'])
    );
    expect(deleted.state.folderShares.has('mock-nested')).toBe(false);
  });
});
