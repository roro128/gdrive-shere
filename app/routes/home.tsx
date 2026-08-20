import {
  Fragment,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent
} from 'react';
import { authClient } from '../../src/lib/client';
import {
  createMemberInvitation,
  createMemberResetLink,
  createPasswordResetRequestLink,
  listMembers,
  listPasswordResetRequests,
  updateMemberStatus as updateMemberStatusRequest
} from '../../src/lib/admin-client';
import {
  ACCOUNT_DELETION_CONFIRMATION,
  accountDeletionScope
} from '../../src/lib/account-deletion';
import { normalizeHandle } from '../../src/lib/handle-availability';
import {
  createInternalDragPayload,
  firstInternalDragId,
  moveFiles,
  readInternalDragIds,
  resolveInternalDragIds
} from '../../src/lib/file-move';
import { buildShareGrants, mergeSharePermissions } from '../../src/lib/share-state';
import { isCurrentSearchGeneration, nextSearchGeneration } from '../../src/lib/share-search-model';
import { fetchShareUsers } from '../../src/lib/share-search-client';
import { nextSelectedIds, selectableIdSet } from '../../src/lib/list-selection';
import { canEditFileItem, canTrashFileItem } from '../../src/lib/file-permissions';
import { planUploadConflictResolution, splitUploadConflicts } from '../../src/lib/upload-conflicts';
import { initialUploadPanelState, uploadPanelReducer } from '../../src/lib/upload-panel-model';
import {
  completedUploadOutcome,
  failedUploadOutcome,
  type UploadOutcome
} from '../../src/lib/upload-lifecycle-model';
import { browserUploadRuntime } from '../../src/lib/upload-runtime-client';
import {
  cancelUploadSession,
  UploadConflictError,
  uploadFileInChunks
} from '../../src/lib/upload-client';
import { createPasskeyRegistrationContext, deletePasskey } from '../../src/lib/passkey-client';
import { signalDeletedPasskeyWithDevice } from '../../src/lib/passkey-device-client';
import { navigateToGoogle, redirectToHome } from '../../src/lib/navigation-client';
import { copyTextToClipboard, readFileAsDataUrl } from '../../src/lib/browser-file-client';
import { subscribeWindowEvents } from '../../src/lib/window-events';
import {
  createFolder as createFolderRequest,
  moveFile as moveFileRequest,
  permanentlyDeleteFile as permanentlyDeleteFileRequest,
  renameFile as renameFileRequest,
  restoreFile as restoreFileRequest,
  trashFile as trashFileRequest
} from '../../src/lib/workspace-file-client';
import { mergeProfileState, removeProfilePasskey } from '../../src/lib/profile-state';
import { adminPanelReducer, initialAdminPanelState } from '../../src/lib/admin-panel-model';
import { initialSharePanelState, sharePanelReducer } from '../../src/lib/share-panel-model';
import { initialProfilePanelState, profilePanelReducer } from '../../src/lib/profile-panel-model';
import {
  initialWorkspaceModalState,
  workspaceModalReducer
} from '../../src/lib/workspace-modal-model';
import { toProfilePatchRequest } from '../../src/lib/profile-update-model';
import { fetchProfilePasskeys, patchProfile } from '../../src/lib/profile-client';
import { requestAccountDeletion } from '../../src/lib/account-client';
import {
  fetchFolderShares,
  listShareInvitations,
  respondToShareInvitation,
  saveFolderShares
} from '../../src/lib/share-client';
import { createShareLink } from '../../src/lib/share-link-client';
import type { GoogleConnectionStatus } from '../../src/lib/google-connection-status';
import {
  fetchCurrentUser,
  logout as logoutAuth,
  requestPasswordReset
} from '../../src/lib/auth-client';
import { buildMockResetLink, membersOnly } from '../../src/lib/member-management';
import {
  initialInvitationPanelState,
  invitationPanelReducer
} from '../../src/lib/invitation-panel-model';
import { readResponseMessage } from '../../src/lib/response-message';
import {
  filesFromDragIds,
  planDraggedMove,
  resolveDropTarget,
  selectDraggedFiles
} from '../../src/lib/drag-drop-model';
import {
  dragInteractionReducer,
  initialDragInteraction
} from '../../src/lib/drag-interaction-model';
import {
  activatePointerDrag,
  createPointerDragSession,
  isPointerDragSession,
  pointerDragPosition,
  shouldActivatePointerDrag,
  type PointerDragSession,
  updatePointerDropTarget
} from '../../src/lib/pointer-drag-model';
import {
  actionableFiles,
  countSuccessful,
  downloadableFiles
} from '../../src/lib/workspace-actions-model';
import {
  initialWorkspaceNavigation,
  workspaceNavigationReducer
} from '../../src/lib/workspace-navigation-model';
import {
  initialWorkspaceInteractionState,
  workspaceInteractionReducer
} from '../../src/lib/workspace-interaction-model';
import {
  buildWorkspaceCacheKey,
  buildWorkspaceRequest,
  deriveWorkspaceCollections,
  describeMoveResult,
  formatBytes,
  getFileKind,
  isFolderMimeType,
  isPreviewableFile,
  storagePercent,
  type WorkspaceSortKey
} from '../../src/lib/workspace-model';
import { deleteResource, setResource } from '../../src/lib/resource-map-model';
import { authCardReducer, initialAuthCardState } from '../../src/lib/auth-card-model';
import { initialSessionState, sessionReducer } from '../../src/lib/session-model';
import { initialStorageQuotaState, storageQuotaReducer } from '../../src/lib/storage-quota-model';
import {
  initialWorkspaceLoadState,
  workspaceLoadReducer
} from '../../src/lib/workspace-load-state-model';
import {
  formatWorkspaceTimestamp,
  getWorkspacePresentation
} from '../../src/lib/workspace-presentation';
import { fetchStorageQuota, fetchWorkspaceFiles } from '../../src/lib/workspace-read-client';
import { interpretWorkspaceFilesResponse, isAbortError } from '../../src/lib/workspace-load-model';
import {
  invalidateWorkspaceCache,
  isCurrentRefreshGeneration,
  nextRefreshGeneration,
  readWorkspaceCache,
  writeWorkspaceCache
} from '../../src/lib/workspace-refresh-model';
import {
  canEditWorkspaceFolder,
  canLoadStorageQuota,
  canUploadToWorkspace,
  isSharedFolderIndex,
  resolveWorkspaceLoadSource
} from '../../src/lib/workspace-availability';
import { mockPermissionFromQuery, type MockPermission } from '../../src/lib/mock-access';
import { decorateMockFiles } from '../../src/lib/mock-workspace-model';
import { buildMockPreviewSource } from '../../src/lib/mock-preview-model';
import {
  isMockWorkspace,
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
} from '../../src/lib/mock-workspace';
import { AppShellSkeleton, TableSkeleton } from '../../src/lib/components/skeleton';
import { FileIcon } from '../../src/lib/components/file-icon';
import { ToastView } from '../../src/lib/components/toast-view';
import { FloatingActionBar } from '../../src/lib/components/floating-action-bar';
import { Button as UiButton } from '../../src/lib/components/ui/button';
import { Card as UiCard } from '../../src/lib/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../../src/lib/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../src/lib/components/ui/dialog';
import { Input as UiInput } from '../../src/lib/components/ui/input';
import { Label as UiLabel } from '../../src/lib/components/ui/label';
import { initialToastState, toastReducer, type ToastType } from '../../src/lib/toast-model';

type User = {
  id?: string;
  displayName: string;
  role: 'admin' | 'member';
  handle?: string | null;
  loginId?: string | null;
  avatarUrl?: string | null;
  googleConnected?: boolean;
  googleConnectionStatus?: GoogleConnectionStatus;
  status?: 'active' | 'disabled';
};
type FileItem = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  modifiedTime?: string;
  trashed?: boolean;
  canShare?: boolean;
  permission?: string;
  ownerName?: string;
  shared?: boolean;
  sharedByMe?: boolean;
  sharedWithCount?: number;
  sharedWithNames?: string[];
  uploadedBy?: string;
  uploadedAt?: string;
  isAdminSpace?: boolean;
};
type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error' | 'cancelled';
  error?: string;
  sessionId?: string;
  targetParentId?: string | null;
};
type ShareInvitation = {
  id: string;
  folderName?: string;
  inviterName?: string;
  permission?: string;
  createdAt?: string;
};
type Passkey = { id: string; name?: string; createdAt?: string };
type ShareUser = {
  id: string;
  displayName: string;
  handle?: string | null;
  permission?: 'viewer' | 'editor';
  status?: 'pending' | 'accepted';
};
type UploadConflict = { file: File; existing: FileItem; targetParentId: string | null };
type ResetRequest = {
  id: string;
  display_name: string;
  login_id: string;
  status: string;
  created_at: string;
  link?: string;
  expires_at?: string;
};
type ResetLink = { link: string; expiresAt: string };
type PointerFileDrag = PointerDragSession<FileItem>;
const POINTER_DRAG_THRESHOLD_PX = 6;

type IconName =
  | 'drive'
  | 'shared'
  | 'inbox'
  | 'trash'
  | 'upload'
  | 'folder'
  | 'search'
  | 'refresh'
  | 'profile'
  | 'users';

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    drive: <path d="M3.5 6.5h17v13h-17zM7 3.5h6l2.5 3H7z" />,
    shared: (
      <>
        <circle cx="8" cy="9" r="3" />
        <circle cx="17" cy="8" r="2.5" />
        <path d="M2.8 19c.7-3.2 2.4-5 5.2-5s4.5 1.8 5.2 5M14 14c3.8-.6 6.2 1 6.8 4" />
      </>
    ),
    inbox: <path d="M4 4.5h16v15H4zM4 14h4l1.5 2h5l1.5-2h4" />,
    trash: <path d="M5 7h14M9 4h6l1 3H8zM7 7l1 13h8l1-13M10 11v5M14 11v5" />,
    upload: <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 14v6h16v-6" />,
    folder: <path d="M3.5 6.5h7l2-2h8v15h-17z" />,
    search: <path d="m20 20-4.5-4.5M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z" />,
    refresh: <path d="M19 7V3l-2 2a8 8 0 1 0 2.2 8M19 3h-4" />,
    profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20c.8-4 3.3-6 7.5-6s6.7 2 7.5 6" />,
    users: (
      <>
        <circle cx="9" cy="9" r="3" />
        <path d="M3 20c.7-4 2.7-6 6-6s5.3 2 6 6M15 5.5a3 3 0 0 1 0 6M16 14c2.8.3 4.5 2.3 5 6" />
      </>
    )
  };

  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function Home() {
  const [session, dispatchSession] = useReducer(
    sessionReducer<User>,
    undefined,
    initialSessionState<User>
  );
  const { user, loading } = session;

  useEffect(() => {
    if (isMockWorkspace()) {
      if (new URLSearchParams(window.location.search).get('mockReset') === '1')
        resetMockWorkspace();
      const mockRole =
        new URLSearchParams(window.location.search).get('mockRole') === 'admin'
          ? 'admin'
          : 'member';
      dispatchSession({
        type: 'set-user',
        user: {
          displayName: mockRole === 'admin' ? 'Mock 관리자' : 'Mock 사용자',
          role: mockRole,
          handle: 'mock'
        }
      });
      return;
    }
    void fetchCurrentUser<User>()
      .then((value) =>
        dispatchSession({
          type: 'finish-loading',
          user: value?.user
            ? {
                ...value.user,
                googleConnected: value.googleConnected,
                googleConnectionStatus: value.googleConnectionStatus
              }
            : null
        })
      )
      .catch(() => dispatchSession({ type: 'finish-loading', user: null }));
  }, []);

  async function logout() {
    try {
      await logoutAuth();
    } finally {
      redirectToHome(window.location);
    }
  }

  if (loading) return <AppShellSkeleton />;
  if (!user) return <AuthCard />;
  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <a className="product-lockup" href="/" aria-label="GShare 저장 공간">
            <span className="product-mark" aria-hidden="true">
              G/
            </span>
            <span>
              <strong>GShare</strong>
              <small>파일 작업공간</small>
            </span>
          </a>
          <div className="account-summary">
            <span className="account-avatar" aria-hidden="true">
              {user.displayName.slice(0, 1)}
            </span>
            <span className="account-copy">
              <strong>{user.displayName}</strong>
              <small>{user.handle ? `@${user.handle}` : 'Google 관리자'}</small>
            </span>
            <button className="text-button logout-button" onClick={() => void logout()}>
              로그아웃
            </button>
          </div>
        </header>
        <Workspace
          user={user}
          onUserChange={(nextUser) => dispatchSession({ type: 'set-user', user: nextUser })}
          onSessionExpired={() => dispatchSession({ type: 'clear-user' })}
        />
      </section>
    </main>
  );
}

function AuthCard() {
  const [state, dispatch] = useReducer(authCardReducer, initialAuthCardState);
  const { loginId, password, error, busy, supportsPasskeys, forgotOpen, forgotMessage } = state;

  useEffect(() => {
    dispatch({
      type: 'set-supports-passkeys',
      value: typeof window !== 'undefined' && 'PublicKeyCredential' in window
    });
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    dispatch({ type: 'begin-submit' });
    try {
      const result = await authClient.signIn.username({
        username: normalizeHandle(loginId),
        password
      });
      if (result.error)
        dispatch({
          type: 'set-error',
          message: result.error.message ?? '로그인 정보가 올바르지 않습니다.'
        });
      else location.reload();
    } catch (cause) {
      dispatch({
        type: 'set-error',
        message: cause instanceof Error ? cause.message : '로그인에 실패했습니다.'
      });
    } finally {
      dispatch({ type: 'end-submit' });
    }
  }

  async function loginWithPasskey() {
    if (!supportsPasskeys || busy) return;
    dispatch({ type: 'begin-submit' });
    try {
      const result = await authClient.signIn.passkey();
      if (result.error)
        dispatch({
          type: 'set-error',
          message: result.error.message ?? '패스키 로그인에 실패했습니다.'
        });
      else location.reload();
    } catch (cause) {
      dispatch({
        type: 'set-error',
        message: cause instanceof Error ? cause.message : '패스키 로그인에 실패했습니다.'
      });
    } finally {
      dispatch({ type: 'end-submit' });
    }
  }

  async function requestReset() {
    dispatch({ type: 'begin-submit' });
    try {
      await requestPasswordReset(fetch, loginId);
      dispatch({
        type: 'set-forgot-message',
        message: '요청을 접수했습니다. 관리자가 변경 링크를 전달합니다.'
      });
    } catch (cause) {
      dispatch({
        type: 'set-forgot-message',
        message: cause instanceof Error ? cause.message : '요청을 접수하지 못했습니다.'
      });
    } finally {
      dispatch({ type: 'end-submit' });
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-frame">
        <div className="auth-aside">
          <div className="brand-lockup">
            <span className="brand-mark">G/</span>
            <span className="brand-name">GSHARE</span>
          </div>
          <div>
            <p className="eyebrow">파일 작업공간</p>
            <h2>필요한 파일을 찾고 바로 공유하세요.</h2>
            <p className="auth-aside-copy">
              개인 파일과 초대받은 공유 폴더를 한 곳에서 관리합니다.
            </p>
          </div>
        </div>
        <UiCard className="auth-card">
          <p className="eyebrow">계정 로그인</p>
          <h1>작업공간에 로그인</h1>
          <p className="muted">관리자는 Google 계정, 멤버는 아이디 또는 패스키를 사용합니다.</p>
          <a className="primary-button" href="/api/auth/google/start">
            <span aria-hidden="true">↗</span> Google 관리자 로그인
          </a>
          <div className="auth-divider">또는 아이디로 로그인</div>
          <form onSubmit={login}>
            <UiLabel className="form-field">
              <span>아이디</span>
              <UiInput
                autoComplete="username"
                placeholder="아이디를 입력하세요"
                value={loginId}
                onChange={(event) => dispatch({ type: 'set-login-id', value: event.target.value })}
              />
            </UiLabel>
            <UiLabel className="form-field">
              <span>비밀번호</span>
              <UiInput
                autoComplete="current-password"
                placeholder="비밀번호를 입력하세요"
                type="password"
                value={password}
                onChange={(event) => dispatch({ type: 'set-password', value: event.target.value })}
              />
            </UiLabel>
            {error && <p className="modal-error">{error}</p>}
            <UiButton
              variant="outline"
              className="secondary-button"
              disabled={busy || !loginId.trim() || !password}
              type="submit"
            >
              로그인 <span aria-hidden="true">→</span>
            </UiButton>
          </form>
          <div className="auth-actions">
            <UiButton
              variant="outline"
              className="secondary-button"
              disabled={busy || !supportsPasskeys}
              onClick={() => void loginWithPasskey()}
              type="button"
            >
              {supportsPasskeys ? '패스키로 로그인' : '이 브라우저는 패스키 미지원'}
            </UiButton>
            <UiButton
              variant="ghost"
              className="text-button"
              onClick={() => dispatch({ type: 'toggle-forgot' })}
              type="button"
            >
              비밀번호를 잊으셨나요?
            </UiButton>
          </div>
          {!supportsPasskeys && (
            <p className="form-hint">
              이 브라우저에서는 패스키를 사용할 수 없습니다. 비밀번호 로그인을 이용해주세요.
            </p>
          )}
          {forgotOpen && (
            <div className="reset-request">
              <p className="muted">아이디를 입력하면 관리자에게 비밀번호 변경 요청을 보냅니다.</p>
              <UiButton
                variant="outline"
                className="secondary-button"
                disabled={busy || !loginId.trim()}
                onClick={() => void requestReset()}
                type="button"
              >
                관리자에게 변경 요청
              </UiButton>
              {forgotMessage && <p className="form-hint">{forgotMessage}</p>}
            </div>
          )}
        </UiCard>
      </section>
    </main>
  );
}

function Workspace({
  user,
  onUserChange,
  onSessionExpired
}: {
  user: User;
  onUserChange: (user: User) => void;
  onSessionExpired: () => void;
}) {
  const [loadState, dispatchLoad] = useReducer(
    workspaceLoadReducer<FileItem>,
    undefined,
    initialWorkspaceLoadState<FileItem>
  );
  const { files, loading, refreshing, message } = loadState;
  const [toastState, dispatchToast] = useReducer(toastReducer, initialToastState);
  const [isSearching, setIsSearching] = useState(false);

  const showToast = (toastMessage: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    dispatchToast({
      type: 'add',
      toast: { id, message: toastMessage, type, timestamp: Date.now() }
    });
    window.setTimeout(() => {
      dispatchToast({ type: 'remove', id });
    }, 4000);
  };

  const setMessage = (value: string, type: ToastType = 'info') => {
    dispatchLoad({ type: 'set-message', message: value });
    if (value) {
      showToast(value, type);
    }
  };

  const [shareLinkBusyId, setShareLinkBusyId] = useState<string | null>(null);
  const [navigation, dispatchNavigation] = useReducer(
    workspaceNavigationReducer<FileItem>,
    undefined,
    initialWorkspaceNavigation<FileItem>
  );
  const {
    folderId,
    search,
    trash,
    showShared,
    showRequests,
    folderPath,
    selectedIds,
    lastSelectedId
  } = navigation;

  const handleSortClick = (key: WorkspaceSortKey) => {
    if (sortBy === key) {
      dispatchInteraction({ type: 'toggle-sort-direction' });
    } else {
      dispatchInteraction({ type: 'set-sort', sortBy: key });
    }
  };
  const [invitationPanel, dispatchInvitation] = useReducer(
    invitationPanelReducer<ShareInvitation>,
    undefined,
    initialInvitationPanelState<ShareInvitation>
  );
  const { invitations, respondingId: respondingInvitationId } = invitationPanel;
  const [interaction, dispatchInteraction] = useReducer(
    workspaceInteractionReducer<FileItem>,
    undefined,
    initialWorkspaceInteractionState<FileItem>
  );
  const { sortBy, sortDescending, draggingFiles, pendingOperationIds, selectionBusy } = interaction;
  const [dragInteraction, dispatchDrag] = useReducer(
    dragInteractionReducer,
    initialDragInteraction
  );
  const { moveDropTarget, externalDragActive, nativeDragFileId } = dragInteraction;
  const [uploadPanel, dispatchUploadPanel] = useReducer(
    uploadPanelReducer<UploadItem, UploadConflict>,
    undefined,
    initialUploadPanelState<UploadItem, UploadConflict>
  );
  const { uploads, showTray: showUploadTray, conflicts: uploadConflicts } = uploadPanel;
  const [workspaceModals, dispatchWorkspaceModal] = useReducer(
    workspaceModalReducer<FileItem>,
    undefined,
    initialWorkspaceModalState<FileItem>
  );
  const {
    previewFile,
    contextMenu,
    newFolder,
    rename: renameModal,
    invite: inviteModal
  } = workspaceModals;
  const [profilePanel, dispatchProfile] = useReducer(
    profilePanelReducer<Passkey>,
    undefined,
    initialProfilePanelState<Passkey>
  );
  const {
    open: showProfile,
    handle: profileHandle,
    avatarUrl: profileAvatarUrl,
    loginIdRevealed,
    passkeys: profilePasskeys,
    loading: profileLoading,
    message: profileMessage,
    busy: profileBusy,
    accountDeletionOpen: showAccountDeletion,
    deletionConfirmation,
    deletionAcknowledged,
    supportsPasskeys,
    currentPassword,
    newPassword
  } = profilePanel;
  const [adminPanel, dispatchAdmin] = useReducer(
    adminPanelReducer<User, ResetRequest, ResetLink>,
    undefined,
    initialAdminPanelState<User, ResetRequest, ResetLink>
  );
  const {
    open: showUsers,
    users,
    resetRequests,
    generatedResetLinks,
    updatingMemberId
  } = adminPanel;
  const [sharePanel, dispatchShare] = useReducer(
    sharePanelReducer<FileItem, ShareUser>,
    undefined,
    initialSharePanelState<FileItem, ShareUser>
  );
  const {
    folder: sharingFolder,
    members: shareUsers,
    selectedIds: sharedUserIds,
    query: shareQuery,
    searchBusy: shareSearchBusy,
    searchError: shareSearchError,
    saving: savingShares
  } = sharePanel;
  const shareSearchGeneration = useRef(0);
  const [storageQuotaState, dispatchStorageQuota] = useReducer(
    storageQuotaReducer,
    undefined,
    initialStorageQuotaState
  );
  const { quota: storageQuota } = storageQuotaState;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const uploadFilesById = useRef<ReadonlyMap<string, File>>(new Map());
  const uploadControllers = useRef<ReadonlyMap<string, AbortController>>(new Map());
  const fileLoadController = useRef<AbortController | null>(null);
  const fileCache = useRef<ReadonlyMap<string, FileItem[]>>(new Map());
  const hasLoadedFiles = useRef(false);
  const refreshGeneration = useRef(0);
  const pointerFileDrag = useRef<PointerFileDrag | null>(null);
  const suppressFileClick = useRef(false);
  const mockMode = isMockWorkspace();
  const mockPermission: MockPermission = mockMode
    ? mockPermissionFromQuery(new URLSearchParams(window.location.search).get('mockAccess'))
    : 'owner';
  const googleConnectionStatus = user.googleConnectionStatus ?? 'missing';
  const googleConnectionNeedsSetup =
    !mockMode &&
    (googleConnectionStatus === 'missing' || googleConnectionStatus === 'reauthorization-required');
  const googleReauthorizationRequired = googleConnectionStatus === 'reauthorization-required';
  const googleConnectionUnavailable = googleConnectionStatus === 'unavailable';

  async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const response = await fetch(input, init);
    if (response.status === 401) onSessionExpired();
    return response;
  }

  useEffect(() => {
    dispatchProfile({
      type: 'set-supports-passkeys',
      value: typeof window !== 'undefined' && 'PublicKeyCredential' in window
    });
  }, []);

  const isFolder = (file: FileItem) => isFolderMimeType(file.mimeType);
  const canEditFile = (file: FileItem) => canEditFileItem(file, user.googleConnected);
  const canTrashFile = (file: FileItem) => canEditFile(file) && canTrashFileItem(file);
  const isOperationPending = (fileId: string) => pendingOperationIds.has(fileId);
  const markOperationPending = (fileIds: readonly string[]) => {
    dispatchInteraction({ type: 'mark-pending', ids: fileIds });
  };
  const clearOperationPending = (fileIds: readonly string[]) => {
    dispatchInteraction({ type: 'clear-pending', ids: fileIds });
  };
  const currentFolder = folderPath[folderPath.length - 1];
  const canEditCurrentFolder = canEditWorkspaceFolder({
    googleConnected: user.googleConnected,
    trash,
    showRequests,
    showShared,
    folderId,
    currentFolderEditable: Boolean(currentFolder && canEditFile(currentFolder)),
    isAdmin: user.role === 'admin',
    mockPermission
  });

  async function loadFiles() {
    fileLoadController.current?.abort();
    const generation = nextRefreshGeneration(refreshGeneration.current);
    refreshGeneration.current = generation;
    const controller = new AbortController();
    fileLoadController.current = controller;
    const cacheKey = buildWorkspaceCacheKey({
      folderId,
      trash,
      search,
      showShared,
      showRequests
    });
    const cachedFiles = readWorkspaceCache(fileCache.current, cacheKey);
    dispatchLoad({
      type: 'refresh-start',
      cachedFiles: cachedFiles ?? undefined,
      hasLoadedFiles: hasLoadedFiles.current
    });
    const loadSource = resolveWorkspaceLoadSource({
      showRequests,
      googleConnected: user.googleConnected,
      mockMode,
      trash
    });
    if (loadSource === 'requests') {
      dispatchLoad({ type: 'empty-load' });
      return;
    }
    if (loadSource === 'unavailable') {
      dispatchLoad({ type: 'empty-load' });
      return;
    }
    if (loadSource === 'mock') {
      const mockFiles =
        showShared && !folderId
          ? listMockSharedFolders()
          : listMockFiles(trash ? null : folderId, search, trash);
      const nextFiles = decorateMockFiles(
        mockFiles,
        new Map(mockFiles.map((file) => [file.id, getMockFolderShares(file.id)])),
        listMockShareUsers(),
        { permission: mockPermission, isAdmin: user.role === 'admin', showShared }
      );
      fileCache.current = writeWorkspaceCache(fileCache.current, cacheKey, nextFiles);
      dispatchLoad({ type: 'load-success', files: nextFiles });
      hasLoadedFiles.current = true;
      return;
    }
    try {
      const endpoint = buildWorkspaceRequest({
        folderId,
        trash,
        search,
        showShared,
        isAdmin: user.role === 'admin'
      });
      const result = await fetchWorkspaceFiles<FileItem>(
        authenticatedFetch,
        endpoint,
        controller.signal
      );
      if (
        controller.signal.aborted ||
        !isCurrentRefreshGeneration(generation, refreshGeneration.current)
      )
        return;
      const decision = interpretWorkspaceFilesResponse({
        status: result.response.status,
        ok: result.response.ok,
        files: result.files,
        message: result.message
      });
      if (decision.type === 'unauthorized') {
        onSessionExpired();
        return;
      }
      const nextFiles = decision.files;
      fileCache.current = writeWorkspaceCache(fileCache.current, cacheKey, nextFiles);
      dispatchLoad({ type: 'load-success', files: nextFiles, message: decision.message });
      hasLoadedFiles.current = true;
    } catch (cause) {
      if (isAbortError(cause)) return;
      if (
        !controller.signal.aborted &&
        isCurrentRefreshGeneration(generation, refreshGeneration.current)
      )
        dispatchLoad({ type: 'load-failure', message: '파일 목록을 불러오지 못했습니다.' });
    } finally {
      if (
        !controller.signal.aborted &&
        isCurrentRefreshGeneration(generation, refreshGeneration.current)
      ) {
        dispatchLoad({ type: 'finish-refresh' });
      }
    }
  }

  function connectGoogle() {
    navigateToGoogle(window.location);
  }

  useEffect(() => {
    if (!search) {
      setIsSearching(false);
      void loadFiles();
      return;
    }
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      void loadFiles().finally(() => setIsSearching(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [folderId, trash, search, showShared, showRequests]);

  useEffect(() => {
    if (!canLoadStorageQuota(mockMode)) return;
    void listShareInvitations(authenticatedFetch)
      .then(async (response) =>
        response.ok
          ? dispatchInvitation({
              type: 'set-invitations',
              invitations:
                ((await response.json()) as { invitations?: ShareInvitation[] }).invitations ?? []
            })
          : undefined
      )
      .catch(() => dispatchInvitation({ type: 'clear-invitations' }));
    void fetchStorageQuota<NonNullable<typeof storageQuota>>(authenticatedFetch)
      .then((quota) => dispatchStorageQuota({ type: 'set-quota', quota }))
      .catch(() => dispatchStorageQuota({ type: 'clear-quota' }));
  }, [mockMode, user.role]);

  async function createFolder() {
    if (!canEditCurrentFolder || newFolder.busy) return;
    const name = newFolder.name.trim();
    if (!name) return;
    dispatchWorkspaceModal({ type: 'set-new-folder-error', error: '' });
    dispatchWorkspaceModal({ type: 'set-new-folder-busy', busy: true });
    try {
      const response = mockMode
        ? await createMockFolder(name, folderId)
        : await createFolderRequest(authenticatedFetch, name, folderId);
      if (!response.ok) {
        dispatchWorkspaceModal({
          type: 'set-new-folder-error',
          error: await readResponseMessage(response, '폴더를 만들지 못했습니다.')
        });
        return;
      }
      dispatchWorkspaceModal({ type: 'close-new-folder' });
      void loadFiles();
    } catch {
      dispatchWorkspaceModal({
        type: 'set-new-folder-error',
        error: '폴더를 만들지 못했습니다. 연결을 확인해주세요.'
      });
    } finally {
      dispatchWorkspaceModal({ type: 'set-new-folder-busy', busy: false });
    }
  }

  function beginRename(file: FileItem) {
    if (!canEditFile(file)) return;
    dispatchWorkspaceModal({ type: 'open-rename', file, name: file.name });
  }

  async function rename() {
    if (
      !renameModal.file ||
      !canEditFile(renameModal.file) ||
      !renameModal.name.trim() ||
      renameModal.busy
    )
      return;
    dispatchWorkspaceModal({ type: 'set-rename-busy', busy: true });
    try {
      const response = mockMode
        ? await renameMockFile(renameModal.file.id, renameModal.name)
        : await renameFileRequest(authenticatedFetch, renameModal.file.id, renameModal.name.trim());
      if (!response.ok) {
        setMessage(await readResponseMessage(response, '이름을 변경하지 못했습니다.'));
        return;
      }
      dispatchWorkspaceModal({ type: 'close-rename' });
      void loadFiles();
    } catch {
      setMessage('이름을 변경하지 못했습니다. 연결을 확인해주세요.');
    } finally {
      dispatchWorkspaceModal({ type: 'set-rename-busy', busy: false });
    }
  }

  async function remove(file: FileItem) {
    if (!canTrashFile(file) || isOperationPending(file.id)) return;
    if (!confirm(`“${file.name}”을(를) 휴지통으로 이동할까요?`)) return;
    markOperationPending([file.id]);
    dispatchNavigation({ type: 'remove-selection', ids: [file.id] });
    setMessage(`“${file.name}”을(를) 휴지통으로 이동하고 있습니다.`);
    try {
      const response = mockMode
        ? await trashMockFile(file.id)
        : await trashFileRequest(authenticatedFetch, file.id);
      if (!response.ok) {
        setMessage(await readResponseMessage(response, '파일을 휴지통으로 이동하지 못했습니다.'));
      } else {
        fileCache.current = invalidateWorkspaceCache();
        setMessage(`“${file.name}”을(를) 휴지통으로 이동했습니다.`);
        void loadFiles();
      }
    } catch {
      setMessage('파일을 휴지통으로 이동하지 못했습니다. 연결을 확인해주세요.');
    } finally {
      clearOperationPending([file.id]);
    }
  }

  function openView(view: 'root' | 'shared' | 'requests' | 'trash') {
    dispatchNavigation({ type: 'open-view', view });
  }

  async function loadInvitations() {
    if (mockMode) return;
    try {
      const response = await listShareInvitations(authenticatedFetch);
      if (response.ok)
        dispatchInvitation({
          type: 'set-invitations',
          invitations:
            ((await response.json()) as { invitations?: ShareInvitation[] }).invitations ?? []
        });
      else setMessage(await readResponseMessage(response, '공유 요청을 불러오지 못했습니다.'));
    } catch {
      setMessage('공유 요청을 불러오지 못했습니다.');
    }
  }

  async function respondToInvitation(invitation: ShareInvitation, accept: boolean) {
    if (respondingInvitationId) return;
    dispatchInvitation({ type: 'start-response', invitationId: invitation.id });
    try {
      const response = await respondToShareInvitation(authenticatedFetch, invitation.id, accept);
      if (!response.ok)
        setMessage(await readResponseMessage(response, '공유 요청을 처리하지 못했습니다.'));
      else {
        setMessage(accept ? '공유 폴더를 수락했습니다.' : '공유 요청을 거절했습니다.');
        await loadInvitations();
        if (accept) void loadFiles();
      }
    } catch {
      setMessage('공유 요청을 처리하지 못했습니다. 연결을 확인해주세요.');
    } finally {
      dispatchInvitation({ type: 'finish-response' });
    }
  }

  function openFolder(file: FileItem) {
    if (!isFolder(file) || trash) return;
    dispatchNavigation({ type: 'open-folder', folder: file });
  }

  function goToParentFolder() {
    if (folderPath.length === 0) return;
    dispatchNavigation({ type: 'open-breadcrumb', index: folderPath.length - 2 });
  }

  function toggleSelect(fileId: string, checked: boolean, shiftKey = false) {
    const file = files.find((item) => item.id === fileId);
    if (file?.isAdminSpace) return;
    dispatchNavigation({
      type: 'replace-selection',
      ids: nextSelectedIds({
        selectedIds,
        visibleItems: visibleFiles,
        targetId: fileId,
        checked,
        shiftKey,
        anchorId: lastSelectedId
      }),
      anchorId: fileId
    });
  }

  function toggleSelectAll(checked: boolean) {
    dispatchNavigation({
      type: 'replace-selection',
      ids: checked ? selectableIdSet(visibleFiles) : new Set(),
      anchorId: null
    });
  }

  async function trashSelected() {
    const targets = actionableFiles(selectedFiles, canTrashFile, pendingOperationIds);
    if (
      selectionBusy ||
      !targets.length ||
      !confirm(`${targets.length}개 항목을 휴지통으로 이동할까요?`)
    )
      return;
    const targetIds = targets.map((file) => file.id);
    markOperationPending(targetIds);
    dispatchNavigation({ type: 'replace-selection', ids: new Set(), anchorId: null });
    setMessage(`${targets.length}개 항목을 휴지통으로 이동하고 있습니다.`);
    dispatchInteraction({ type: 'set-selection-busy', busy: true });
    try {
      const responses = await Promise.all(
        targets.map((file) =>
          mockMode ? trashMockFile(file.id) : trashFileRequest(authenticatedFetch, file.id)
        )
      );
      const failed = responses.find((response) => !response.ok);
      if (failed)
        setMessage(await readResponseMessage(failed, '선택한 항목을 삭제하지 못했습니다.'));
      else {
        fileCache.current = invalidateWorkspaceCache();
        setMessage(`${targets.length}개 항목을 휴지통으로 이동했습니다.`);
        void loadFiles();
      }
    } catch {
      setMessage('선택한 항목을 휴지통으로 이동하지 못했습니다.');
    } finally {
      clearOperationPending(targetIds);
      dispatchInteraction({ type: 'set-selection-busy', busy: false });
    }
  }

  function download(file: FileItem) {
    const anchor = document.createElement('a');
    anchor.href = mockMode
      ? URL.createObjectURL(
          new Blob([`GShare mock file\n${file.name}\n${file.mimeType}\n`], {
            type: file.mimeType || 'application/octet-stream'
          })
        )
      : `/api/files/${file.id}/download`;
    anchor.download = file.name;
    anchor.rel = 'noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (mockMode) window.setTimeout(() => URL.revokeObjectURL(anchor.href), 0);
  }

  async function downloadSelected() {
    const downloadable = downloadableFiles(selectedFiles, isFolder);
    if (selectionBusy || !downloadable.length) return;
    dispatchInteraction({ type: 'set-selection-busy', busy: true });
    try {
      for (const file of downloadable) {
        download(file);
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }
    } finally {
      dispatchInteraction({ type: 'set-selection-busy', busy: false });
    }
  }

  function isPreviewable(file: FileItem) {
    return isPreviewableFile(file.mimeType);
  }

  function isImage(file: FileItem) {
    return getFileKind(file.mimeType) === 'image';
  }

  function isVideo(file: FileItem) {
    return getFileKind(file.mimeType) === 'video';
  }

  function openPreview(file: FileItem) {
    if (isPreviewable(file)) dispatchWorkspaceModal({ type: 'open-preview', file });
  }

  function openContextMenu(event: React.MouseEvent, file: FileItem) {
    if (file.isAdminSpace) return;
    event.preventDefault();
    dispatchWorkspaceModal({
      type: 'open-context-menu',
      context: {
        file,
        x: Math.max(12, Math.min(event.clientX, window.innerWidth - 240)),
        y: Math.max(12, Math.min(event.clientY, window.innerHeight - 220))
      }
    });
  }

  function openKeyboardContextMenu(event: React.KeyboardEvent<HTMLDivElement>, file: FileItem) {
    if (file.isAdminSpace) return;
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    dispatchWorkspaceModal({
      type: 'open-context-menu',
      context: { file, x: bounds.left + 24, y: bounds.bottom + 4 }
    });
  }

  async function createInvite() {
    if (inviteModal.busy) return;
    dispatchWorkspaceModal({ type: 'set-invite-busy', busy: true });
    if (mockMode) {
      dispatchWorkspaceModal({
        type: 'open-invite',
        link: `${window.location.origin}/invite/mock-invitation-token?mock=1`
      });
      return;
    }
    try {
      const response = await createMemberInvitation(authenticatedFetch);
      if (!response.ok)
        setMessage(await readResponseMessage(response, '초대 링크를 만들지 못했습니다.'));
      else {
        dispatchWorkspaceModal({
          type: 'open-invite',
          link: ((await response.json()) as { link: string }).link
        });
      }
    } catch {
      setMessage('초대 링크를 만들지 못했습니다. 연결을 확인해주세요.');
    } finally {
      dispatchWorkspaceModal({ type: 'set-invite-busy', busy: false });
    }
  }

  async function openProfile() {
    dispatchProfile({
      type: 'open',
      handle: user.handle ?? user.loginId ?? '',
      avatarUrl: user.avatarUrl ?? null,
      loading: !mockMode
    });
    if (mockMode) return;
    try {
      dispatchProfile({
        type: 'set-passkeys',
        value: await fetchProfilePasskeys<Passkey>(authenticatedFetch)
      });
    } catch (cause) {
      dispatchProfile({
        type: 'set-message',
        value: cause instanceof Error ? cause.message : '패스키 목록을 불러오지 못했습니다.'
      });
    } finally {
      dispatchProfile({ type: 'set-loading', value: false });
    }
  }

  async function saveProfile() {
    if (profileBusy) return;
    dispatchProfile({ type: 'set-busy', value: true });
    if (mockMode) {
      onUserChange({ ...user, handle: profileHandle, avatarUrl: profileAvatarUrl });
      dispatchProfile({ type: 'set-message', value: '모킹 프로필을 저장했습니다.' });
      dispatchProfile({ type: 'set-busy', value: false });
      return;
    }
    try {
      const updated = await patchProfile({
        request: authenticatedFetch,
        body: toProfilePatchRequest({
          handle: profileHandle,
          avatarUrl: profileAvatarUrl,
          currentPassword,
          newPassword
        })
      });
      if (updated) onUserChange(mergeProfileState(user, updated));
      dispatchProfile({ type: 'set-message', value: '프로필을 저장했습니다.' });
      dispatchProfile({ type: 'clear-passwords' });
    } catch (cause) {
      dispatchProfile({
        type: 'set-message',
        value:
          cause instanceof Error
            ? cause.message
            : '프로필을 저장하지 못했습니다. 연결을 확인해주세요.'
      });
    }
    dispatchProfile({ type: 'set-busy', value: false });
  }

  async function addPasskey() {
    if (profileBusy || mockMode || !supportsPasskeys) return;
    dispatchProfile({ type: 'set-busy', value: true });
    dispatchProfile({ type: 'set-message', value: '' });
    try {
      const response = await createPasskeyRegistrationContext(authenticatedFetch);
      if (!response.ok)
        throw new Error(await readResponseMessage(response, '패스키 등록에 실패했습니다.'));
      const { context } = (await response.json()) as { context: string };
      const result = await authClient.passkey.addPasskey({
        name: `${profileHandle || user.displayName}의 패스키`,
        context
      });
      if (result.error) throw new Error(result.error.message);
      await openProfile();
      dispatchProfile({ type: 'set-message', value: '패스키를 등록했습니다.' });
    } catch (cause) {
      dispatchProfile({
        type: 'set-message',
        value: cause instanceof Error ? cause.message : '패스키 등록에 실패했습니다.'
      });
    } finally {
      dispatchProfile({ type: 'set-busy', value: false });
    }
  }

  async function removePasskey(passkey: Passkey) {
    if (profileBusy || !confirm('이 패스키를 제거할까요?')) return;
    dispatchProfile({ type: 'set-busy', value: true });
    try {
      const response = await deletePasskey(authenticatedFetch, passkey.id);
      if (!response.ok)
        dispatchProfile({
          type: 'set-message',
          value: await readResponseMessage(response, '패스키를 제거하지 못했습니다.')
        });
      else {
        const result = (await response.json()) as {
          rpId: string;
          userId: string;
          acceptedCredentialIds: string[];
        };
        const synced = await signalDeletedPasskeyWithDevice(result);
        dispatchProfile({
          type: 'set-passkeys',
          value: removeProfilePasskey(profilePasskeys, passkey.id)
        });
        dispatchProfile({
          type: 'set-message',
          value: synced
            ? '서버에서 패스키를 제거했고, 기기에도 삭제 신호를 보냈습니다.'
            : '서버에서 패스키를 제거했습니다. 이 브라우저는 기기 자동 삭제 신호를 지원하지 않습니다.'
        });
      }
    } catch {
      dispatchProfile({
        type: 'set-message',
        value: '패스키를 제거하지 못했습니다. 연결을 확인해주세요.'
      });
    }
    dispatchProfile({ type: 'set-busy', value: false });
  }

  async function deleteAccount() {
    if (profileBusy || mockMode) return;
    dispatchProfile({ type: 'set-busy', value: true });
    dispatchProfile({ type: 'set-message', value: '' });
    try {
      await requestAccountDeletion({
        request: authenticatedFetch,
        confirmation: deletionConfirmation,
        acknowledged: deletionAcknowledged
      });
      redirectToHome(window.location);
    } catch (cause) {
      dispatchProfile({
        type: 'set-message',
        value:
          cause instanceof Error
            ? cause.message
            : '계정 삭제를 시작하지 못했습니다. 연결을 확인해주세요.'
      });
    } finally {
      dispatchProfile({ type: 'set-busy', value: false });
    }
  }

  async function readAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      dispatchProfile({
        type: 'set-message',
        value: 'PNG, JPG, WEBP, GIF 이미지만 업로드할 수 있습니다.'
      });
      return;
    }
    if (file.size > 1_000_000) {
      dispatchProfile({ type: 'set-message', value: '아바타 이미지는 1MB 이하로 업로드해주세요.' });
      return;
    }
    void readFileAsDataUrl(file)
      .then((value) => dispatchProfile({ type: 'set-avatar', value }))
      .catch(() => dispatchProfile({ type: 'set-message', value: '이미지를 읽지 못했습니다.' }));
  }

  async function loadUsers() {
    if (mockMode) {
      dispatchAdmin({
        type: 'set-users',
        users: [
          {
            id: 'mock-member-1',
            displayName: 'Mock 멤버',
            handle: 'member',
            role: 'member',
            status: 'active'
          },
          {
            id: 'mock-member-2',
            displayName: '비활성 멤버',
            handle: 'disabled',
            role: 'member',
            status: 'disabled'
          }
        ]
      });
      dispatchAdmin({ type: 'set-reset-requests', requests: [] });
      dispatchAdmin({ type: 'open' });
      return;
    }
    try {
      const [usersResponse, requestsResponse] = await Promise.all([
        listMembers(authenticatedFetch),
        listPasswordResetRequests(authenticatedFetch)
      ]);
      if (usersResponse.ok)
        dispatchAdmin({
          type: 'set-users',
          users: ((await usersResponse.json()) as { users?: User[] }).users ?? []
        });
      else setMessage(await readResponseMessage(usersResponse, '멤버 정보를 불러오지 못했습니다.'));
      if (requestsResponse.ok)
        dispatchAdmin({
          type: 'set-reset-requests',
          requests:
            ((await requestsResponse.json()) as { requests?: ResetRequest[] }).requests ?? []
        });
      else
        setMessage(
          await readResponseMessage(requestsResponse, '비밀번호 변경 요청을 불러오지 못했습니다.')
        );
      dispatchAdmin({ type: 'open' });
    } catch {
      setMessage('멤버 정보를 불러오지 못했습니다. 연결을 확인해주세요.');
    }
  }

  async function setUserStatus(id: string, status: 'active' | 'disabled') {
    if (!id || updatingMemberId) return;
    dispatchAdmin({ type: 'set-updating-member', memberId: id });
    if (mockMode) {
      dispatchAdmin({ type: 'update-member-status', memberId: id, status });
      dispatchAdmin({ type: 'set-updating-member', memberId: null });
      return;
    }
    try {
      const response = await updateMemberStatusRequest(authenticatedFetch, id, status);
      if (!response.ok)
        setMessage(await readResponseMessage(response, '멤버 상태를 변경하지 못했습니다.'));
      else dispatchAdmin({ type: 'update-member-status', memberId: id, status });
    } catch {
      setMessage('멤버 상태를 변경하지 못했습니다.');
    } finally {
      dispatchAdmin({ type: 'set-updating-member', memberId: null });
    }
  }

  async function createDirectResetLink(member: User) {
    if (!member.id || updatingMemberId) return;
    dispatchAdmin({ type: 'set-updating-member', memberId: member.id });
    if (mockMode) {
      dispatchAdmin({
        type: 'set-generated-link',
        memberId: member.id,
        link: buildMockResetLink(window.location.origin, member.id, Date.now())
      });
      dispatchAdmin({ type: 'set-updating-member', memberId: null });
      return;
    }
    try {
      const response = await createMemberResetLink(authenticatedFetch, member.id);
      if (!response.ok)
        setMessage(await readResponseMessage(response, '비밀번호 변경 링크를 만들지 못했습니다.'));
      else {
        const result = (await response.json()) as ResetLink;
        dispatchAdmin({ type: 'set-generated-link', memberId: member.id, link: result });
      }
    } catch {
      setMessage('비밀번호 변경 링크를 만들지 못했습니다.');
    } finally {
      dispatchAdmin({ type: 'set-updating-member', memberId: null });
    }
  }

  async function createResetLink(request: ResetRequest) {
    try {
      const response = await createPasswordResetRequestLink(authenticatedFetch, request.id);
      if (!response.ok)
        setMessage(await readResponseMessage(response, '비밀번호 변경 링크를 만들지 못했습니다.'));
      else {
        const result = (await response.json()) as ResetLink;
        dispatchAdmin({
          type: 'update-reset-request',
          requestId: request.id,
          update: (current) => ({ ...current, link: result.link, expires_at: result.expiresAt })
        });
      }
    } catch {
      setMessage('비밀번호 변경 링크를 만들지 못했습니다.');
    }
  }

  async function openShareSettings(folder: FileItem) {
    shareSearchGeneration.current = nextSearchGeneration(shareSearchGeneration.current);
    if (mockMode) {
      const shares = getMockFolderShares(folder.id);
      dispatchShare({
        type: 'open',
        folder,
        members: mergeSharePermissions(
          listMockShareUsers(),
          shares.map((share) => ({ userId: share.userId, permission: share.permission }))
        ),
        selectedIds: new Set(shares.map((share) => share.userId))
      });
      return;
    }
    try {
      const stateResponse = await fetchFolderShares(authenticatedFetch, folder.id);
      if (!stateResponse.ok) {
        setMessage('공유 설정을 불러오지 못했습니다.');
        return;
      }
      const state = (await stateResponse.json()) as {
        users?: ShareUser[];
        shares?: {
          userId: string;
          displayName?: string;
          handle?: string | null;
          permission: 'viewer' | 'editor';
          status?: 'pending' | 'accepted';
        }[];
      };
      const shares = state.shares ?? [];
      dispatchShare({
        type: 'open',
        folder,
        members: mergeSharePermissions(state.users ?? [], shares),
        selectedIds: new Set(shares.map((share) => share.userId))
      });
    } catch {
      setMessage('공유 설정을 불러오지 못했습니다. 연결을 확인해주세요.');
    }
  }

  async function searchShareUsers(query: string) {
    if (!sharingFolder) return;
    const generation = nextSearchGeneration(shareSearchGeneration.current);
    shareSearchGeneration.current = generation;
    dispatchShare({ type: 'search-start' });
    try {
      const available = await fetchShareUsers({
        query,
        mock: mockMode,
        mockMembers: listMockShareUsers(),
        request: authenticatedFetch
      });
      if (!isCurrentSearchGeneration(generation, shareSearchGeneration.current)) return;
      dispatchShare({ type: 'search-success', available });
    } catch (cause) {
      if (!isCurrentSearchGeneration(generation, shareSearchGeneration.current)) return;
      dispatchShare({
        type: 'search-failure',
        message: cause instanceof Error ? cause.message : '사용자 목록을 불러오지 못했습니다.'
      });
    } finally {
      if (isCurrentSearchGeneration(generation, shareSearchGeneration.current)) {
        dispatchShare({ type: 'search-finish' });
      }
    }
  }

  async function saveShareSettings() {
    if (!sharingFolder || savingShares) return;
    dispatchShare({ type: 'save-start' });
    try {
      const grants = buildShareGrants(shareUsers, sharedUserIds);
      if (mockMode) {
        const response = await saveMockFolderShares(sharingFolder.id, grants);
        if (!response.ok)
          setMessage(await readResponseMessage(response, '공유 설정을 저장하지 못했습니다.'));
        else {
          dispatchShare({ type: 'save-success' });
          setMessage('모킹 공유 설정을 저장했습니다.');
          void loadFiles();
        }
        return;
      }
      const response = await saveFolderShares(authenticatedFetch, sharingFolder.id, grants);
      if (!response.ok)
        setMessage(await readResponseMessage(response, '공유 설정을 저장하지 못했습니다.'));
      else {
        dispatchShare({ type: 'save-success' });
        setMessage('공유 설정을 저장했습니다.');
        void loadFiles();
      }
    } catch {
      setMessage('공유 설정을 저장하지 못했습니다. 연결을 확인해주세요.');
    } finally {
      dispatchShare({ type: 'save-finish' });
    }
  }

  async function createFileShareLink(file: FileItem) {
    if (mockMode || shareLinkBusyId) return;
    setShareLinkBusyId(file.id);
    try {
      const response = await createShareLink(authenticatedFetch, file.id);
      if (!response.ok) {
        setMessage(await readResponseMessage(response, '공유 링크를 만들지 못했습니다.'));
        return;
      }
      const result = (await response.json()) as { link?: string };
      if (!result.link) {
        setMessage('공유 링크를 만들지 못했습니다.');
        return;
      }
      const copied = await copyTextToClipboard(result.link);
      setMessage(
        copied
          ? '공유 링크를 만들고 클립보드에 복사했습니다.'
          : '공유 링크는 만들었지만 클립보드에 복사하지 못했습니다.'
      );
    } catch {
      setMessage('공유 링크를 만들지 못했습니다. 연결을 확인해주세요.');
    } finally {
      setShareLinkBusyId(null);
    }
  }

  async function uploadFiles(incoming: FileList | File[], targetParentId = folderId) {
    const targetFolder = targetParentId ? files.find((file) => file.id === targetParentId) : null;
    if (
      !canUploadToWorkspace({
        trash,
        showRequests,
        isAdmin: user.role === 'admin',
        showShared,
        targetParentId,
        currentFolderId: folderId,
        currentFolderEditable: canEditCurrentFolder,
        targetFolderEditable: targetFolder ? canEditFile(targetFolder) : undefined
      })
    )
      return;
    const { ready, conflicts } = splitUploadConflicts(
      Array.from(incoming),
      files,
      isFolder,
      targetParentId
    );
    for (const file of ready) startUpload(file, undefined, undefined, targetParentId);
    if (conflicts.length) dispatchUploadPanel({ type: 'append-conflicts', conflicts });
  }

  function startUpload(
    file: File,
    conflictAction?: 'replace' | 'overwrite',
    existingFileId?: string,
    targetParentId = folderId
  ) {
    const id = browserUploadRuntime.createId();
    dispatchUploadPanel({
      type: 'enqueue',
      upload: { id, name: file.name, progress: 0, status: 'uploading', targetParentId }
    });
    uploadFilesById.current = setResource(uploadFilesById.current, id, file);
    void uploadOne(file, id, conflictAction, existingFileId, targetParentId);
  }

  function settleUpload(itemId: string, outcome: UploadOutcome) {
    if (outcome.type === 'completed') {
      dispatchUploadPanel({ type: 'complete', uploadId: itemId });
      if (outcome.refresh) void loadFiles();
      return;
    }
    dispatchUploadPanel({
      type: 'fail',
      uploadId: itemId,
      cancelled: outcome.cancelled,
      error: outcome.error
    });
  }

  async function uploadOne(
    file: File,
    itemId: string,
    conflictAction?: 'replace' | 'overwrite',
    existingFileId?: string,
    targetParentId = folderId
  ) {
    const controller = browserUploadRuntime.createController();
    uploadControllers.current = setResource(uploadControllers.current, itemId, controller);
    try {
      if (mockMode) {
        const response = await uploadMockFile(
          file.name,
          file.type,
          file.size,
          targetParentId,
          conflictAction,
          existingFileId
        );
        if (!response.ok)
          throw new Error(await readResponseMessage(response, '업로드 세션을 만들지 못했습니다.'));
        settleUpload(itemId, completedUploadOutcome());
        return;
      }
      await uploadFileInChunks({
        file,
        targetParentId,
        conflictAction,
        existingFileId,
        signal: controller.signal,
        request: authenticatedFetch,
        sleep: browserUploadRuntime.sleep,
        onProgress: (progress, sessionId) =>
          dispatchUploadPanel({
            type: 'progress',
            uploadId: itemId,
            progress,
            sessionId
          })
      });
      settleUpload(itemId, completedUploadOutcome());
    } catch (cause) {
      if (cause instanceof UploadConflictError) {
        dispatchUploadPanel({ type: 'remove', uploadId: itemId });
        dispatchUploadPanel({
          type: 'append-conflicts',
          conflicts: [
            {
              file,
              existing: {
                id: cause.existingFileId,
                name: cause.existingName,
                mimeType: cause.existingMimeType
              },
              targetParentId
            }
          ]
        });
      } else {
        settleUpload(itemId, failedUploadOutcome(cause, controller.signal.aborted));
      }
    } finally {
      uploadControllers.current = deleteResource(uploadControllers.current, itemId);
    }
  }

  async function cancelUpload(item: UploadItem) {
    uploadControllers.current.get(item.id)?.abort();
    if (item.sessionId) await cancelUploadSession(authenticatedFetch, item.sessionId);
  }

  function retryUpload(item: UploadItem) {
    const file = uploadFilesById.current.get(item.id);
    if (!file) return;
    dispatchUploadPanel({ type: 'retry', uploadId: item.id });
    void uploadOne(file, item.id, undefined, undefined, item.targetParentId);
  }

  function resolveUploadConflicts(action: 'skip' | 'replace' | 'overwrite', applyAll: boolean) {
    if (!uploadConflicts.length) return;
    const { uploads, remaining } = planUploadConflictResolution(uploadConflicts, action, applyAll);
    if (uploads.length) {
      uploads.forEach((conflict) =>
        startUpload(
          conflict.file,
          action === 'skip' ? undefined : action,
          conflict.existing.id,
          conflict.targetParentId
        )
      );
    }
    dispatchUploadPanel({ type: 'set-conflicts', conflicts: applyAll ? [] : remaining });
  }

  function beginPointerDrag(event: PointerEvent<HTMLDivElement>, file: FileItem) {
    const source = event.target as HTMLElement | null;
    if (
      event.button !== 0 ||
      source?.closest('input, button, a, .row-actions') ||
      trash ||
      isOperationPending(file.id) ||
      !canEditFile(file)
    )
      return;
    pointerFileDrag.current = createPointerDragSession({
      pointerId: event.pointerId,
      payload: file,
      source: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function pointerDropTargetAt(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY);
    const target = element?.closest<HTMLElement>('[data-folder-drop-id], [data-parent-drop-id]');
    return target?.dataset.folderDropId ?? target?.dataset.parentDropId ?? null;
  }

  function handlePointerMove(event: globalThis.PointerEvent) {
    const drag = pointerFileDrag.current;
    if (!isPointerDragSession(drag, event.pointerId)) return;
    if (
      !drag.active &&
      !shouldActivatePointerDrag(
        pointerDragPosition(drag, event.clientX, event.clientY),
        POINTER_DRAG_THRESHOLD_PX
      )
    )
      return;
    if (!drag.active) {
      pointerFileDrag.current = activatePointerDrag(drag);
      dispatchInteraction({
        type: 'set-dragging-files',
        files: selectDraggedFiles(visibleFiles, drag.payload.id, selectedIds, canEditFile)
      });
    }
    event.preventDefault();
    const targetParentId = pointerDropTargetAt(event.clientX, event.clientY);
    pointerFileDrag.current = updatePointerDropTarget(pointerFileDrag.current!, targetParentId);
    dispatchDrag({ type: 'update-target', targetParentId });
  }

  function handlePointerUp(event: globalThis.PointerEvent) {
    const drag = pointerFileDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pointerFileDrag.current = null;
    if (!drag.active) return;
    event.preventDefault();
    suppressFileClick.current = true;
    window.setTimeout(() => {
      suppressFileClick.current = false;
    }, 0);
    const hitTarget = pointerDropTargetAt(event.clientX, event.clientY);
    const targetParentId = resolveDropTarget(drag.payload.id, hitTarget, drag.targetParentId);
    if (drag.source?.hasPointerCapture?.(event.pointerId))
      drag.source.releasePointerCapture(event.pointerId);
    dispatchInteraction({ type: 'clear-dragging-files' });
    dispatchDrag({ type: 'update-target', targetParentId: null });
    const filesToMove = selectDraggedFiles(visibleFiles, drag.payload.id, selectedIds, canEditFile);
    if (targetParentId) void moveFilesToFolder(filesToMove, targetParentId);
  }

  function handlePointerCancel(event: globalThis.PointerEvent) {
    if (!isPointerDragSession(pointerFileDrag.current, event.pointerId)) return;
    pointerFileDrag.current = null;
    dispatchInteraction({ type: 'clear-dragging-files' });
    dispatchDrag({ type: 'update-target', targetParentId: null });
  }

  function handleNativeDragStart(event: DragEvent<HTMLDivElement>, file: FileItem) {
    if (trash || isOperationPending(file.id) || !canEditFile(file)) return;
    const filesToMove = selectDraggedFiles(visibleFiles, file.id, selectedIds, canEditFile);
    createInternalDragPayload(event.dataTransfer, filesToMove);
    event.dataTransfer.effectAllowed = 'move';
    dispatchDrag({ type: 'begin-native', sourceId: file.id });
    dispatchInteraction({ type: 'set-dragging-files', files: filesToMove });
  }

  function handleNativeDragOver(event: DragEvent<HTMLElement>, targetParentId: string) {
    const sourceId =
      nativeDragFileId ?? firstInternalDragId(event.dataTransfer) ?? draggingFiles[0]?.id;
    if (!sourceId || sourceId === targetParentId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dispatchDrag({ type: 'enter-internal', sourceId, targetParentId });
  }

  function handleNativeDragLeave(event: DragEvent<HTMLElement>, targetParentId: string) {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    dispatchDrag({ type: 'leave-target', targetParentId });
  }

  function handleFolderDragOver(event: DragEvent<HTMLElement>, folder: FileItem) {
    if (!isFolder(folder) || !canEditFile(folder)) return;
    if (event.dataTransfer.types.includes('Files') && !nativeDragFileId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      dispatchDrag({ type: 'enter-external', targetParentId: folder.id });
      return;
    }
    handleNativeDragOver(event, folder.id);
  }

  function handleNativeDrop(event: DragEvent<HTMLElement>, targetParentId: string) {
    event.preventDefault();
    event.stopPropagation();
    const draggedFiles = filesFromDragIds(
      resolveInternalDragIds(
        event.dataTransfer,
        draggingFiles.map((file) => file.id)
      ),
      files
    );
    dispatchDrag({ type: 'clear' });
    if (draggedFiles.length > 0) void moveFilesToFolder(draggedFiles, targetParentId);
  }

  function handleFolderDrop(event: DragEvent<HTMLElement>, folder: FileItem) {
    if (!isFolder(folder) || !canEditFile(folder)) return;
    if (event.dataTransfer.files.length > 0 && !readInternalDragIds(event.dataTransfer).length) {
      event.preventDefault();
      event.stopPropagation();
      dispatchDrag({ type: 'clear' });
      void uploadFiles(event.dataTransfer.files, folder.id);
      return;
    }
    handleNativeDrop(event, folder.id);
  }

  function handleNativeDragEnd() {
    dispatchDrag({ type: 'clear' });
    dispatchInteraction({ type: 'clear-dragging-files' });
  }

  function handleExternalDragOver(event: DragEvent<HTMLElement>, targetParentId: string | null) {
    if (
      !event.dataTransfer.types.includes('Files') ||
      readInternalDragIds(event.dataTransfer).length > 0 ||
      !canEditCurrentFolder
    )
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    dispatchDrag({ type: 'enter-external', targetParentId });
  }

  function handleExternalDragLeave(event: DragEvent<HTMLElement>, targetParentId: string | null) {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    dispatchDrag({ type: 'leave-target', targetParentId });
  }

  function handleExternalDrop(event: DragEvent<HTMLElement>, targetParentId: string | null) {
    if (
      !event.dataTransfer.files.length ||
      readInternalDragIds(event.dataTransfer).length > 0 ||
      !canEditCurrentFolder
    )
      return;
    event.preventDefault();
    dispatchDrag({ type: 'clear' });
    void uploadFiles(event.dataTransfer.files, targetParentId ?? undefined);
  }

  useEffect(() => {
    return subscribeWindowEvents(window, [
      ['pointermove', handlePointerMove as unknown as EventListener],
      ['pointerup', handlePointerUp as unknown as EventListener],
      ['pointercancel', handlePointerCancel as unknown as EventListener]
    ]);
  }, [files, folderPath, pendingOperationIds, trash, selectedIds]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const pastedFiles = Array.from(event.clipboardData?.files ?? []);
      if (pastedFiles.length > 0) {
        event.preventDefault();
        void uploadFiles(pastedFiles);
      }
    };
    return subscribeWindowEvents(window, [['paste', handlePaste as unknown as EventListener]]);
  }, [folderId, showShared, showRequests, trash, user.role]);

  useEffect(() => {
    const close = () => dispatchWorkspaceModal({ type: 'close-context-menu' });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dispatchWorkspaceModal({ type: 'close-context-menu' });
    };
    return subscribeWindowEvents(window, [
      ['click', close as unknown as EventListener],
      ['keydown', closeOnEscape as unknown as EventListener]
    ]);
  }, []);

  async function moveFilesToFolder(draggedFiles: FileItem[], targetParentId: string) {
    const targetFolder =
      files.find((file) => file.id === targetParentId) ??
      folderPath.find((folder) => folder.id === targetParentId);
    const movableFiles = planDraggedMove({
      files: draggedFiles,
      sourceId: draggedFiles[0]?.id ?? '',
      selectedIds: new Set(draggedFiles.map((file) => file.id)),
      targetAllowed: !targetFolder || canEditFile(targetFolder),
      canMove: (file) => canEditFile(file) && !isOperationPending(file.id)
    });
    if (movableFiles.length === 0) return;

    const movingIds = movableFiles.map((file) => file.id);
    markOperationPending(movingIds);
    dispatchNavigation({ type: 'remove-selection', ids: movingIds });
    setMessage(`${movingIds.length}개 항목을 이동하고 있습니다.`);
    try {
      const result = await moveFiles(
        movableFiles,
        targetParentId,
        mockMode
          ? moveMockFile
          : (fileId, parentId) => moveFileRequest(authenticatedFetch, fileId, parentId)
      );
      fileCache.current = invalidateWorkspaceCache();
      const targetName =
        files.find((file) => file.id === targetParentId)?.name ??
        folderPath.find((folder) => folder.id === targetParentId)?.name ??
        (targetParentId === rootParentId ? '저장 공간' : '폴더');
      setMessage(describeMoveResult(result, targetName));
      if (result.moved.length > 0) void loadFiles();
    } catch {
      setMessage('파일을 이동하지 못했습니다. 연결을 확인해주세요.');
    } finally {
      clearOperationPending(movingIds);
    }
  }

  function consumeSuppressedFileClick() {
    if (!suppressFileClick.current) return false;
    suppressFileClick.current = false;
    return true;
  }

  async function restoreFile(file: FileItem) {
    if (isOperationPending(file.id)) return;
    markOperationPending([file.id]);
    setMessage(`“${file.name}”을(를) 복구하고 있습니다.`);
    try {
      const response = mockMode
        ? await restoreMockFile(file.id)
        : await restoreFileRequest(authenticatedFetch, file.id);
      if (!response.ok)
        setMessage(await readResponseMessage(response, '파일을 복구하지 못했습니다.'));
      else {
        fileCache.current = invalidateWorkspaceCache();
        dispatchNavigation({ type: 'remove-selection', ids: [file.id] });
        setMessage(`“${file.name}”을(를) 복구했습니다.`);
        void loadFiles();
      }
    } catch {
      setMessage('파일을 복구하지 못했습니다. 연결을 확인해주세요.');
    } finally {
      clearOperationPending([file.id]);
    }
  }

  async function permanentlyDeleteFile(file: FileItem) {
    if (!trash || isOperationPending(file.id)) return;
    if (!confirm(`“${file.name}”을(를) 영구 삭제할까요? 삭제 후에는 복구할 수 없습니다.`)) return;
    markOperationPending([file.id]);
    dispatchNavigation({ type: 'remove-selection', ids: [file.id] });
    setMessage(`“${file.name}”을(를) 영구 삭제하고 있습니다.`);
    try {
      const response = mockMode
        ? await permanentlyDeleteMockFile(file.id)
        : await permanentlyDeleteFileRequest(authenticatedFetch, file.id);
      if (!response.ok) {
        setMessage(await readResponseMessage(response, '파일을 영구 삭제하지 못했습니다.'));
        return;
      }
      dispatchNavigation({ type: 'remove-selection', ids: [file.id] });
      fileCache.current = invalidateWorkspaceCache();
      setMessage(`“${file.name}”을(를) 영구 삭제했습니다.`);
      void loadFiles();
    } catch {
      setMessage('파일을 영구 삭제하지 못했습니다. 연결을 확인해주세요.');
    } finally {
      clearOperationPending([file.id]);
    }
  }

  async function permanentlyDeleteSelected() {
    const targets = actionableFiles(
      selectedFiles,
      (file) => trash && Boolean(file.trashed),
      pendingOperationIds
    );
    if (
      !targets.length ||
      !confirm(`${targets.length}개 항목을 영구 삭제할까요? 삭제 후에는 복구할 수 없습니다.`)
    )
      return;
    const targetIds = targets.map((file) => file.id);
    markOperationPending(targetIds);
    dispatchNavigation({ type: 'replace-selection', ids: new Set(), anchorId: null });
    setMessage(`${targets.length}개 항목을 영구 삭제하고 있습니다.`);
    dispatchInteraction({ type: 'set-selection-busy', busy: true });
    try {
      const results: boolean[] = [];
      for (const file of targets) {
        try {
          await permanentlyDeleteFileWithoutConfirm(file);
          results.push(true);
        } catch (cause) {
          results.push(false);
          setMessage(cause instanceof Error ? cause.message : '영구 삭제에 실패했습니다.');
        }
      }
      fileCache.current = invalidateWorkspaceCache();
      const deleted = countSuccessful(results);
      if (deleted > 0) setMessage(`${deleted}개 항목을 영구 삭제했습니다.`);
      void loadFiles();
    } finally {
      clearOperationPending(targetIds);
      dispatchInteraction({ type: 'set-selection-busy', busy: false });
    }
  }

  async function permanentlyDeleteFileWithoutConfirm(file: FileItem) {
    const response = mockMode
      ? await permanentlyDeleteMockFile(file.id)
      : await permanentlyDeleteFileRequest(authenticatedFetch, file.id);
    if (!response.ok)
      throw new Error(await readResponseMessage(response, '영구 삭제에 실패했습니다.'));
  }

  const rootParentId = folderPath[0]?.parents?.[0] ?? null;
  const sharedFolderIndex = isSharedFolderIndex(showShared, folderId);
  const {
    visibleFiles,
    selectedFiles,
    activeUploads,
    uploadProgress,
    currentShareMembers,
    availableShareMembers
  } = useMemo(
    () =>
      deriveWorkspaceCollections({
        files,
        selectedIds,
        sortBy,
        descending: sortDescending,
        uploads,
        shareMembers: shareUsers,
        sharedMemberIds: sharedUserIds
      }),
    [files, selectedIds, sortBy, sortDescending, uploads, shareUsers, sharedUserIds]
  );
  const workspacePresentation = getWorkspacePresentation({
    showShared,
    showRequests,
    trash,
    folderName: folderPath.at(-1)?.name ?? null
  });
  function setShareMemberSelected(memberId: string, selected: boolean) {
    dispatchShare({ type: 'set-selected', memberId, selected });
  }

  function setShareMemberPermission(memberId: string, permission: 'viewer' | 'editor') {
    dispatchShare({ type: 'set-permission', memberId, permission });
  }

  useEffect(() => {
    const checkbox = selectAllRef.current;
    if (!checkbox) return;
    const selectableCount = visibleFiles.filter((file) => !file.isAdminSpace).length;
    checkbox.indeterminate = selectedFiles.length > 0 && selectedFiles.length < selectableCount;
  }, [selectedFiles.length, visibleFiles.length, selectedIds]);

  useEffect(() => {
    if (!activeUploads.length) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    return subscribeWindowEvents(window, [
      ['beforeunload', warnBeforeLeaving as unknown as EventListener]
    ]);
  }, [activeUploads.length]);

  return (
    <>
      {externalDragActive && canEditCurrentFolder && (
        <div className="upload-drop-overlay" role="status" aria-live="polite">
          <span className="upload-drop-icon" aria-hidden="true">
            {moveDropTarget ? '↳' : '↓'}
          </span>
          <span>
            <strong>
              {moveDropTarget
                ? `${files.find((file) => file.id === moveDropTarget)?.name ?? '폴더'}에 업로드`
                : folderId
                  ? '현재 폴더에 업로드'
                  : '이 공간에 업로드'}
            </strong>
            <small>파일을 놓으면 바로 업로드합니다.</small>
          </span>
        </div>
      )}
      <nav className="workspace-nav" aria-label="작업공간 메뉴">
        <div className="nav-primary">
          <button
            className={!showShared && !showRequests && !trash ? 'current' : ''}
            onClick={() => openView('root')}
          >
            <Icon name="drive" />
            저장 공간
          </button>
          {user.role !== 'admin' && (
            <button className={showShared ? 'current' : ''} onClick={() => openView('shared')}>
              <Icon name="shared" />
              공유 폴더
            </button>
          )}
          {user.role !== 'admin' && (
            <button
              className={showRequests ? 'current' : ''}
              onClick={() => {
                openView('requests');
                void loadInvitations();
              }}
            >
              <Icon name="inbox" />
              공유 요청
              {invitations.length > 0 && (
                <span className="nav-count" aria-label={`${invitations.length}개`}>
                  {invitations.length}
                </span>
              )}
            </button>
          )}
          <button className={trash ? 'current' : ''} onClick={() => openView('trash')}>
            <Icon name="trash" />
            휴지통
          </button>
        </div>
        <div className="nav-utility">
          {user.role === 'admin' && (
            <button onClick={() => void createInvite()}>
              <Icon name="shared" />
              멤버 초대
            </button>
          )}
          {user.role === 'admin' && (
            <button onClick={() => void loadUsers()}>
              <Icon name="users" />
              멤버 관리
            </button>
          )}
          <button onClick={() => void openProfile()}>
            <Icon name="profile" />내 정보
          </button>
          {user.role === 'admin' && googleConnectionNeedsSetup && (
            <button onClick={connectGoogle}>
              <Icon name="drive" />
              {googleReauthorizationRequired ? '다시 연결' : 'Drive 연결'}
            </button>
          )}
          <button onClick={() => void loadFiles()} aria-label="파일 목록 새로고침">
            <Icon name="refresh" />
            새로고침
          </button>
        </div>
      </nav>
      <div className="workspace-main">
        <section className="workspace-heading" aria-labelledby="workspace-title">
          <div>
            <p className="workspace-eyebrow">{workspacePresentation.eyebrow}</p>
            <h1 id="workspace-title">{workspacePresentation.title}</h1>
            <p>{workspacePresentation.description}</p>
          </div>
          <div className="workspace-stats" aria-label="현재 목록 요약">
            <div className="workspace-item-count">
              <strong>{visibleFiles.length}</strong>
              <span>{search ? '검색 결과' : '항목'}</span>
            </div>
            {storageQuota?.available && storageQuota.limit ? (
              <div className="workspace-storage">
                <span>
                  저장 공간 {formatBytes(String(storageQuota.usage))} /{' '}
                  {formatBytes(String(storageQuota.limit))}
                </span>
                <div
                  className="storage-meter"
                  role="progressbar"
                  aria-label="저장 공간 사용량"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={storagePercent(storageQuota)}
                >
                  <span style={{ width: `${storagePercent(storageQuota)}%` }} />
                </div>
              </div>
            ) : null}
          </div>
        </section>
        {googleConnectionNeedsSetup && (
          <section className="setup-banner" role="status">
            <div>
              <strong>
                {googleReauthorizationRequired
                  ? 'Google Drive 연결 권한이 만료되었습니다.'
                  : 'Google Drive를 연결하면 파일 공간을 사용할 수 있습니다.'}
              </strong>
              <p>
                {googleReauthorizationRequired
                  ? '관리자 계정으로 Drive 연결을 다시 완료해주세요.'
                  : '관리자 계정에서 OAuth 연결을 한 번만 완료해주세요.'}
              </p>
            </div>
            {user.role === 'admin' && (
              <button className="secondary-button" onClick={connectGoogle}>
                {googleReauthorizationRequired ? '다시 연결' : '연결하기'}
              </button>
            )}
          </section>
        )}
        {googleConnectionUnavailable && (
          <section className="setup-banner" role="status">
            <div>
              <strong>Google Drive 연결 상태를 확인할 수 없습니다.</strong>
              <p>잠시 후 파일 목록을 새로고침해주세요.</p>
            </div>
          </section>
        )}
        <section
          className={`workspace-file-area ${sharedFolderIndex ? 'shared-folder-index' : ''}`}
          aria-label="파일 작업 및 목록"
        >
          <div className="toolbar">
            <div
              className="toolbar-actions toolbar-action-group"
              role="group"
              aria-label="파일 작업 메뉴"
            >
              {canEditCurrentFolder && (
                <label className="primary-button upload-button">
                  <Icon name="upload" />
                  파일 업로드
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(event) => {
                      if (event.currentTarget.files) void uploadFiles(event.currentTarget.files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              )}
              {canEditCurrentFolder && (
                <button
                  className="secondary-button"
                  onClick={() => {
                    dispatchWorkspaceModal({ type: 'open-new-folder' });
                  }}
                >
                  <Icon name="folder" />새 폴더
                </button>
              )}
              {selectedFiles.length > 0 && !trash && (
                <>
                  {selectedFiles.some((file) => !isFolder(file)) && (
                    <button
                      className="secondary-button"
                      disabled={selectionBusy}
                      onClick={() => void downloadSelected()}
                    >
                      {selectionBusy ? '다운로드 중…' : '선택 다운로드'}
                    </button>
                  )}
                  {selectedFiles.some(canTrashFile) && (
                    <button
                      className="danger-button"
                      disabled={selectionBusy}
                      onClick={() => void trashSelected()}
                    >
                      선택 삭제 ({selectedFiles.filter(canTrashFile).length})
                    </button>
                  )}
                </>
              )}
              {selectedFiles.length > 0 && trash && (
                <button
                  className="danger-button"
                  disabled={selectionBusy}
                  onClick={() => void permanentlyDeleteSelected()}
                >
                  영구 삭제 ({selectedFiles.length})
                </button>
              )}
            </div>
            <div className="toolbar-controls">
              <label className="search-field">
                {isSearching ? (
                  <span className="search-spinner" aria-hidden="true" />
                ) : (
                  <Icon name="search" />
                )}
                <span className="sr-only">파일 검색</span>
                <input
                  className="search"
                  placeholder="이 폴더에서 검색"
                  value={search}
                  onChange={(event) =>
                    dispatchNavigation({ type: 'set-search', value: event.target.value })
                  }
                />
                {search && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    aria-label="검색어 지우기"
                    onClick={() => dispatchNavigation({ type: 'set-search', value: '' })}
                  >
                    ×
                  </button>
                )}
              </label>
              <div className="toolbar-sort-group">
                <select
                  aria-label="정렬 기준"
                  value={sortBy}
                  onChange={(event) =>
                    dispatchInteraction({
                      type: 'set-sort',
                      sortBy: event.target.value as WorkspaceSortKey
                    })
                  }
                >
                  <option value="name">이름순</option>
                  <option value="modifiedTime">최근 수정순</option>
                  <option value="size">크기순</option>
                </select>
                <button
                  className="secondary-button sort-direction"
                  aria-label="정렬 방향"
                  onClick={() => dispatchInteraction({ type: 'toggle-sort-direction' })}
                >
                  {sortDescending ? '↓' : '↑'}
                </button>
              </div>
            </div>
          </div>
          {!sharedFolderIndex && (
            <div className={`selection-bar ${selectedFiles.length > 0 ? 'is-active' : ''}`}>
              <label className="select-all-control">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="현재 목록 전체 선택"
                  checked={
                    visibleFiles.length > 0 &&
                    visibleFiles.every((file) => file.isAdminSpace || selectedIds.has(file.id))
                  }
                  onChange={(event) => toggleSelectAll(event.currentTarget.checked)}
                />
                <span>
                  {selectedFiles.length > 0 ? `${selectedFiles.length}개 선택됨` : '전체 선택'}
                </span>
              </label>
              {selectedFiles.length === 0 && (
                <span className="selection-help">
                  Shift 키로 여러 항목을 연속 선택할 수 있습니다.
                </span>
              )}
            </div>
          )}
          {canEditCurrentFolder && (
            <p className="privacy-banner" role="note">
              <span aria-hidden="true">!</span> 업로드한 파일은 관리자가 확인할 수 있습니다.
            </p>
          )}
          {!trash && canEditCurrentFolder && (
            <p className="drop-hint" aria-live="polite">
              파일이나 폴더를 폴더 위로 끌어다 놓으면 이동합니다.
            </p>
          )}
          {trash && <p className="drop-hint">휴지통의 파일은 7일 후 자동으로 영구 삭제됩니다.</p>}
          {showRequests && invitations.length > 0 && (
            <section className="share-invitation-banner" aria-label="공유 폴더 요청">
              <strong>공유 폴더 요청</strong>
              {invitations.map((invitation) => (
                <div className="invitation-row" key={invitation.id}>
                  <span>
                    {invitation.folderName ?? '공유 폴더'}
                    {invitation.inviterName ? ` · ${invitation.inviterName}` : ''}
                  </span>
                  <button
                    className="primary-button"
                    disabled={respondingInvitationId === invitation.id}
                    onClick={() => void respondToInvitation(invitation, true)}
                  >
                    수락
                  </button>
                  <button
                    className="secondary-button"
                    disabled={respondingInvitationId === invitation.id}
                    onClick={() => void respondToInvitation(invitation, false)}
                  >
                    거절
                  </button>
                </div>
              ))}
            </section>
          )}
          <nav className="breadcrumbs" aria-label="폴더 경로">
            <button
              className="parent-folder-button"
              aria-label={folderId ? '상위 폴더로 이동' : '상위 폴더 없음'}
              disabled={!folderId}
              onClick={goToParentFolder}
            >
              <span aria-hidden="true">←</span>
              상위 폴더
            </button>
            <span className="breadcrumb-divider" aria-hidden="true">
              ·
            </span>
            <button
              className={!folderId ? 'current' : ''}
              data-parent-drop-id={rootParentId ?? undefined}
              onDragOver={(event) => rootParentId && handleNativeDragOver(event, rootParentId)}
              onDragLeave={(event) => rootParentId && handleNativeDragLeave(event, rootParentId)}
              onDrop={(event) => rootParentId && handleNativeDrop(event, rootParentId)}
              onClick={() => {
                if (consumeSuppressedFileClick()) return;
                dispatchNavigation({ type: 'open-root' });
              }}
            >
              {showRequests ? '공유 요청' : showShared ? '공유 폴더' : '저장 공간'}
            </button>
            {folderPath.map((folder, index) => (
              <span key={folder.id} className="breadcrumb-segment">
                <span aria-hidden="true">/</span>
                <button
                  className={index === folderPath.length - 1 ? 'current' : ''}
                  data-folder-drop-id={folder.id}
                  data-parent-drop-id={folder.id}
                  onDragOver={(event) => handleNativeDragOver(event, folder.id)}
                  onDragLeave={(event) => handleNativeDragLeave(event, folder.id)}
                  onDrop={(event) => handleNativeDrop(event, folder.id)}
                  onClick={() => {
                    if (consumeSuppressedFileClick()) return;
                    dispatchNavigation({ type: 'open-breadcrumb', index });
                  }}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </nav>
          <div
            className="file-table"
            aria-busy={loading || refreshing}
            onDragOver={(event) => {
              if ((event.target as HTMLElement).closest('[data-folder-drop-id]')) return;
              handleExternalDragOver(event, folderId);
            }}
            onDragLeave={(event) => {
              if ((event.target as HTMLElement).closest('[data-folder-drop-id]')) return;
              handleExternalDragLeave(event, folderId);
            }}
            onDrop={(event) => {
              if ((event.target as HTMLElement).closest('[data-folder-drop-id]')) return;
              handleExternalDrop(event, folderId);
            }}
          >
            {refreshing && !loading && (
              <div className="table-refresh-bar" role="progressbar" aria-label="목록 새로고침 중" />
            )}
            <div className="table-head" role="row">
              {!sharedFolderIndex && <span aria-hidden="true" />}
              {!sharedFolderIndex && <span aria-hidden="true" />}
              <span role="columnheader">
                <button
                  type="button"
                  className={`table-head-btn ${sortBy === 'name' ? 'active' : ''}`}
                  onClick={() => handleSortClick('name')}
                >
                  이름 {sortBy === 'name' ? (sortDescending ? '↓' : '↑') : ''}
                </button>
              </span>
              <span role="columnheader">
                <button
                  type="button"
                  className={`table-head-btn ${sortBy === 'size' ? 'active' : ''}`}
                  onClick={() => handleSortClick('size')}
                >
                  크기 {sortBy === 'size' ? (sortDescending ? '↓' : '↑') : ''}
                </button>
              </span>
              <span role="columnheader">
                <button
                  type="button"
                  className={`table-head-btn ${sortBy === 'modifiedTime' ? 'active' : ''}`}
                  onClick={() => handleSortClick('modifiedTime')}
                >
                  수정 {sortBy === 'modifiedTime' ? (sortDescending ? '↓' : '↑') : ''}
                </button>
              </span>
              <span role="columnheader">작업</span>
            </div>
            {loading ? (
              <TableSkeleton rows={6} />
            ) : files.length === 0 ? (
              <div className="empty-row">
                <span className="empty-symbol" aria-hidden="true">
                  {showRequests ? '↗' : trash ? '♧' : '＋'}
                </span>
                <strong>
                  {showRequests
                    ? '새 공유 요청이 없습니다.'
                    : showShared
                      ? '공유받은 폴더가 없습니다.'
                      : trash
                        ? '휴지통이 비어 있습니다.'
                        : '파일이 없습니다.'}
                </strong>
                <small>
                  {showRequests
                    ? '새 요청이 도착하면 이곳에서 수락하거나 거절할 수 있습니다.'
                    : showShared
                      ? '다른 사용자가 폴더를 공유하면 여기에 표시됩니다.'
                      : trash
                        ? '삭제한 항목은 여기에서 복구할 수 있어요.'
                        : '새 폴더를 만들거나 파일을 업로드하세요.'}
                </small>
              </div>
            ) : (
              visibleFiles.map((file) => (
                <div
                  className={`file-row ${
                    moveDropTarget === file.id ? 'file-row-drop-target' : ''
                  } ${draggingFiles.some((item) => item.id === file.id) ? 'file-row-dragging' : ''} ${isOperationPending(file.id) ? 'file-row-pending' : ''}`}
                  key={file.id}
                  aria-busy={isOperationPending(file.id)}
                  onPointerDown={(event) => !sharedFolderIndex && beginPointerDrag(event, file)}
                  onPointerMove={(event) => handlePointerMove(event.nativeEvent)}
                  onPointerUp={(event) => handlePointerUp(event.nativeEvent)}
                  onPointerCancel={(event) => handlePointerCancel(event.nativeEvent)}
                  onContextMenu={(event) => openContextMenu(event, file)}
                  onKeyDown={(event) => openKeyboardContextMenu(event, file)}
                  tabIndex={0}
                  role="group"
                  draggable={
                    !sharedFolderIndex &&
                    !trash &&
                    !isOperationPending(file.id) &&
                    canEditFile(file)
                  }
                  onDragStart={(event) => handleNativeDragStart(event, file)}
                  onDragEnd={handleNativeDragEnd}
                  onDragOver={(event) => isFolder(file) && handleFolderDragOver(event, file)}
                  onDragLeave={(event) => isFolder(file) && handleNativeDragLeave(event, file.id)}
                  onDrop={(event) => isFolder(file) && handleFolderDrop(event, file)}
                  data-folder-drop-id={isFolder(file) ? file.id : undefined}
                  aria-label={
                    isFolder(file)
                      ? `${file.name} 폴더${sharedFolderIndex ? '' : ', 이동 대상'}`
                      : file.name
                  }
                >
                  {!sharedFolderIndex && (
                    <>
                      <span
                        className="drag-handle"
                        aria-hidden="true"
                        title={canEditFile(file) ? '이동할 파일 끌기' : '이동할 수 없는 항목'}
                      >
                        ⠿
                      </span>
                      <input
                        type="checkbox"
                        aria-label={`${file.name} 선택`}
                        checked={selectedIds.has(file.id)}
                        disabled={Boolean(file.isAdminSpace) || isOperationPending(file.id)}
                        onChange={(event) =>
                          toggleSelect(
                            file.id,
                            event.currentTarget.checked,
                            (event.nativeEvent as MouseEvent).shiftKey === true
                          )
                        }
                      />
                    </>
                  )}
                  <button
                    className={`file-main ${isFolder(file) ? 'folder-link' : ''}`}
                    aria-label={isFolder(file) ? `${file.name} 폴더 열기` : `${file.name} 미리보기`}
                    onClick={() =>
                      consumeSuppressedFileClick()
                        ? undefined
                        : isFolder(file)
                          ? openFolder(file)
                          : openPreview(file)
                    }
                  >
                    <FileIcon
                      name={file.name}
                      mimeType={file.mimeType}
                      thumbnailUrl={
                        !mockMode && (isImage(file) || isVideo(file))
                          ? `/api/files/${file.id}/thumbnail`
                          : null
                      }
                    />
                    <span className="file-copy">
                      <strong>{file.name}</strong>
                      <small>
                        {file.isAdminSpace
                          ? '사용자 개인 공간'
                          : file.ownerName
                            ? `${file.ownerName}의 공유 폴더`
                            : file.sharedByMe
                              ? '내가 공유한 폴더'
                              : file.uploadedBy
                                ? `${file.uploadedBy} · ${
                                    file.uploadedAt
                                      ? formatWorkspaceTimestamp(file.uploadedAt, true)
                                      : '업로드'
                                  }`
                                : file.mimeType.split('/').pop()}
                      </small>
                      {file.sharedByMe && (
                        <em className="shared-summary">
                          {file.sharedWithCount ?? 0}명과 공유
                          {file.sharedWithNames?.length
                            ? ` · ${file.sharedWithNames.join(', ')}`
                            : ''}
                          {file.sharedWithCount &&
                          file.sharedWithCount > (file.sharedWithNames?.length ?? 0)
                            ? ' 외'
                            : ''}
                        </em>
                      )}
                    </span>
                  </button>
                  <span className="file-meta">
                    {isFolder(file) ? '폴더' : formatBytes(file.size)}
                  </span>
                  <span className="file-meta">
                    {file.modifiedTime ? formatWorkspaceTimestamp(file.modifiedTime) : '—'}
                  </span>
                  <div className="row-actions">
                    {canEditFile(file) && (
                      <button className="row-action-btn" onClick={() => beginRename(file)}>
                        이름 변경
                      </button>
                    )}
                    {!trash && !isFolder(file) && isPreviewable(file) && (
                      <button className="row-action-btn" onClick={() => openPreview(file)}>
                        미리보기
                      </button>
                    )}
                    {!trash && file.canShare && (
                      <button
                        className="row-action-btn"
                        onClick={() => void openShareSettings(file)}
                      >
                        공유
                      </button>
                    )}
                    {!trash && !isFolder(file) && canEditFile(file) && (
                      <button
                        className="row-action-btn"
                        disabled={mockMode || shareLinkBusyId === file.id}
                        onClick={() => void createFileShareLink(file)}
                      >
                        {shareLinkBusyId === file.id ? '생성 중…' : '링크'}
                      </button>
                    )}
                    {!trash && canTrashFile(file) ? (
                      <button
                        className="row-action-btn danger"
                        disabled={isOperationPending(file.id)}
                        onClick={() => void remove(file)}
                      >
                        삭제
                      </button>
                    ) : null}
                    {trash && (
                      <>
                        <button
                          className="row-action-btn"
                          disabled={isOperationPending(file.id)}
                          onClick={() => void restoreFile(file)}
                        >
                          복구
                        </button>
                        <button
                          className="row-action-btn danger"
                          disabled={isOperationPending(file.id)}
                          onClick={() => void permanentlyDeleteFile(file)}
                        >
                          영구 삭제
                        </button>
                      </>
                    )}
                    {file.mimeType !== 'application/vnd.google-apps.folder' &&
                      (mockMode ? (
                        <button className="row-action-btn" onClick={() => download(file)}>
                          다운로드
                        </button>
                      ) : (
                        <a
                          className="row-action-btn"
                          href={`/api/files/${file.id}/download`}
                          download
                        >
                          다운로드
                        </a>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <FloatingActionBar
          selectedCount={selectedFiles.length}
          totalCount={visibleFiles.length}
          onClearSelection={() =>
            dispatchNavigation({ type: 'replace-selection', ids: new Set(), anchorId: null })
          }
          onSelectAll={(checked) => toggleSelectAll(checked)}
          onDownload={() => void downloadSelected()}
          onTrash={() => void trashSelected()}
          onPermanentDelete={() => void permanentlyDeleteSelected()}
          trash={trash}
          busy={selectionBusy}
          hasDownloadable={selectedFiles.some((f) => !isFolder(f))}
          hasTrashable={selectedFiles.some(canTrashFile)}
        />
        <ToastView
          toasts={toastState.toasts}
          onDismiss={(id) => dispatchToast({ type: 'remove', id })}
        />
        {message && (
          <p className="workspace-message" role="status" aria-live="polite">
            {message}
          </p>
        )}
        {user.role === 'admin' && (
          <p className="muted">관리자 공간과 사용자 관리는 기존 API를 통해 계속 제공됩니다.</p>
        )}
      </div>
      {contextMenu && (
        <div
          className="context-menu"
          role="menu"
          aria-label={`${contextMenu.file.name} 작업 메뉴`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="context-menu-name">{contextMenu.file.name}</p>
          {trash ? (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  const file = contextMenu.file;
                  dispatchWorkspaceModal({ type: 'close-context-menu' });
                  void restoreFile(file);
                }}
              >
                ↺ 복구
              </button>
              <button
                className="context-danger"
                role="menuitem"
                onClick={() => {
                  const file = contextMenu.file;
                  dispatchWorkspaceModal({ type: 'close-context-menu' });
                  void permanentlyDeleteFile(file);
                }}
              >
                ⌁ 영구 삭제
              </button>
            </>
          ) : (
            <>
              {isFolder(contextMenu.file) ? (
                <button
                  role="menuitem"
                  onClick={() => {
                    const file = contextMenu.file;
                    dispatchWorkspaceModal({ type: 'close-context-menu' });
                    openFolder(file);
                  }}
                >
                  ↗ 폴더 열기
                </button>
              ) : isPreviewable(contextMenu.file) ? (
                <button
                  role="menuitem"
                  onClick={() => {
                    const file = contextMenu.file;
                    dispatchWorkspaceModal({ type: 'close-context-menu' });
                    openPreview(file);
                  }}
                >
                  ◉ 미리보기
                </button>
              ) : null}
              {contextMenu.file.canShare && (
                <button
                  role="menuitem"
                  onClick={() => {
                    const file = contextMenu.file;
                    dispatchWorkspaceModal({ type: 'close-context-menu' });
                    void openShareSettings(file);
                  }}
                >
                  ◇ 공유 관리
                </button>
              )}
              {canEditFile(contextMenu.file) && (
                <button
                  role="menuitem"
                  onClick={() => {
                    const file = contextMenu.file;
                    dispatchWorkspaceModal({ type: 'close-context-menu' });
                    beginRename(file);
                  }}
                >
                  ✎ 이름 변경
                </button>
              )}
              {!isFolder(contextMenu.file) && (
                <button
                  role="menuitem"
                  onClick={() => {
                    const file = contextMenu.file;
                    dispatchWorkspaceModal({ type: 'close-context-menu' });
                    download(file);
                  }}
                >
                  ↓ 다운로드
                </button>
              )}
              {canTrashFile(contextMenu.file) ? (
                <button
                  className="context-danger"
                  role="menuitem"
                  onClick={() => {
                    const file = contextMenu.file;
                    dispatchWorkspaceModal({ type: 'close-context-menu' });
                    void remove(file);
                  }}
                >
                  ⌁ 휴지통으로 이동
                </button>
              ) : contextMenu.file.sharedByMe ? (
                <span className="locked-action" title="공유를 해제한 뒤 삭제할 수 있습니다.">
                  공유 해제 후 삭제
                </span>
              ) : null}
            </>
          )}
        </div>
      )}
      {newFolder.open && (
        <Dialog
          open={newFolder.open}
          onOpenChange={(open) => {
            if (!open) dispatchWorkspaceModal({ type: 'close-new-folder' });
          }}
        >
          <DialogContent className="modal">
            <DialogHeader>
              <DialogTitle>새 폴더</DialogTitle>
              <DialogDescription>이 공간 안에 새 폴더를 만들어요.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void createFolder();
              }}
            >
              <UiLabel className="form-field">
                <span>폴더 이름</span>
                <UiInput
                  autoFocus
                  placeholder="예: 프로젝트 자료"
                  value={newFolder.name}
                  onChange={(event) =>
                    dispatchWorkspaceModal({
                      type: 'set-new-folder-name',
                      name: event.target.value
                    })
                  }
                />
              </UiLabel>
              {newFolder.error && <p className="modal-error">{newFolder.error}</p>}
              <DialogFooter className="modal-actions">
                <UiButton
                  variant="outline"
                  className="secondary-button"
                  type="button"
                  onClick={() => dispatchWorkspaceModal({ type: 'close-new-folder' })}
                >
                  취소
                </UiButton>
                <UiButton
                  variant="default"
                  className="primary-button"
                  disabled={newFolder.busy || !newFolder.name.trim()}
                  type="submit"
                >
                  {newFolder.busy ? '만드는 중…' : '폴더 만들기'}
                </UiButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {renameModal.file && (
        <Dialog
          open={Boolean(renameModal.file)}
          onOpenChange={(open) => {
            if (!open) dispatchWorkspaceModal({ type: 'close-rename' });
          }}
        >
          <DialogContent className="modal">
            <DialogHeader>
              <DialogTitle>이름 변경</DialogTitle>
              <DialogDescription>파일을 찾기 쉬운 이름으로 바꿔보세요.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void rename();
              }}
            >
              <UiLabel className="form-field">
                <span>새 이름</span>
                <UiInput
                  autoFocus
                  aria-label="새 이름"
                  value={renameModal.name}
                  onChange={(event) =>
                    dispatchWorkspaceModal({ type: 'set-rename-name', name: event.target.value })
                  }
                />
              </UiLabel>
              <DialogFooter className="modal-actions">
                <UiButton
                  variant="outline"
                  className="secondary-button"
                  type="button"
                  onClick={() => dispatchWorkspaceModal({ type: 'close-rename' })}
                >
                  취소
                </UiButton>
                <UiButton
                  variant="default"
                  className="primary-button"
                  disabled={renameModal.busy || !renameModal.name.trim()}
                  type="submit"
                >
                  {renameModal.busy ? '저장 중…' : '저장'}
                </UiButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {uploads.length > 0 && showUploadTray && (
        <section className="upload-tray" aria-label="업로드 현황">
          <div className="tray-title">
            <strong>업로드 현황</strong>
            <button onClick={() => dispatchUploadPanel({ type: 'set-tray', open: false })}>
              닫기
            </button>
          </div>
          {uploads.map((item) => (
            <div className="upload-line" key={item.id}>
              <span>
                {item.name} ·{' '}
                {item.status === 'uploading'
                  ? `${item.progress}%`
                  : item.status === 'complete'
                    ? '완료'
                    : item.status === 'cancelled'
                      ? '취소됨'
                      : (item.error ?? '실패')}
              </span>
              {item.status === 'uploading' && (
                <button onClick={() => void cancelUpload(item)}>취소</button>
              )}
              {(item.status === 'error' || item.status === 'cancelled') && (
                <button onClick={() => retryUpload(item)}>재시도</button>
              )}
              <div className="progress">
                <i style={{ width: `${item.progress}%` }} />
              </div>
            </div>
          ))}
        </section>
      )}
      {activeUploads.length > 0 && !showUploadTray && (
        <button
          className="upload-status-chip"
          onClick={() => dispatchUploadPanel({ type: 'set-tray', open: true })}
        >
          업로드 {activeUploads.length}개 진행 중 · {uploadProgress}%
        </button>
      )}
      {uploadConflicts.length > 0 && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal conflict-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-conflict-title"
          >
            <h2 id="upload-conflict-title">같은 이름의 파일</h2>
            <p className="modal-description">
              {uploadConflicts[0].file.name} 파일이 현재 폴더에 이미 있습니다.
            </p>
            <div className="conflict-actions">
              <button
                className="secondary-button"
                onClick={() => resolveUploadConflicts('skip', false)}
              >
                건너뛰기
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  resolveUploadConflicts('replace', false);
                }}
              >
                새 파일로 교체
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  resolveUploadConflicts('overwrite', false);
                }}
              >
                덮어쓰기
              </button>
            </div>
            {uploadConflicts.length > 1 && (
              <div className="conflict-apply-all">
                <strong>나머지 {uploadConflicts.length - 1}개에도 적용</strong>
                <div className="conflict-batch-actions">
                  <button
                    className="secondary-button"
                    onClick={() => resolveUploadConflicts('skip', true)}
                  >
                    모두 건너뛰기
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => resolveUploadConflicts('replace', true)}
                  >
                    모두 교체
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => resolveUploadConflicts('overwrite', true)}
                  >
                    모두 덮어쓰기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {previewFile && (
        <div
          className="modal-backdrop preview-backdrop"
          role="presentation"
          onClick={(event) =>
            event.currentTarget === event.target &&
            dispatchWorkspaceModal({ type: 'close-preview' })
          }
        >
          <div
            className="preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
          >
            <header className="preview-header">
              <div>
                <h2 id="preview-title">{previewFile.name}</h2>
                <p className="preview-file-meta">
                  {previewFile.mimeType.split('/').pop()?.toUpperCase() ?? '파일'}
                  <span aria-hidden="true">·</span>
                  {formatBytes(previewFile.size)}
                  {previewFile.modifiedTime && (
                    <>
                      <span aria-hidden="true">·</span>
                      {formatWorkspaceTimestamp(previewFile.modifiedTime)}
                    </>
                  )}
                </p>
              </div>
              <div className="preview-actions">
                <button className="secondary-button" onClick={() => download(previewFile)}>
                  다운로드
                </button>
                <button
                  className="modal-close"
                  aria-label="닫기"
                  onClick={() => dispatchWorkspaceModal({ type: 'close-preview' })}
                >
                  ×
                </button>
              </div>
            </header>
            <div className="preview-stage">
              {previewFile.mimeType.startsWith('video/') &&
                (mockMode ? (
                  <p className="preview-placeholder">모킹 동영상 미리보기</p>
                ) : (
                  <video
                    src={`/api/files/${previewFile.id}/preview`}
                    controls
                    autoPlay
                    playsInline
                  />
                ))}
              {previewFile.mimeType.startsWith('audio/') &&
                (mockMode ? (
                  <p className="preview-placeholder">모킹 오디오 미리보기</p>
                ) : (
                  <audio src={`/api/files/${previewFile.id}/preview`} controls autoPlay />
                ))}
              {previewFile.mimeType.startsWith('image/') && (
                <img
                  src={
                    mockMode
                      ? (buildMockPreviewSource(previewFile) ?? '')
                      : `/api/files/${previewFile.id}/preview`
                  }
                  alt={previewFile.name}
                />
              )}
              {previewFile.mimeType === 'application/pdf' &&
                (mockMode ? (
                  <p className="preview-placeholder">모킹 PDF 미리보기</p>
                ) : (
                  <iframe title={previewFile.name} src={`/api/files/${previewFile.id}/preview`} />
                ))}
              {previewFile.mimeType.startsWith('text/') && (
                <iframe
                  title={previewFile.name}
                  src={
                    mockMode
                      ? (buildMockPreviewSource(previewFile) ?? '')
                      : `/api/files/${previewFile.id}/preview`
                  }
                />
              )}
            </div>
          </div>
        </div>
      )}
      {inviteModal.open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) =>
            event.currentTarget === event.target && dispatchWorkspaceModal({ type: 'close-invite' })
          }
        >
          <div className="modal" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              aria-label="닫기"
              onClick={() => dispatchWorkspaceModal({ type: 'close-invite' })}
            >
              ×
            </button>
            <h2>같이 쓸 사람을 초대하세요.</h2>
            <div className="invite-link-box">
              <span className="invite-link mono">{inviteModal.link}</span>
              <button
                className="primary-button"
                onClick={() => {
                  void copyTextToClipboard(inviteModal.link);
                  showToast('초대 링크가 복사되었습니다.', 'success');
                }}
              >
                링크 복사
              </button>
            </div>
          </div>
        </div>
      )}
      {showProfile && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) =>
            event.currentTarget === event.target && dispatchProfile({ type: 'close' })
          }
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
            <button
              className="modal-close"
              aria-label="닫기"
              onClick={() => dispatchProfile({ type: 'close' })}
            >
              ×
            </button>
            <h2 id="profile-title">내 정보</h2>
            <button className="avatar-picker" onClick={() => avatarInputRef.current?.click()}>
              {profileAvatarUrl ? (
                <img className="avatar avatar-image" src={profileAvatarUrl} alt="내 아바타" />
              ) : (
                '아바타 변경'
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(event) => void readAvatar(event)}
            />
            <div className="login-id-row">
              <span>
                <strong>로그인 아이디</strong>
                <small>로그인할 때 사용하는 고정 아이디입니다.</small>
              </span>
              <button
                className="login-id-value"
                type="button"
                aria-label="로그인 아이디 표시 전환"
                onClick={() =>
                  dispatchProfile({ type: 'set-login-id-revealed', value: !loginIdRevealed })
                }
              >
                {loginIdRevealed ? (user.loginId ?? '없음') : '••••••••'}
              </button>
            </div>
            <label className="form-field">
              <span>핸들</span>
              <input
                value={profileHandle}
                onChange={(event) =>
                  dispatchProfile({ type: 'set-handle', value: event.target.value })
                }
              />
            </label>
            <label className="form-field">
              <span>현재 비밀번호</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) =>
                  dispatchProfile({ type: 'set-current-password', value: event.target.value })
                }
              />
            </label>
            <label className="form-field">
              <span>새 비밀번호</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) =>
                  dispatchProfile({ type: 'set-new-password', value: event.target.value })
                }
              />
            </label>
            {profileMessage && <p className="modal-error">{profileMessage}</p>}
            <button
              className="primary-button"
              disabled={profileBusy}
              onClick={() => void saveProfile()}
            >
              {profileBusy ? '저장 중…' : '변경사항 저장'}
            </button>
            <h3>패스키</h3>
            <button
              className="secondary-button"
              disabled={profileBusy || mockMode || !supportsPasskeys}
              onClick={() => void addPasskey()}
            >
              {supportsPasskeys ? '패스키 등록' : '이 브라우저는 패스키 미지원'}
            </button>
            {profileLoading ? (
              <p className="muted">패스키를 불러오는 중…</p>
            ) : profilePasskeys.length ? (
              profilePasskeys.map((passkey) => (
                <div className="invitation-row" key={passkey.id}>
                  <span className="muted">{passkey.name ?? '등록된 패스키'}</span>
                  <button
                    className="danger-button"
                    disabled={profileBusy}
                    onClick={() => void removePasskey(passkey)}
                  >
                    제거
                  </button>
                </div>
              ))
            ) : (
              <p className="muted">
                등록된 패스키가 없습니다. 비밀번호 로그인을 계속 사용할 수 있습니다.
              </p>
            )}
            <section className="account-deletion" aria-labelledby="account-deletion-title">
              <div>
                <h3 id="account-deletion-title">계정 삭제</h3>
                <p className="muted">
                  삭제 요청 후에는 바로 로그아웃되며, 파일 정리는 백그라운드에서 이어집니다.
                </p>
              </div>
              {!showAccountDeletion ? (
                <button
                  className="danger-button"
                  disabled={profileBusy || mockMode}
                  onClick={() =>
                    dispatchProfile({ type: 'set-account-deletion-open', value: true })
                  }
                >
                  계정 삭제
                </button>
              ) : (
                <AlertDialog
                  open={showAccountDeletion}
                  onOpenChange={(open) =>
                    dispatchProfile({ type: 'set-account-deletion-open', value: open })
                  }
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>계정 영구 삭제</AlertDialogTitle>
                      <AlertDialogDescription>
                        삭제 요청 후에는 바로 로그아웃되며, 파일 정리는 백그라운드에서 이어집니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <p className="modal-error">이 작업은 되돌릴 수 없습니다.</p>
                    {accountDeletionScope.map((scope, index) => {
                      const key = ['files', 'shares', 'passkeys'][
                        index
                      ] as keyof typeof deletionAcknowledged;
                      return (
                        <label className="deletion-check" key={key}>
                          <input
                            type="checkbox"
                            checked={deletionAcknowledged[key]}
                            onChange={(event) =>
                              dispatchProfile({
                                type: 'set-deletion-acknowledged',
                                key,
                                value: event.currentTarget.checked
                              })
                            }
                          />
                          <span>{scope}</span>
                        </label>
                      );
                    })}
                    <UiLabel className="form-field">
                      <span>
                        계속하려면 <code>{ACCOUNT_DELETION_CONFIRMATION}</code>를 입력하세요
                      </span>
                      <UiInput
                        value={deletionConfirmation}
                        onChange={(event) =>
                          dispatchProfile({
                            type: 'set-deletion-confirmation',
                            value: event.target.value
                          })
                        }
                        autoComplete="off"
                      />
                    </UiLabel>
                    <AlertDialogFooter>
                      <AlertDialogCancel asChild>
                        <UiButton variant="outline" disabled={profileBusy}>
                          취소
                        </UiButton>
                      </AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <UiButton
                          variant="destructive"
                          disabled={
                            profileBusy ||
                            deletionConfirmation.trim() !== ACCOUNT_DELETION_CONFIRMATION ||
                            !deletionAcknowledged.files ||
                            !deletionAcknowledged.shares ||
                            !deletionAcknowledged.passkeys
                          }
                          onClick={() => void deleteAccount()}
                        >
                          {profileBusy ? '삭제 요청 중…' : '계정 영구 삭제'}
                        </UiButton>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </section>
          </div>
        </div>
      )}
      {showUsers && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) =>
            event.currentTarget === event.target && dispatchAdmin({ type: 'close' })
          }
        >
          <div className="modal wide-modal" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              aria-label="닫기"
              onClick={() => dispatchAdmin({ type: 'close' })}
            >
              ×
            </button>
            <h2>멤버 관리</h2>
            {membersOnly(users).map((member) => (
              <Fragment key={member.id ?? member.loginId}>
                <div className="invitation-row">
                  <span>
                    {member.displayName} · @{member.handle ?? member.loginId}
                  </span>
                  {member.status === 'active' || member.status === 'disabled' ? (
                    <button
                      className="secondary-button"
                      disabled={updatingMemberId === member.id}
                      onClick={() =>
                        void setUserStatus(
                          member.id ?? '',
                          member.status === 'disabled' ? 'active' : 'disabled'
                        )
                      }
                    >
                      {member.status === 'disabled' ? '활성화' : '비활성화'}
                    </button>
                  ) : (
                    <span className="muted">등록 완료 대기</span>
                  )}
                  {member.id && member.status === 'active' && (
                    <button
                      className="secondary-button"
                      disabled={updatingMemberId === member.id}
                      onClick={() => void createDirectResetLink(member)}
                    >
                      변경 링크 생성
                    </button>
                  )}
                </div>
                {member.id && generatedResetLinks[member.id] && (
                  <div className="member-link-result">
                    <span className="mono reset-link">
                      {generatedResetLinks[member.id ?? ''].link}
                    </span>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        void copyTextToClipboard(generatedResetLinks[member.id ?? ''].link)
                      }
                    >
                      복사
                    </button>
                    <small>
                      {formatWorkspaceTimestamp(
                        generatedResetLinks[member.id ?? ''].expiresAt,
                        true
                      )}
                      까지 유효
                    </small>
                  </div>
                )}
              </Fragment>
            ))}
            <h3>분실 요청</h3>
            {resetRequests.length === 0 ? (
              <p className="muted">대기 중인 요청이 없습니다.</p>
            ) : (
              resetRequests.map((request) => (
                <div className="invitation-row" key={request.id}>
                  <span>
                    {request.display_name} · {request.login_id}
                  </span>
                  {request.link ? (
                    <>
                      <span className="mono reset-link">{request.link}</span>
                      <button
                        className="secondary-button"
                        onClick={() => void copyTextToClipboard(request.link ?? '')}
                      >
                        복사
                      </button>
                    </>
                  ) : (
                    <button
                      className="secondary-button"
                      onClick={() => void createResetLink(request)}
                    >
                      변경 링크 생성
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {sharingFolder && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) =>
            event.currentTarget === event.target && dispatchShare({ type: 'close' })
          }
        >
          <div
            className="modal wide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
          >
            <button
              className="modal-close"
              aria-label="닫기"
              onClick={() => dispatchShare({ type: 'close' })}
            >
              ×
            </button>
            <h2 id="share-title">{sharingFolder.name} 공유 관리</h2>
            <p className="muted">
              현재 공유 중인 사용자를 확인하고, 권한을 바꾸거나 제거할 수 있습니다.
            </p>
            <section className="share-member-section" aria-labelledby="current-share-members-title">
              <div className="share-member-section-heading">
                <h3 id="current-share-members-title">현재 공유 중</h3>
                <span>{currentShareMembers.length}명</span>
              </div>
              {currentShareMembers.length === 0 ? (
                <p className="muted">아직 공유한 사용자가 없습니다.</p>
              ) : (
                currentShareMembers.map((member) => (
                  <div className="share-member-row" key={member.id}>
                    <span>
                      <strong>{member.displayName}</strong>
                      {member.handle ? ` · @${member.handle}` : ''}
                      {member.status === 'pending' && <em>초대 대기</em>}
                    </span>
                    <label className="sr-only" htmlFor={`share-permission-${member.id}`}>
                      {member.displayName} 권한
                    </label>
                    <select
                      id={`share-permission-${member.id}`}
                      aria-label={`${member.displayName} 권한`}
                      value={member.permission ?? 'viewer'}
                      onChange={(event) =>
                        setShareMemberPermission(
                          member.id,
                          event.target.value as 'viewer' | 'editor'
                        )
                      }
                    >
                      <option value="viewer">보기</option>
                      <option value="editor">편집</option>
                    </select>
                    <button
                      className="secondary-button"
                      onClick={() => setShareMemberSelected(member.id, false)}
                    >
                      제거
                    </button>
                  </div>
                ))
              )}
            </section>
            <label className="form-field">
              <span>사용자 추가</span>
              <input
                placeholder="이름 또는 @handle"
                value={shareQuery}
                onChange={(event) => {
                  const query = event.target.value;
                  dispatchShare({ type: 'set-query', query });
                  void searchShareUsers(query);
                }}
              />
            </label>
            {shareSearchBusy && <p className="form-hint">사용자 목록을 찾는 중…</p>}
            {shareSearchError && <p className="modal-error">{shareSearchError}</p>}
            {availableShareMembers.length === 0 ? (
              <p className="muted">추가할 수 있는 다른 사용자가 없습니다.</p>
            ) : (
              availableShareMembers.map((member) => (
                <div className="share-member-row" key={member.id}>
                  <span>
                    <strong>{member.displayName}</strong>
                    {member.handle ? ` · @${member.handle}` : ''}
                  </span>
                  <button
                    className="secondary-button"
                    onClick={() => setShareMemberSelected(member.id, true)}
                  >
                    추가
                  </button>
                </div>
              ))
            )}
            <button
              className="primary-button"
              disabled={savingShares || shareSearchBusy}
              onClick={() => void saveShareSettings()}
            >
              {savingShares ? '저장 중…' : '공유 설정 저장'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
