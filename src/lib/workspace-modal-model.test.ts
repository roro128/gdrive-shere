import { describe, expect, it } from 'vitest';
import { initialWorkspaceModalState, workspaceModalReducer } from './workspace-modal-model';

describe('workspaceModalReducer', () => {
  it('resets new-folder transient state when closed', () => {
    const initial = initialWorkspaceModalState<{ id: string }>();
    const open = workspaceModalReducer(initial, { type: 'open-new-folder' });
    const edited = workspaceModalReducer(open, { type: 'set-new-folder-name', name: 'Reports' });
    const failed = workspaceModalReducer(edited, { type: 'set-new-folder-error', error: 'failed' });
    const closed = workspaceModalReducer(failed, { type: 'close-new-folder' });

    expect(closed.newFolder).toEqual({ open: false, name: '', error: '', busy: false });
    expect(initial.newFolder).toEqual({ open: false, name: '', error: '', busy: false });
  });

  it('keeps rename and invite transitions immutable and scoped', () => {
    const file = { id: 'file-1' };
    const initial = initialWorkspaceModalState<typeof file>();
    const renamed = workspaceModalReducer(initial, { type: 'open-rename', file, name: 'old.txt' });
    const busy = workspaceModalReducer(renamed, { type: 'set-rename-busy', busy: true });
    const invited = workspaceModalReducer(busy, { type: 'open-invite', link: '/invite/1' });

    expect(invited.rename).toEqual({ file, name: 'old.txt', busy: true });
    expect(invited.invite).toEqual({ open: true, link: '/invite/1', busy: false });
    expect(initial.rename).toEqual({ file: null, name: '', busy: false });
  });
});
