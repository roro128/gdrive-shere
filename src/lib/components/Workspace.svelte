<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import { authClient } from '$lib/client';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { animateElement } from '$lib/dom-animation';
  import {
    createInternalDragPayload,
    INTERNAL_FILE_DRAG_TYPE,
    moveFiles,
    readInternalDragIds
  } from '$lib/file-move';

  type FileItem = {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    parents?: string[];
    modifiedTime?: string;
    shared?: boolean;
    canShare?: boolean;
    isAdminSpace?: boolean;
    ownerName?: string;
    uploadedBy?: string;
    uploadedAt?: string;
    permission?: 'owner' | 'viewer' | 'editor';
  };
  type UploadItem = {
    id: string;
    name: string;
    progress: number;
    status: 'uploading' | 'complete' | 'error' | 'cancelled';
    error?: string;
    sessionId?: string;
  };
  type ConflictAction = 'replace' | 'overwrite' | 'skip';
  type UploadConflict = { file: File; existing: FileItem; parentId: string | null };
  type SortKey = 'name' | 'size' | 'modifiedTime';
  type User = {
    id: string;
    displayName: string;
    handle?: string | null;
    loginId?: string | null;
    avatarUrl?: string | null;
    role: 'admin' | 'member';
    status: string;
  };
  type GeneratedResetLink = { link: string; expiresAt: string };
  type Passkey = { id: string; name: string | null; createdAt: string | number | Date };
  type ResetRequest = {
    id: string;
    user_id: string;
    login_id: string;
    display_name: string;
    status: 'pending' | 'link_created' | 'completed';
    created_at: string;
    expires_at?: string;
    link?: string;
  };
  type ShareUser = {
    id: string;
    displayName: string;
    handle: string | null;
    loginId: string | null;
  };
  type ShareInvitation = {
    id: string;
    folderName: string;
    ownerName: string;
    permission: 'viewer' | 'editor';
  };
  type ContextMenu = { file: FileItem; x: number; y: number };
  type StorageQuota = { limit: number | null; usage: number; available: boolean };
  type CachedFileList = { files: FileItem[]; cachedAt: number };

  const FILE_LIST_CACHE_TTL_MS = 15_000;
  const SEARCH_DEBOUNCE_MS = 350;

  let { user, googleConnected } = $props<{ user: User; googleConnected: boolean }>();
  let files = $state<FileItem[]>([]);
  let currentFolderId = $state<string | null>(null);
  let search = $state('');
  let loading = $state(false);
  let fileLoadGeneration = 0;
  let fileListRequestController: AbortController | null = null;
  let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  let dragging = $state(false);
  let dragDepth = $state(0);
  let dropTargetFolder = $state<FileItem | null>(null);
  let draggingFiles = $state<FileItem[]>([]);
  let moveDropTarget = $state<string | null | undefined>(undefined);
  let message = $state('');
  let uploads = $state<UploadItem[]>([]);
  let showUploadTray = $state(true);
  let uploadConflicts = $state<UploadConflict[]>([]);
  let applyConflictAction = $state<ConflictAction | null>(null);
  let showTrash = $state(false);
  let showShared = $state(false);
  let currentFolderName = $state('');
  let folderPath = $state<FileItem[]>([]);
  let spaceRootId = $state<string | null>(null);
  let sortBy = $state<SortKey>('name');
  let sortDescending = $state(false);
  let selected = new SvelteSet<string>();
  let lastSelectedId = $state<string | null>(null);
  let selectAllCheckbox = $state<HTMLInputElement | null>(null);
  let showInvite = $state(false);
  let inviteLink = $state('');
  let newFolderName = $state('');
  let newFolderError = $state('');
  let showNewFolder = $state(false);
  let creatingFolder = $state(false);
  let showProfile = $state(false);
  let profilePasskeys = $state<Passkey[]>([]);
  let profileLoading = $state(false);
  let profileBusy = $state(false);
  let profileMessage = $state('');
  let profileHandle = $state('');
  let profileAvatarUrl = $state<string | null>(null);
  let loginIdRevealed = $state(false);
  let currentPassword = $state('');
  let newPassword = $state('');
  let avatarInput = $state<HTMLInputElement | null>(null);
  let editingFile = $state<FileItem | null>(null);
  let editName = $state('');
  let showUsers = $state(false);
  let users = $state<User[]>([]);
  let sharingFolder = $state<FileItem | null>(null);
  let shareUsers = $state<ShareUser[]>([]);
  let sharedUserIds = new SvelteSet<string>();
  let sharePermissions = new SvelteMap<string, 'viewer' | 'editor'>();
  let shareQuery = $state('');
  let pendingShareInvitations = $state<ShareInvitation[]>([]);
  let respondingInvitation = $state<string | null>(null);
  let savingShares = $state(false);
  let resetRequests = $state<ResetRequest[]>([]);
  let generatedResetLinks = $state<Record<string, GeneratedResetLink>>({});
  let updatingMemberId = $state<string | null>(null);
  let loggingOut = $state(false);
  let busySelectionAction = $state<'download' | 'trash' | null>(null);
  let contextMenu = $state<ContextMenu | null>(null);
  let previewFile = $state<FileItem | null>(null);
  let storageQuota = $state<StorageQuota | null>(null);
  const uploadFilesById = new SvelteMap<string, File>();
  const uploadControllers = new SvelteMap<string, AbortController>();
  const fileListCache = new SvelteMap<string, CachedFileList>();

  function replaceSelection(ids: Iterable<string>) {
    selected.clear();
    for (const id of ids) selected.add(id);
  }

  let isAdmin = $derived(user.role === 'admin');
  let folderTitle = $derived(
    showTrash
      ? '휴지통'
      : currentFolderId
        ? currentFolderName || '폴더'
        : isAdmin
          ? '사용자 파일 관리'
          : showShared
            ? '공유 폴더'
            : '내 공간'
  );
  let canUploadCurrent = $derived(
    !isAdmin &&
      !showTrash &&
      (!showShared || (Boolean(currentFolderId) && folderPath.at(-1)?.permission !== 'viewer'))
  );
  let canCreateFolderCurrent = $derived(canUploadCurrent);
  let activeUploads = $derived(uploads.filter((item) => item.status === 'uploading'));
  let activeUploadProgress = $derived(
    activeUploads.length
      ? Math.round(
          activeUploads.reduce((sum, item) => sum + item.progress, 0) / activeUploads.length
        )
      : 0
  );
  let visibleFiles = $derived.by(() => {
    const filtered = files.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
    return filtered.sort((left, right) => {
      const folderOrder = Number(isFolder(right)) - Number(isFolder(left));
      if (folderOrder) return folderOrder;
      let comparison = 0;
      if (sortBy === 'name') comparison = left.name.localeCompare(right.name, 'ko');
      if (sortBy === 'size') comparison = Number(left.size ?? 0) - Number(right.size ?? 0);
      if (sortBy === 'modifiedTime') {
        comparison = (left.modifiedTime ?? '').localeCompare(right.modifiedTime ?? '');
      }
      return sortDescending ? comparison * -1 : comparison;
    });
  });
  let selectableVisibleFiles = $derived(visibleFiles.filter((file) => !file.isAdminSpace));
  let selectedFiles = $derived(selectableVisibleFiles.filter((file) => selected.has(file.id)));
  let selectedDownloadableFiles = $derived(selectedFiles.filter((file) => !isFolder(file)));
  let allVisibleSelected = $derived(
    selectableVisibleFiles.length > 0 &&
      selectableVisibleFiles.every((file) => selected.has(file.id))
  );
  $effect(() => {
    if (selectAllCheckbox) {
      selectAllCheckbox.indeterminate = selectedFiles.length > 0 && !allVisibleSelected;
    }
  });
  let pendingResetCount = $derived(
    resetRequests.filter((request) => request.status === 'pending').length
  );

  onMount(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    if (shell)
      animateElement(
        shell,
        {
          opacity: [0, 1],
          transform: ['translateY(10px)', 'translateY(0)']
        },
        { duration: 0.38, ease: 'easeOut' }
      );
    void loadFiles();
    void loadShareInvitations();
    void loadStorageQuota();
    const onPaste = (event: ClipboardEvent) => {
      if (event.clipboardData?.files.length) void uploadFiles(event.clipboardData.files);
    };
    window.addEventListener('paste', onPaste);
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!activeUploads.length) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => {
      fileListRequestController?.abort();
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('beforeunload', warnBeforeLeaving);
    };
  });

  async function loadStorageQuota() {
    try {
      const response = await fetch('/api/storage');
      if (!response.ok) return;
      const quota = (await response.json()) as StorageQuota;
      storageQuota = quota.available ? quota : null;
    } catch {
      storageQuota = null;
    }
  }

  function isFileDrag(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }

  function isInternalFileDrag(event: DragEvent): boolean {
    return Boolean(
      draggingFiles.length ||
      Array.from(event.dataTransfer?.types ?? []).includes(INTERNAL_FILE_DRAG_TYPE)
    );
  }

  function draggedFilesFromEvent(event: DragEvent): FileItem[] {
    if (draggingFiles.length) return draggingFiles;
    const ids = readInternalDragIds(event.dataTransfer);
    return files.filter((file) => ids.includes(file.id));
  }

  function startFileDrag(event: DragEvent, file: FileItem) {
    if (showTrash || file.isAdminSpace || !googleConnected) return;
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) return;
    dataTransfer.effectAllowed = 'move';
    const filesToMove = selected.has(file.id) ? selectedFiles : [file];
    createInternalDragPayload(dataTransfer, filesToMove);
    dataTransfer.setData('text/plain', file.name);
    draggingFiles = filesToMove;
    moveDropTarget = undefined;
  }

  function clearFileDrag() {
    draggingFiles = [];
    moveDropTarget = undefined;
  }

  function handleMoveDragOver(event: DragEvent, targetParentId: string | null) {
    const filesToMove = draggedFilesFromEvent(event);
    if (!filesToMove.length || filesToMove.some((file) => file.id === targetParentId)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    moveDropTarget = targetParentId;
    const target = event.currentTarget as HTMLElement | null;
    if (target && target.dataset.moveMotion !== 'running') {
      target.dataset.moveMotion = 'running';
      animateElement(
        target,
        { scale: [1, 1.015, 1] },
        { duration: 0.26, ease: 'easeOut' }
      );
      window.setTimeout(() => delete target.dataset.moveMotion, 280);
    }
  }

  function handleMoveDragLeave(event: DragEvent, targetParentId: string | null) {
    if (moveDropTarget !== targetParentId) return;
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && (event.currentTarget as HTMLElement).contains(nextTarget)) return;
    moveDropTarget = undefined;
  }

  async function handleMoveDrop(event: DragEvent, targetParentId: string | null) {
    const filesToMove = draggedFilesFromEvent(event);
    if (!filesToMove.length) return;
    event.preventDefault();
    event.stopPropagation();
    clearFileDrag();
    if (!targetParentId) return;
    const result = await moveFiles(filesToMove, targetParentId, (fileId, parentId) =>
      fetch(`/api/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ parentId })
      })
    );
    if (result.moved.length) {
      const movedIds = result.moved.map((file) => file.id);
      replaceSelection([...selected].filter((id) => !movedIds.includes(id)));
      removeCurrentFiles(movedIds);
      void loadFiles({ force: true });
    }
    if (result.failed.length) {
      message =
        result.moved.length > 0
          ? `${result.moved.length}개 이동, ${result.failed.length}개 실패: ${result.failed[0].message}`
          : result.failed[0].message;
      return;
    }
    if (!result.moved.length) return;
    message =
      result.moved.length === 1
        ? `“${result.moved[0].name}”을(를) 폴더로 이동했습니다.`
        : `${result.moved.length}개 항목을 폴더로 이동했습니다.`;
  }

  function handleDragEnter(event: DragEvent) {
    if (!canUploadCurrent || isInternalFileDrag(event) || !isFileDrag(event)) return;
    event.preventDefault();
    dragDepth += 1;
    dragging = true;
  }

  function handleDragOver(event: DragEvent) {
    if (!canUploadCurrent || isInternalFileDrag(event) || !isFileDrag(event)) return;
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) return;
    event.preventDefault();
    dataTransfer.dropEffect = 'copy';
    dragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    if (!canUploadCurrent || isInternalFileDrag(event) || !isFileDrag(event)) return;
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) {
      dragging = false;
      dropTargetFolder = null;
    }
  }

  function handleFolderDragEnter(event: DragEvent, folder: FileItem) {
    if (!canUploadCurrent || isInternalFileDrag(event) || !isFolder(folder) || !isFileDrag(event))
      return;
    event.preventDefault();
    dropTargetFolder = folder;
    dragging = true;
  }

  function handleFolderDragOver(event: DragEvent, folder: FileItem) {
    if (!canUploadCurrent || isInternalFileDrag(event) || !isFolder(folder) || !isFileDrag(event))
      return;
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) return;
    event.preventDefault();
    dataTransfer.dropEffect = 'copy';
    dropTargetFolder = folder;
  }

  function handleFolderDragLeave(event: DragEvent, folder: FileItem) {
    if (dropTargetFolder?.id !== folder.id) return;
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && (event.currentTarget as HTMLElement).contains(nextTarget)) return;
    dropTargetFolder = null;
  }

  function handleDrop(event: DragEvent) {
    if (!canUploadCurrent || isInternalFileDrag(event) || !isFileDrag(event)) return;
    event.preventDefault();
    const parentId = dropTargetFolder?.id ?? currentFolderId;
    dragDepth = 0;
    dragging = false;
    dropTargetFolder = null;
    void uploadFiles(event.dataTransfer?.files ?? [], parentId);
  }

  function formatBytes(value: number | string | undefined): string {
    const bytes = Number(value ?? 0);
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  function storagePercent(quota: StorageQuota): number {
    if (!quota.limit) return 0;
    return Math.min(100, Math.max(0, (quota.usage / quota.limit) * 100));
  }

  function isFolder(file: FileItem): boolean {
    return file.mimeType === 'application/vnd.google-apps.folder';
  }
  function isPreviewable(file: FileItem): boolean {
    return (
      file.mimeType.startsWith('image/') ||
      file.mimeType.startsWith('video/') ||
      file.mimeType.startsWith('audio/') ||
      file.mimeType === 'application/pdf' ||
      file.mimeType.startsWith('text/')
    );
  }
  function isImage(file: FileItem): boolean {
    return file.mimeType.startsWith('image/');
  }
  function isVideo(file: FileItem): boolean {
    return file.mimeType.startsWith('video/');
  }
  function isAudio(file: FileItem): boolean {
    return file.mimeType.startsWith('audio/');
  }

  function openPreview(file: FileItem) {
    if (isPreviewable(file)) previewFile = file;
  }

  function openContextMenu(event: MouseEvent, file: FileItem) {
    if (file.isAdminSpace) return;
    event.preventDefault();
    const width = 218;
    const height = 292;
    contextMenu = {
      file,
      x: Math.max(12, Math.min(event.clientX, window.innerWidth - width - 12)),
      y: Math.max(12, Math.min(event.clientY, window.innerHeight - height - 12))
    };
  }

  function openContextMenuFromButton(event: MouseEvent, file: FileItem) {
    event.stopPropagation();
    const button = event.currentTarget as HTMLElement;
    const bounds = button.getBoundingClientRect();
    openContextMenu(
      new MouseEvent('contextmenu', { clientX: bounds.right - 8, clientY: bounds.bottom + 6 }),
      file
    );
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function openKeyboardContextMenu(event: KeyboardEvent, file: FileItem) {
    if (file.isAdminSpace) return;
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    event.preventDefault();
    const row = event.currentTarget as HTMLElement;
    const bounds = row.getBoundingClientRect();
    openContextMenu(
      new MouseEvent('contextmenu', { clientX: bounds.left + 32, clientY: bounds.top + 36 }),
      file
    );
  }

  function currentFileListRequest(): {
    endpoint: string;
    params: URLSearchParams;
    cacheKey: string;
  } {
    let endpoint = '/api/files';
    const params = new URLSearchParams();
    if (showTrash) params.set('trash', '1');
    else if (isAdmin && !currentFolderId) endpoint = '/api/admin/spaces';
    else if (showShared && !currentFolderId) endpoint = '/api/shares';
    else if (currentFolderId) params.set('parentId', currentFolderId);
    if (search && endpoint === '/api/files') params.set('search', search);
    return { endpoint, params, cacheKey: `${endpoint}?${params}` };
  }

  function updateCurrentList(nextFiles: FileItem[]) {
    files = nextFiles;
    const available = new Set(nextFiles.map((file) => file.id));
    replaceSelection([...selected].filter((id) => available.has(id)));
    if (lastSelectedId && !available.has(lastSelectedId)) lastSelectedId = null;
    const { cacheKey } = currentFileListRequest();
    fileListCache.set(cacheKey, { files: nextFiles, cachedAt: Date.now() });
  }

  function upsertCurrentFile(file: FileItem) {
    updateCurrentList([...files.filter((item) => item.id !== file.id), file]);
  }

  function removeCurrentFiles(ids: Iterable<string>) {
    const removed = new Set(ids);
    updateCurrentList(files.filter((file) => !removed.has(file.id)));
  }

  function scheduleSearchLoad() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = undefined;
      void loadFiles();
    }, SEARCH_DEBOUNCE_MS);
  }

  async function loadFiles({ force = false }: { force?: boolean } = {}) {
    if (!showTrash && !googleConnected) {
      updateCurrentList([]);
      message = '';
      loading = false;
      return;
    }
    const { endpoint, params, cacheKey } = currentFileListRequest();
    const requestGeneration = ++fileLoadGeneration;
    const cached = fileListCache.get(cacheKey);
    if (cached) updateCurrentList(cached.files);
    if (cached && !force && Date.now() - cached.cachedAt < FILE_LIST_CACHE_TTL_MS) {
      loading = false;
      message = '';
      return;
    }
    fileListRequestController?.abort();
    const controller = new AbortController();
    fileListRequestController = controller;
    loading = true;
    message = '';
    try {
      const response = await fetch(`${endpoint}?${params}`, {
        signal: controller.signal,
        cache: force ? 'no-store' : 'default'
      });
      if (!response.ok) throw new Error(await response.text());
      const freshFiles = ((await response.json()) as { files: FileItem[] }).files;
      fileListCache.set(cacheKey, { files: freshFiles, cachedAt: Date.now() });
      if (requestGeneration !== fileLoadGeneration) return;
      updateCurrentList(freshFiles);
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      message = cause instanceof Error ? cause.message : '파일 목록을 불러오지 못했습니다.';
    } finally {
      if (fileListRequestController === controller) fileListRequestController = null;
      if (requestGeneration === fileLoadGeneration) loading = false;
    }
  }

  function openFolder(file: FileItem) {
    if (!isFolder(file)) return;
    showTrash = false;
    currentFolderName = file.name;
    if (!folderPath.length) spaceRootId = file.parents?.[0] ?? null;
    folderPath = [...folderPath, file];
    currentFolderId = file.id;
    void loadFiles();
  }

  function openFolderPath(index: number) {
    const folder = folderPath[index];
    if (!folder) return;
    folderPath = folderPath.slice(0, index + 1);
    currentFolderId = folder.id;
    currentFolderName = folder.name;
    void loadFiles();
  }

  function backToRoot() {
    showTrash = false;
    showShared = false;
    currentFolderId = null;
    currentFolderName = '';
    folderPath = [];
    spaceRootId = null;
    void loadFiles();
  }

  function openTrash() {
    showTrash = true;
    showShared = false;
    currentFolderId = null;
    folderPath = [];
    spaceRootId = null;
    search = '';
    selected.clear();
    void loadFiles();
  }

  function openShared() {
    showTrash = false;
    showShared = true;
    currentFolderId = null;
    currentFolderName = '';
    folderPath = [];
    spaceRootId = null;
    search = '';
    selected.clear();
    void loadFiles();
  }

  async function createFolder() {
    if (!canCreateFolderCurrent || !newFolderName.trim() || creatingFolder) return;
    creatingFolder = true;
    newFolderError = '';
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), parentId: currentFolderId })
      });
      if (!response.ok) {
        const text = await response.text();
        try {
          newFolderError = (JSON.parse(text) as { message?: string }).message ?? text;
        } catch {
          newFolderError = text || '폴더를 만들지 못했습니다.';
        }
        return;
      }
      newFolderName = '';
      showNewFolder = false;
      const payload = (await response.json()) as { file: FileItem };
      upsertCurrentFile(payload.file);
    } finally {
      creatingFolder = false;
    }
  }

  function toggleSelect(id: string, event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const shiftKey = (event as Event & { shiftKey?: boolean }).shiftKey === true;
    if (files.find((file) => file.id === id)?.isAdminSpace) return;
    const targetIndex = selectableVisibleFiles.findIndex((file) => file.id === id);
    const anchorIndex = lastSelectedId
      ? selectableVisibleFiles.findIndex((file) => file.id === lastSelectedId)
      : -1;
    if (shiftKey && targetIndex >= 0 && anchorIndex >= 0) {
      const start = Math.min(targetIndex, anchorIndex);
      const end = Math.max(targetIndex, anchorIndex);
      for (let index = start; index <= end; index += 1) {
        selected.add(selectableVisibleFiles[index].id);
      }
    } else if (input.checked) {
      selected.add(id);
    } else {
      selected.delete(id);
    }
    lastSelectedId = id;
  }

  function toggleSelectAll(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (!input.checked) {
      for (const file of selectableVisibleFiles) selected.delete(file.id);
      lastSelectedId = null;
      return;
    }
    for (const file of selectableVisibleFiles) selected.add(file.id);
    lastSelectedId = selectableVisibleFiles.at(-1)?.id ?? null;
  }

  async function uploadFiles(incoming: FileList | File[], parentId = currentFolderId) {
    if (!canUploadCurrent) return;
    dragging = false;
    for (const file of Array.from(incoming)) {
      const existing = files.find(
        (item) => !isFolder(item) && item.name.toLocaleLowerCase() === file.name.toLocaleLowerCase()
      );
      if (existing) {
        uploadConflicts = [...uploadConflicts, { file, existing, parentId }];
        continue;
      }
      startUpload(file, undefined, undefined, parentId);
    }
    if (applyConflictAction) void resolveUploadConflict(applyConflictAction, true);
  }

  function startUpload(
    file: File,
    action?: Exclude<ConflictAction, 'skip'>,
    existing?: FileItem,
    parentId = currentFolderId
  ) {
    const item: UploadItem = {
      id: crypto.randomUUID(),
      name: file.name,
      progress: 0,
      status: 'uploading'
    };
    uploads = [...uploads, item];
    showUploadTray = true;
    uploadFilesById.set(item.id, file);
    void uploadOne(file, item.id, action, existing?.id, parentId);
  }

  async function resolveUploadConflict(action: ConflictAction, applyAll: boolean) {
    if (!uploadConflicts.length) return;
    if (applyAll) applyConflictAction = action;
    const [current, ...remaining] = uploadConflicts;
    uploadConflicts = remaining;
    if (action !== 'skip') startUpload(current.file, action, current.existing, current.parentId);
    if (applyAll && uploadConflicts.length) void resolveUploadConflict(action, true);
  }

  async function uploadOne(
    file: File,
    id: string,
    conflictAction?: Exclude<ConflictAction, 'skip'>,
    existingFileId?: string,
    parentId: string | null = currentFolderId
  ) {
    const update = (change: Partial<UploadItem>) => {
      uploads = uploads.map((item) => (item.id === id ? { ...item, ...change } : item));
    };
    const controller = new AbortController();
    let uploadedFile: FileItem | undefined;
    uploadControllers.set(id, controller);
    update({ status: 'uploading', progress: 0, error: undefined, sessionId: undefined });
    try {
      const sessionResponse = await fetch('/api/uploads/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          parentId,
          conflictAction,
          existingFileId
        })
      });
      if (!sessionResponse.ok) throw new Error(await sessionResponse.text());
      const session = (await sessionResponse.json()) as { uploadId: string; chunkSize: number };
      update({ sessionId: session.uploadId });
      let offset = 0;
      while (offset < file.size || (file.size === 0 && offset === 0)) {
        const end = file.size === 0 ? 0 : Math.min(offset + session.chunkSize, file.size);
        const chunk = file.slice(offset, end);
        let response: Response | null = null;
        let lastError = '업로드 실패';
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const headers: Record<string, string> = { 'content-length': String(chunk.size) };
          if (file.size > 0)
            headers['content-range'] = `bytes ${offset}-${Math.max(offset, end - 1)}/${file.size}`;
          response = await fetch(`/api/uploads/${session.uploadId}/chunks`, {
            method: 'PUT',
            headers,
            body: chunk,
            signal: controller.signal
          });
          if (response.ok) break;
          lastError = await response.text();
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
        if (!response?.ok) throw new Error(lastError);
        const progress = file.size ? Math.round((end / file.size) * 100) : 100;
        update({ progress });
        if (end === file.size) {
          uploadedFile = ((await response.json()) as { file?: FileItem }).file;
        }
        if (file.size === 0) break;
        offset = end;
      }
      update({ progress: 100, status: 'complete' });
      if (uploadedFile && parentId === currentFolderId) upsertCurrentFile(uploadedFile);
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') {
        update({ status: 'cancelled', error: undefined });
      } else {
        update({ status: 'error', error: cause instanceof Error ? cause.message : '업로드 실패' });
      }
    } finally {
      uploadControllers.delete(id);
    }
  }

  async function cancelUpload(item: UploadItem) {
    uploadControllers.get(item.id)?.abort();
    if (item.sessionId) await fetch(`/api/uploads/${item.sessionId}`, { method: 'DELETE' });
    uploads = uploads.map((current) =>
      current.id === item.id ? { ...current, status: 'cancelled', error: undefined } : current
    );
  }

  function retryUpload(item: UploadItem) {
    const file = uploadFilesById.get(item.id);
    if (!file) return;
    void uploadOne(file, item.id);
  }

  function download(file: FileItem) {
    const anchor = document.createElement('a');
    anchor.href = `/api/files/${file.id}/download`;
    anchor.download = file.name;
    anchor.rel = 'noreferrer';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  async function downloadSelected() {
    if (!selectedDownloadableFiles.length || busySelectionAction) return;
    busySelectionAction = 'download';
    try {
      for (const file of selectedDownloadableFiles) {
        download(file);
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
    } finally {
      busySelectionAction = null;
    }
  }

  async function trashSelected() {
    if (!selectedFiles.length || busySelectionAction) return;
    if (!confirm(`선택한 ${selectedFiles.length}개 항목을 휴지통으로 보낼까요?`)) return;
    busySelectionAction = 'trash';
    const filesToTrash = [...selectedFiles];
    try {
      const responses = await Promise.all(
        filesToTrash.map((file) => fetch(`/api/files/${file.id}`, { method: 'DELETE' }))
      );
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        message = await failed.text();
        return;
      }
      const trashedIds = filesToTrash.map((file) => file.id);
      selected.clear();
      removeCurrentFiles(trashedIds);
    } finally {
      busySelectionAction = null;
    }
  }

  function beginRename(file: FileItem) {
    editingFile = file;
    editName = file.name;
  }

  async function saveRename() {
    if (!editingFile || !editName.trim()) return;
    const response = await fetch(`/api/files/${editingFile.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() })
    });
    if (!response.ok) {
      message = await response.text();
      return;
    }
    const payload = (await response.json()) as { file: FileItem };
    editingFile = null;
    upsertCurrentFile(payload.file);
  }

  async function trash(file: FileItem) {
    if (!confirm(`“${file.name}”을 휴지통으로 보낼까요?`)) return;
    const response = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
    if (!response.ok) {
      message = await response.text();
      return;
    }
    removeCurrentFiles([file.id]);
  }

  async function restore(file: FileItem) {
    const response = await fetch(`/api/files/${file.id}/restore`, { method: 'POST' });
    if (!response.ok) {
      message = await response.text();
      return;
    }
    removeCurrentFiles([file.id]);
  }

  async function createInvite() {
    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'member' })
    });
    if (!response.ok) {
      message = await response.text();
      return;
    }
    inviteLink = ((await response.json()) as { link: string }).link;
    showInvite = true;
  }

  async function openProfile() {
    showProfile = true;
    profileLoading = true;
    profileMessage = '';
    profileHandle = user.handle ?? user.loginId ?? '';
    profileAvatarUrl = user.avatarUrl ?? null;
    loginIdRevealed = false;
    try {
      const response = await fetch('/api/me/passkeys');
      if (!response.ok) throw new Error(await response.text());
      profilePasskeys = ((await response.json()) as { passkeys: Passkey[] }).passkeys;
    } catch (cause) {
      profileMessage = cause instanceof Error ? cause.message : '내 정보를 불러오지 못했습니다.';
    } finally {
      profileLoading = false;
    }
  }

  function chooseAvatar() {
    avatarInput?.click();
  }

  async function readAvatar(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      profileMessage = 'PNG, JPG, WEBP, GIF 이미지만 업로드할 수 있습니다.';
      return;
    }
    if (file.size > 1_000_000) {
      profileMessage = '아바타 이미지는 1MB 이하로 업로드해주세요.';
      return;
    }
    profileAvatarUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
      reader.readAsDataURL(file);
    });
  }

  async function saveProfile() {
    if (profileBusy) return;
    profileBusy = true;
    profileMessage = '';
    try {
      const response = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle: profileHandle,
          avatarUrl: profileAvatarUrl,
          ...(newPassword ? { currentPassword, newPassword } : {})
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as {
        user: { handle: string; avatarUrl: string | null };
      };
      user = { ...user, ...payload.user };
      currentPassword = '';
      newPassword = '';
      profileMessage = '프로필을 저장했습니다.';
    } catch (cause) {
      profileMessage = cause instanceof Error ? cause.message : '프로필을 저장하지 못했습니다.';
    } finally {
      profileBusy = false;
    }
  }

  async function addPasskey() {
    if (profileBusy) return;
    profileBusy = true;
    profileMessage = '';
    try {
      const response = await fetch('/api/me/passkeys', { method: 'POST' });
      if (!response.ok) throw new Error(await response.text());
      const { context } = (await response.json()) as { context: string };
      const result = await authClient.passkey.addPasskey({
        name: `${user.handle ?? user.loginId ?? '사용자'}의 패스키`,
        context
      });
      if (result.error) throw new Error(result.error.message);
      await openProfile();
      profileMessage = '패스키를 등록했습니다.';
    } catch (cause) {
      profileMessage = cause instanceof Error ? cause.message : '패스키를 등록하지 못했습니다.';
    } finally {
      profileBusy = false;
    }
  }

  async function removePasskey(passkey: Passkey) {
    if (profileBusy || !confirm('이 패스키를 제거할까요?')) return;
    profileBusy = true;
    profileMessage = '';
    try {
      const response = await fetch(`/api/me/passkeys/${passkey.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.text());
      const result = (await response.json()) as {
        rpId: string;
        userId: string;
        acceptedCredentialIds: string[];
      };
      const synced = await syncDeletedPasskeyWithDevice(result);
      profilePasskeys = profilePasskeys.filter((current) => current.id !== passkey.id);
      profileMessage = synced
        ? '서버에서 패스키를 제거했고, 기기에도 삭제 신호를 보냈습니다.'
        : '서버에서 패스키를 제거했습니다. 이 브라우저는 기기 자동 삭제 신호를 지원하지 않아 기기 패스키 관리자에서 직접 삭제해주세요.';
    } catch (cause) {
      profileMessage = cause instanceof Error ? cause.message : '패스키를 제거하지 못했습니다.';
    } finally {
      profileBusy = false;
    }
  }

  async function syncDeletedPasskeyWithDevice(input: {
    rpId: string;
    userId: string;
    acceptedCredentialIds: string[];
  }): Promise<boolean> {
    const credentialApi = globalThis.PublicKeyCredential as
      | (typeof PublicKeyCredential & {
          signalAllAcceptedCredentials?: (options: {
            rpId: string;
            userId: string;
            allAcceptedCredentialIds: string[];
          }) => Promise<void>;
        })
      | undefined;
    if (!credentialApi?.signalAllAcceptedCredentials) return false;
    const userId = btoa(String.fromCharCode(...new TextEncoder().encode(input.userId)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '');
    try {
      await credentialApi.signalAllAcceptedCredentials({
        rpId: input.rpId,
        userId,
        allAcceptedCredentialIds: input.acceptedCredentialIds
      });
      return true;
    } catch {
      // Device support is optional; server-side revocation already succeeded.
      return false;
    }
  }

  async function openShareSettings(file: FileItem) {
    const response = await fetch(`/api/folders/${file.id}/shares`);
    if (!response.ok) {
      message = await response.text();
      return;
    }
    const payload = (await response.json()) as {
      users: ShareUser[];
      shares: { userId: string; permission: 'viewer' | 'editor'; status?: string }[];
    };
    sharingFolder = file;
    shareUsers = payload.users;
    sharedUserIds.clear();
    sharePermissions.clear();
    for (const share of payload.shares) {
      sharedUserIds.add(share.userId);
      sharePermissions.set(share.userId, share.permission);
    }
    shareQuery = '';
    await searchShareUsers();
  }

  function toggleSharedUser(userId: string) {
    if (sharedUserIds.has(userId)) sharedUserIds.delete(userId);
    else {
      sharedUserIds.add(userId);
      sharePermissions.set(userId, 'viewer');
    }
  }

  async function searchShareUsers() {
    const response = await fetch(`/api/share-users?q=${encodeURIComponent(shareQuery)}`);
    if (response.ok) shareUsers = ((await response.json()) as { users: ShareUser[] }).users;
  }

  function setSharePermission(userId: string, permission: 'viewer' | 'editor') {
    sharePermissions.set(userId, permission);
  }

  async function saveShareSettings() {
    if (!sharingFolder) return;
    savingShares = true;
    const response = await fetch(`/api/folders/${sharingFolder.id}/shares`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        users: [...sharedUserIds].map((userId) => ({
          userId,
          permission: sharePermissions.get(userId) ?? 'viewer'
        }))
      })
    });
    savingShares = false;
    if (!response.ok) {
      message = await response.text();
      return;
    }
    sharingFolder = null;
    message = '공유 설정을 저장했습니다.';
  }

  async function loadShareInvitations() {
    if (isAdmin) return;
    const response = await fetch('/api/share-invitations');
    if (response.ok)
      pendingShareInvitations = ((await response.json()) as { invitations: ShareInvitation[] })
        .invitations;
  }

  async function respondToShareInvitation(invitation: ShareInvitation, accept: boolean) {
    respondingInvitation = invitation.id;
    const response = await fetch('/api/share-invitations', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invitationId: invitation.id, accept })
    });
    respondingInvitation = null;
    if (!response.ok) {
      message = await response.text();
      return;
    }
    pendingShareInvitations = pendingShareInvitations.filter((item) => item.id !== invitation.id);
    message = accept ? '공유 폴더에 참여했습니다.' : '공유 폴더 신청을 거절했습니다.';
    if (accept) void loadFiles({ force: true });
  }

  async function loadUsers() {
    const [usersResponse, requestsResponse] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/password-reset-requests')
    ]);
    if (usersResponse.ok) users = ((await usersResponse.json()) as { users: User[] }).users;
    else message = await usersResponse.text();
    if (requestsResponse.ok)
      resetRequests = ((await requestsResponse.json()) as { requests: ResetRequest[] }).requests;
    else message = await requestsResponse.text();
    showUsers = true;
  }

  async function createDirectResetLink(member: User) {
    if (updatingMemberId) return;
    updatingMemberId = member.id;
    const response = await fetch(`/api/users/${member.id}/password-reset-link`, {
      method: 'POST'
    });
    updatingMemberId = null;
    if (!response.ok) {
      message = await response.text();
      return;
    }
    const result = (await response.json()) as { link: string; expiresAt: string };
    generatedResetLinks = { ...generatedResetLinks, [member.id]: result };
  }

  async function setMemberStatus(member: User, status: 'active' | 'disabled') {
    if (updatingMemberId) return;
    updatingMemberId = member.id;
    const response = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: member.id, status })
    });
    updatingMemberId = null;
    if (!response.ok) {
      message = await response.text();
      return;
    }
    users = users.map((current) => (current.id === member.id ? { ...current, status } : current));
  }

  async function createResetLink(request: ResetRequest) {
    const response = await fetch(`/api/password-reset-requests/${request.id}/link`, {
      method: 'POST'
    });
    if (!response.ok) {
      message = await response.text();
      return;
    }
    const result = (await response.json()) as { link: string; expiresAt: string };
    resetRequests = resetRequests.map((current) =>
      current.id === request.id
        ? { ...current, status: 'link_created', link: result.link, expires_at: result.expiresAt }
        : current
    );
  }

  async function connectGoogle() {
    window.location.href = '/api/auth/google/start';
  }

  async function logout() {
    if (loggingOut) return;
    loggingOut = true;
    message = '';
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'cache-control': 'no-store' },
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error((await response.text()) || '로그아웃에 실패했습니다.');
      window.location.replace('/?signed-out=1');
    } catch (cause) {
      message = cause instanceof Error ? cause.message : '로그아웃에 실패했습니다.';
      loggingOut = false;
    }
  }
</script>

<svelte:window
  onclick={closeContextMenu}
  onkeydown={(event) => event.key === 'Escape' && closeContextMenu()}
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
/>

<div class="app-shell" class:uploading={dragging} class:moving-file={draggingFiles.length > 0}>
  {#if dragging && canUploadCurrent}
    <div class="drop-overlay" role="status" aria-live="polite">
      <div class="drop-orbit drop-orbit-one"></div>
      <div class="drop-orbit drop-orbit-two"></div>
      <div class="drop-overlay-card">
        <span class="drop-overlay-icon">{dropTargetFolder ? '↳' : '↓'}</span>
        <div>
          <strong
            >{dropTargetFolder
              ? `${dropTargetFolder.name}에 업로드`
              : currentFolderId
                ? `${folderTitle}에 업로드`
                : '이 공간에 업로드'}</strong
          >
          <span
            >{dropTargetFolder
              ? '이 폴더로 파일을 이동합니다'
              : '파일을 놓으면 바로 업로드합니다'}</span
          >
        </div>
      </div>
    </div>
  {/if}
  <aside class="sidebar">
    <div class="side-brand"><span class="brand-dot"></span><strong>gdrive share</strong></div>
    <div class="space-label">
      <span class="eyebrow">{isAdmin ? 'admin console' : 'private workspace'}</span><span
        class="connection-state"
        ><i class="connection-dot" class:offline={!googleConnected}></i>{googleConnected
          ? '온라인'
          : '연결 필요'}</span
      >
    </div>
    <button class:active={!showTrash && !showShared} class="nav-item" onclick={backToRoot}
      ><span class="nav-glyph">▦</span>{isAdmin ? '사용자 파일' : '내 공간'}<span class="nav-count"
        >{files.length || ''}</span
      ></button
    >
    {#if !isAdmin}<button class:active={showShared} class="nav-item" onclick={openShared}
        ><span class="nav-glyph">◇</span>공유 폴더{#if pendingShareInvitations.length}<span
            class="nav-count">{pendingShareInvitations.length}</span
          >{/if}</button
      >{/if}
    <button class:active={showTrash} class="nav-item" onclick={openTrash}
      ><span class="nav-glyph">⌁</span>휴지통</button
    >
    <div class="sidebar-rule"></div>
    <div class="sidebar-footer">
      {#if user.role === 'admin'}
        <button class="nav-item" onclick={createInvite}
          ><span class="nav-glyph">＋</span>사람 초대</button
        >
        <button class="nav-item" onclick={loadUsers}
          ><span class="nav-glyph">◌</span>멤버 관리<span class="nav-count"
            >{pendingResetCount || ''}</span
          ></button
        >
        {#if !googleConnected}
          <button class="connect-button" onclick={connectGoogle}>Google Drive 연결</button>
        {/if}
      {/if}
      <button class="profile" aria-label="내 정보 열기" onclick={() => void openProfile()}>
        {#if user.avatarUrl}<img
            class="avatar avatar-image"
            src={user.avatarUrl}
            alt=""
          />{:else}<span class="avatar"
            >{(user.handle ?? user.loginId ?? '?').slice(0, 1).toUpperCase()}</span
          >{/if}
        <span
          ><strong>@{user.handle ?? '관리자'}</strong><small
            >{user.role === 'admin' ? '관리자' : '멤버'}</small
          ></span
        >
      </button>
      <button class="logout-button" disabled={loggingOut} onclick={logout}
        ><span>↪</span>{loggingOut ? '로그아웃 중…' : '로그아웃'}</button
      >
    </div>
  </aside>

  <main class="workspace">
    <header class="topbar">
      <div class="workspace-title">
        <p class="eyebrow">GShare</p>
        <h1>{folderTitle}</h1>
        <p class="workspace-subtitle">
          {showTrash
            ? '삭제한 항목은 여기에서 복구할 수 있습니다.'
            : isAdmin
              ? '사용자별 공간을 열어 파일을 확인하고 정리할 수 있습니다.'
              : showShared
                ? '내게 공유된 폴더와 파일입니다.'
                : '내 파일은 이 공간에만 안전하게 정리됩니다.'}
        </p>
      </div>
      <div class="top-actions">
        {#if storageQuota}<div class="storage-meter" title="Google Drive 저장 공간">
            <div class="storage-meter-label">
              <span>남은 공간</span><strong
                >{formatBytes(Math.max(0, (storageQuota.limit ?? 0) - storageQuota.usage))} / {formatBytes(
                  storageQuota.limit ?? 0
                )}</strong
              >
            </div>
            <div
              class="storage-meter-track"
              aria-label="저장 공간 사용량"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={storagePercent(storageQuota)}
            >
              <span style={`width: ${storagePercent(storageQuota)}%`}></span>
            </div>
          </div>{/if}
        <Badge tone={googleConnected ? 'success' : 'warning'}>
          {googleConnected ? 'Drive 연결됨' : 'Drive 연결 필요'}
        </Badge><button
          class="icon-button"
          aria-label="새로고침"
          title="Drive에서 최신 목록 다시 불러오기"
          onclick={() => void loadFiles({ force: true })}>↻</button
        >
      </div>
    </header>

    {#if !googleConnected}
      <section class="setup-banner">
        <div>
          <strong>Google Drive를 연결하면 이 공간이 열립니다.</strong>
          <p>관리자 계정에서 OAuth 연결을 한 번만 완료해주세요.</p>
        </div>
        {#if user.role === 'admin'}<button class="secondary-button" onclick={connectGoogle}
            >연결하기</button
          >{/if}
      </section>
    {/if}

    {#if canUploadCurrent}<section class="privacy-banner" role="note">
        <span class="privacy-notice-icon" aria-hidden="true">!</span>
        <span>업로드한 파일은 관리자가 확인할 수 있습니다.</span>
      </section>{/if}

    <div class="toolbar">
      <div class="breadcrumbs">
        <button
          class:current={!currentFolderId}
          class:parent-drop-zone={draggingFiles.length > 0 && spaceRootId !== null}
          class:move-drop-target={moveDropTarget === spaceRootId && spaceRootId !== null}
          ondragover={(event) => spaceRootId && handleMoveDragOver(event, spaceRootId)}
          ondragleave={(event) => spaceRootId && handleMoveDragLeave(event, spaceRootId)}
          ondrop={(event) => spaceRootId && void handleMoveDrop(event, spaceRootId)}
          onclick={() => (showShared ? openShared() : backToRoot())}
          >{isAdmin ? '사용자 파일' : showShared ? '공유 폴더' : '내 공간'}</button
        >{#each folderPath as folder, index (folder.id)}<span>/</span><button
            class="parent-drop-zone"
            class:current={index === folderPath.length - 1}
            class:move-drop-target={moveDropTarget === folder.id}
            ondragover={(event) => handleMoveDragOver(event, folder.id)}
            ondragleave={(event) => handleMoveDragLeave(event, folder.id)}
            ondrop={(event) => void handleMoveDrop(event, folder.id)}
            onclick={() => openFolderPath(index)}
            title={`${folder.name} 폴더로 이동`}>{folder.name}</button
          >{/each}
      </div>
      {#if draggingFiles.length}<p class="move-hint" role="status">
          {draggingFiles.length === 1
            ? `“${draggingFiles[0].name}”을 옮길 폴더에 놓으세요.`
            : `${draggingFiles.length}개 선택 항목을 옮길 폴더에 놓으세요.`}
        </p>{/if}
      <div class="toolbar-actions">
        {#if canUploadCurrent}<label class="upload-button"
            >파일 추가<input
              type="file"
              multiple
              onchange={(event) => {
                const input = event.currentTarget as HTMLInputElement;
                if (input.files) void uploadFiles(input.files);
                input.value = '';
              }}
            /></label
          >{/if}
        {#if selectedFiles.length && !showTrash}
          {#if selectedDownloadableFiles.length}<button
              class="secondary-button"
              disabled={busySelectionAction !== null}
              onclick={() => void downloadSelected()}
              >{busySelectionAction === 'download'
                ? '다운로드 중…'
                : `선택 다운로드 (${selectedDownloadableFiles.length})`}</button
            >{/if}<button
            class="danger-button bulk-action"
            disabled={busySelectionAction !== null}
            onclick={() => void trashSelected()}
            >{busySelectionAction === 'trash'
              ? '이동 중…'
              : `선택 삭제 (${selectedFiles.length})`}</button
          >
        {/if}
        <label class="search"
          ><span>⌕</span><input
            bind:value={search}
            oninput={scheduleSearchLoad}
            placeholder="이 공간에서 검색"
          /></label
        ><select class="sort-select" bind:value={sortBy} aria-label="정렬 기준">
          <option value="name">이름순</option>
          <option value="modifiedTime">최근 수정순</option>
          <option value="size">크기순</option>
        </select><button
          class="icon-button sort-direction"
          aria-label="정렬 방향"
          onclick={() => (sortDescending = !sortDescending)}>{sortDescending ? '↓' : '↑'}</button
        >{#if canCreateFolderCurrent}<button
            class="secondary-button"
            onclick={() => {
              newFolderError = '';
              showNewFolder = true;
            }}>새 폴더</button
          >{/if}
      </div>
    </div>

    {#if message}<p class="error inline-message" role="alert">{message}</p>{/if}
    {#if showTrash}
      <p class="trash-notice" role="note">
        휴지통의 파일은 삭제한 시점부터 7일 후 자동으로 영구 삭제됩니다.
      </p>
    {/if}
    {#if !isAdmin && pendingShareInvitations.length}
      <section class="share-invitation-banner" aria-label="공유 폴더 신청">
        <div>
          <strong>공유 폴더 신청이 도착했습니다.</strong><small
            >수락하면 폴더를 함께 사용할 수 있습니다.</small
          >
        </div>
        <div class="invitation-actions">
          {#each pendingShareInvitations as invitation (invitation.id)}
            <div class="invitation-row">
              <span
                ><b>{invitation.folderName}</b> · {invitation.ownerName} · {invitation.permission ===
                'editor'
                  ? '편집 가능'
                  : '읽기 전용'}</span
              ><button
                class="primary-button"
                disabled={respondingInvitation === invitation.id}
                onclick={() => void respondToShareInvitation(invitation, true)}>수락</button
              ><button
                class="secondary-button"
                disabled={respondingInvitation === invitation.id}
                onclick={() => void respondToShareInvitation(invitation, false)}>거절</button
              >
            </div>
          {/each}
        </div>
      </section>
    {/if}
    <section class="file-table" aria-live="polite">
      <div class="table-head">
        <label class="table-name-heading"
          ><input
            type="checkbox"
            bind:this={selectAllCheckbox}
            checked={allVisibleSelected}
            disabled={!selectableVisibleFiles.length}
            onchange={toggleSelectAll}
            aria-label="현재 목록 전체 선택"
            title="현재 목록 전체 선택"
          /><span>이름</span></label
        ><span>크기</span><span>수정</span><span>작업</span>
      </div>
      {#if loading && !visibleFiles.length}
        <div class="empty-row"><span class="spinner"></span>파일을 읽는 중…</div>
      {:else if !visibleFiles.length}
        <div class="empty-row">
          <span class="empty-mark">⌁</span><strong
            >{showTrash
              ? '휴지통이 비어 있습니다.'
              : isAdmin && !currentFolderId
                ? '아직 파일 공간을 만든 사용자가 없습니다.'
                : showShared && !currentFolderId
                  ? '공유받은 폴더가 없습니다.'
                  : googleConnected
                    ? '아직 파일이 없습니다.'
                    : 'Drive 연결을 기다리는 중입니다.'}</strong
          ><small
            >{showTrash
              ? '삭제한 항목은 여기에서 복구할 수 있어요.'
              : isAdmin && !currentFolderId
                ? '사용자가 처음 파일을 올리면 개인 공간이 여기에 나타납니다.'
                : showShared && !currentFolderId
                  ? '다른 사용자가 폴더를 공유하면 여기에 표시됩니다.'
                  : '첫 파일을 이곳에 놓아보세요.'}</small
          >
        </div>
      {:else}
        {#if loading}<div class="list-refreshing" role="status">
            <span class="spinner"></span>최신 정보 확인 중…
          </div>{/if}
        {#each visibleFiles as file (file.id)}
          <div
            class="file-row"
            data-file-id={file.id}
            class:selected={selected.has(file.id)}
            class:dragging-source={draggingFiles.some((item) => item.id === file.id)}
            class:folder-drop-target={dropTargetFolder?.id === file.id}
            class:move-drop-target={moveDropTarget === file.id}
            role="group"
            oncontextmenu={(event) => openContextMenu(event, file)}
            ondragend={clearFileDrag}
            ondragenter={(event) => {
              handleFolderDragEnter(event, file);
              if (isFolder(file)) handleMoveDragOver(event, file.id);
            }}
            ondragover={(event) => {
              handleFolderDragOver(event, file);
              if (isFolder(file)) handleMoveDragOver(event, file.id);
            }}
            ondragleave={(event) => {
              handleFolderDragLeave(event, file);
              if (isInternalFileDrag(event) && isFolder(file)) handleMoveDragLeave(event, file.id);
            }}
            ondrop={(event) => {
              if (isFolder(file)) void handleMoveDrop(event, file.id);
            }}
          >
            <div class="file-name">
              <span
                class="drag-handle"
                draggable={!file.isAdminSpace && !showTrash && googleConnected}
                ondragstart={(event) => startFileDrag(event, file)}
                ondragend={clearFileDrag}
                aria-hidden="true"
                title="이동할 파일 끌기">⠿</span
              >
              <input
                type="checkbox"
                checked={selected.has(file.id)}
                disabled={file.isAdminSpace}
                onchange={(event) => toggleSelect(file.id, event)}
                aria-label={file.isAdminSpace ? `${file.name} 개인 공간` : `${file.name} 선택`}
              /><button
                class="file-main"
                onclick={() => (isFolder(file) ? openFolder(file) : openPreview(file))}
                onkeydown={(event) => openKeyboardContextMenu(event, file)}
                ><span
                  class="file-icon"
                  class:folder={isFolder(file)}
                  class:image={isImage(file)}
                  class:video={isVideo(file)}
                  class:audio={isAudio(file)}
                  >{#if isFolder(file)}<span class="folder-glyph" aria-hidden="true"
                    ></span>{:else if isImage(file)}<img
                      src={`/api/files/${file.id}/thumbnail`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />{:else if isVideo(file)}<img
                      src={`/api/files/${file.id}/thumbnail`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    /><i>▶</i>{:else if isAudio(file)}<i class="audio-file-mark">♪</i
                    >{:else}□{/if}</span
                ><span
                  ><strong title={file.name}>{file.name}</strong
                  >{#if file.isAdminSpace || file.ownerName || !isFolder(file)}<small
                      >{file.isAdminSpace
                        ? '사용자 개인 공간'
                        : file.ownerName
                          ? `${file.ownerName}의 공유 폴더`
                          : file.uploadedBy
                            ? `${file.uploadedBy} · ${file.uploadedAt ? new Date(file.uploadedAt).toLocaleString('ko-KR') : '업로드'}`
                            : file.mimeType.split('/').pop()}</small
                    >{/if}</span
                ></button
              >
            </div>
            <span class="file-meta">{isFolder(file) ? '폴더' : formatBytes(file.size)}</span>
            <span class="file-meta"
              >{file.modifiedTime
                ? new Date(file.modifiedTime).toLocaleDateString('ko-KR')
                : '—'}</span
            >
            <div class="row-actions">
              {#if showTrash}<button onclick={() => restore(file)}>복구</button
                >{:else if !file.isAdminSpace}{#if !isFolder(file) && isPreviewable(file)}<button
                    onclick={() => openPreview(file)}>미리보기</button
                  >{/if}{#if file.canShare}<button onclick={() => void openShareSettings(file)}
                    >공유</button
                  >{/if}{#if file.permission !== 'viewer'}<button onclick={() => beginRename(file)}
                    >이름 변경</button
                  >{#if !isFolder(file)}<button onclick={() => download(file)}>다운로드</button
                    >{/if}<button class="danger-button" onclick={() => trash(file)}>삭제</button
                  >{:else if !isFolder(file)}<button onclick={() => download(file)}>다운로드</button
                  >{/if}{/if}
              {#if !file.isAdminSpace}
                <button
                  class="menu-trigger"
                  aria-label={`${file.name} 작업 메뉴`}
                  onclick={(event) => openContextMenuFromButton(event, file)}>•••</button
                >
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </section>
  </main>
</div>

{#if contextMenu}
  <div
    class="context-menu"
    role="menu"
    tabindex="-1"
    aria-label={`${contextMenu.file.name} 메뉴`}
    style={`left: ${contextMenu.x}px; top: ${contextMenu.y}px`}
  >
    <p class="context-menu-name">{contextMenu.file.name}</p>
    {#if showTrash}
      <button
        role="menuitem"
        onclick={() => {
          const file = contextMenu?.file;
          closeContextMenu();
          if (file) void restore(file);
        }}>↺ 복구</button
      >
    {:else if contextMenu.file.isAdminSpace}
      <button
        role="menuitem"
        onclick={() => {
          const file = contextMenu?.file;
          closeContextMenu();
          if (file) openFolder(file);
        }}>↗ 공간 열기</button
      >
    {:else}
      {#if isFolder(contextMenu.file)}
        <button
          role="menuitem"
          onclick={() => {
            const file = contextMenu?.file;
            closeContextMenu();
            if (file) openFolder(file);
          }}>↗ 폴더 열기</button
        >
      {:else if isPreviewable(contextMenu.file)}
        <button
          role="menuitem"
          onclick={() => {
            const file = contextMenu?.file;
            closeContextMenu();
            if (file) openPreview(file);
          }}>◉ 미리보기</button
        >
      {/if}
      {#if contextMenu.file.canShare}
        <button
          role="menuitem"
          onclick={() => {
            const file = contextMenu?.file;
            closeContextMenu();
            if (file) void openShareSettings(file);
          }}>◇ 공유 설정</button
        >
      {/if}
      <button
        role="menuitem"
        onclick={() => {
          const file = contextMenu?.file;
          closeContextMenu();
          if (file) beginRename(file);
        }}>✎ 이름 변경</button
      >
      {#if !isFolder(contextMenu.file)}
        <button
          role="menuitem"
          onclick={() => {
            const file = contextMenu?.file;
            closeContextMenu();
            if (file) void download(file);
          }}>↓ 다운로드</button
        >
      {/if}
      <div class="context-rule"></div>
      <button
        class="context-danger"
        role="menuitem"
        onclick={() => {
          const file = contextMenu?.file;
          closeContextMenu();
          if (file) void trash(file);
        }}>⌁ 휴지통으로 이동</button
      >
    {/if}
  </div>
{/if}

{#if previewFile}
  <div
    class="modal-backdrop preview-backdrop"
    role="presentation"
    onclick={(event) => event.currentTarget === event.target && (previewFile = null)}
  >
    <div class="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <header class="preview-header">
        <div>
          <p class="eyebrow">preview</p>
          <h2 id="preview-title">{previewFile.name}</h2>
          {#if isAudio(previewFile)}<p class="preview-kind">오디오 미리보기</p>{/if}
        </div>
        <div class="preview-actions">
          <button class="secondary-button" onclick={() => void download(previewFile!)}
            >다운로드</button
          >
          <button class="modal-close" aria-label="닫기" onclick={() => (previewFile = null)}
            >×</button
          >
        </div>
      </header>
      <div class="preview-stage">
        {#if isVideo(previewFile)}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video src={`/api/files/${previewFile.id}/preview`} controls autoplay playsinline>
            이 브라우저에서는 동영상을 재생할 수 없습니다.
          </video>
        {:else if isAudio(previewFile)}
          <div class="audio-preview-card">
            <span class="audio-preview-mark">♪</span>
            <div>
              <strong>{previewFile.name}</strong><small
                >{previewFile.mimeType.split('/').pop()?.toUpperCase()} 오디오</small
              >
            </div>
            <audio src={`/api/files/${previewFile.id}/preview`} controls autoplay>
              이 브라우저에서는 오디오를 재생할 수 없습니다.
            </audio>
          </div>
        {:else if isImage(previewFile)}
          <img src={`/api/files/${previewFile.id}/preview`} alt={previewFile.name} />
        {:else}
          <iframe title={previewFile.name} src={`/api/files/${previewFile.id}/preview`}></iframe>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if uploads.length && showUploadTray}
  <section class="upload-tray" aria-label="업로드 현황">
    <div class="tray-title">
      <strong>업로드 현황</strong><button onclick={() => (showUploadTray = false)}>닫기</button>
    </div>
    {#each uploads as upload (upload.id)}<div class="upload-line">
        <div>
          <strong>{upload.name}</strong><span class:error={upload.status === 'error'}
            >{upload.status === 'complete'
              ? '완료'
              : upload.status === 'error'
                ? upload.error
                : upload.status === 'cancelled'
                  ? '취소됨'
                  : `${upload.progress}%`}</span
          >
          {#if upload.status === 'uploading'}<button onclick={() => void cancelUpload(upload)}
              >취소</button
            >{:else if upload.status === 'error' || upload.status === 'cancelled'}<button
              onclick={() => retryUpload(upload)}>재시도</button
            >{/if}
        </div>
        <div class="progress"><i style={`width: ${upload.progress}%`}></i></div>
      </div>{/each}
  </section>
{/if}

{#if activeUploads.length && !showUploadTray}
  <button
    class="upload-status-chip"
    onclick={() => (showUploadTray = true)}
    aria-label="업로드 현황 열기"
  >
    <span class="spinner"></span><span
      >업로드 {activeUploads.length}개 진행 중 · {activeUploadProgress}%</span
    >
  </button>
{/if}

{#if showInvite}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => event.currentTarget === event.target && (showInvite = false)}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="invite-title">
      <button class="modal-close" aria-label="닫기" onclick={() => (showInvite = false)}>×</button>
      <p class="eyebrow">invite / 24h</p>
      <h2 id="invite-title">같이 쓸 사람을 초대하세요.</h2>
      <p class="muted">이 링크는 한 번만 사용할 수 있고 24시간 뒤 만료됩니다.</p>
      <div class="invite-link mono">{inviteLink}</div>
      <button class="primary-button" onclick={() => navigator.clipboard?.writeText(inviteLink)}
        >링크 복사</button
      >
    </div>
  </div>
{/if}

{#if uploadConflicts.length}
  <div class="modal-backdrop" role="presentation">
    <div
      class="modal conflict-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-conflict-title"
      aria-describedby="upload-conflict-description"
    >
      <p class="eyebrow">file already exists</p>
      <h2 id="upload-conflict-title">같은 이름의 파일</h2>
      <p id="upload-conflict-description" class="modal-description">
        이 폴더에 같은 이름의 파일이 있습니다. 어떻게 처리할지 선택하세요.
      </p>
      <div class="conflict-file" aria-label="충돌한 파일">
        <span>업로드하려는 파일</span>
        <strong title={uploadConflicts[0].file.name}>{uploadConflicts[0].file.name}</strong>
      </div>
      <div class="conflict-actions" aria-label="이 파일 처리 방법">
        <button class="conflict-choice" onclick={() => void resolveUploadConflict('skip', false)}>
          <span>
            <strong>건너뛰기</strong>
            <small>이 파일은 업로드하지 않습니다</small>
          </span>
        </button>
        <button
          class="conflict-choice"
          onclick={() => void resolveUploadConflict('replace', false)}
        >
          <span>
            <strong>새 파일로 교체</strong>
            <small>기존 파일을 휴지통으로 옮기고 새 파일을 올립니다</small>
          </span>
        </button>
        <button
          class="conflict-choice conflict-choice-primary"
          onclick={() => void resolveUploadConflict('overwrite', false)}
        >
          <span>
            <strong>덮어쓰기</strong>
            <small>기존 파일을 유지한 채 내용만 바꿉니다</small>
          </span>
        </button>
      </div>
      {#if uploadConflicts.length > 1}
        <div class="conflict-apply-all">
          <div>
            <strong>나머지 {uploadConflicts.length - 1}개에도 적용</strong>
            <small>같은 방법으로 남은 충돌을 한 번에 처리합니다.</small>
          </div>
          <div class="conflict-batch-actions">
            <button
              class="secondary-button"
              onclick={() => void resolveUploadConflict('skip', true)}>모두 건너뛰기</button
            >
            <button
              class="secondary-button"
              onclick={() => void resolveUploadConflict('replace', true)}>모두 교체</button
            >
            <button
              class="primary-button"
              onclick={() => void resolveUploadConflict('overwrite', true)}>모두 덮어쓰기</button
            >
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if showNewFolder}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => event.currentTarget === event.target && (showNewFolder = false)}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="folder-title">
      <button class="modal-close" aria-label="닫기" onclick={() => (showNewFolder = false)}
        >×</button
      >
      <p class="eyebrow">new folder</p>
      <h2 id="folder-title">새 폴더</h2>
      <p class="modal-description">이 공간 안에 새 폴더를 만들어요.</p>
      <label class="form-field">
        <span>폴더 이름</span>
        <input
          bind:value={newFolderName}
          placeholder="예: 프로젝트 자료"
          onkeydown={(event) => event.key === 'Enter' && void createFolder()}
        />
      </label>
      {#if newFolderError}<p class="modal-error" role="alert">{newFolderError}</p>{/if}
      <div class="modal-actions">
        <button
          class="secondary-button"
          disabled={creatingFolder}
          onclick={() => (showNewFolder = false)}>취소</button
        >
        <button
          class="primary-button"
          disabled={!newFolderName.trim() || creatingFolder}
          onclick={createFolder}>{creatingFolder ? '만드는 중…' : '폴더 만들기'}</button
        >
      </div>
    </div>
  </div>
{/if}

{#if showProfile}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => event.currentTarget === event.target && (showProfile = false)}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <button class="modal-close" aria-label="닫기" onclick={() => (showProfile = false)}>×</button>
      <p class="eyebrow">my profile</p>
      <h2 id="profile-title">내 정보</h2>
      <div class="profile-summary">
        <button
          class="avatar-picker"
          type="button"
          aria-label="아바타 이미지 변경"
          onclick={chooseAvatar}
        >
          {#if profileAvatarUrl}<img
              class="avatar avatar-image"
              src={profileAvatarUrl}
              alt="현재 아바타"
            />{:else}<span class="avatar">{profileHandle.slice(0, 1).toUpperCase() || '?'}</span
            >{/if}
          <span class="avatar-edit">변경</span>
        </button>
        <span
          ><strong>@{profileHandle || '핸들 미설정'}</strong><small
            >{user.role === 'admin' ? '관리자' : '멤버'}</small
          ></span
        >
      </div>
      <input
        bind:this={avatarInput}
        class="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onchange={(event) => void readAvatar(event)}
      />
      <div class="profile-fields">
        <label class="form-field"
          ><span>핸들네임</span><input
            bind:value={profileHandle}
            maxlength="32"
            autocomplete="username"
            placeholder="영문, 숫자, ., _, -"
          /><small>@로 표시되는 공개 이름입니다.</small></label
        >
      </div>
      <div class="login-id-row">
        <span
          ><strong>로그인 아이디</strong><small>로그인할 때 사용하는 고정 아이디입니다.</small
          ></span
        >
        <button
          class="login-id-value"
          type="button"
          onclick={() => (loginIdRevealed = !loginIdRevealed)}
          aria-label="로그인 아이디 표시 전환"
        >
          {loginIdRevealed ? (user.loginId ?? '없음') : '••••••••'}
        </button>
      </div>
      <div class="password-heading">
        <strong>비밀번호 변경</strong><small
          >새 비밀번호를 입력하면 현재 비밀번호 확인 후 변경합니다.</small
        >
      </div>
      <div class="profile-fields password-fields">
        <label class="form-field"
          ><span>현재 비밀번호</span><input
            bind:value={currentPassword}
            type="password"
            autocomplete="current-password"
          /></label
        >
        <label class="form-field"
          ><span>새 비밀번호</span><input
            bind:value={newPassword}
            type="password"
            minlength="8"
            autocomplete="new-password"
            placeholder="8자 이상"
          /></label
        >
      </div>
      <div class="modal-actions profile-actions">
        <span></span><button
          class="primary-button"
          disabled={profileBusy}
          onclick={() => void saveProfile()}>{profileBusy ? '저장 중…' : '변경사항 저장'}</button
        >
      </div>
      <div class="passkey-heading">
        <div>
          <strong>패스키</strong><small>이 기기의 생체 인증 또는 PIN으로 로그인합니다.</small>
        </div>
        <button class="primary-button" disabled={profileBusy} onclick={() => void addPasskey()}
          >{profileBusy ? '처리 중…' : '패스키 등록'}</button
        >
      </div>
      {#if profileLoading}
        <p class="empty-modal">패스키를 불러오는 중…</p>
      {:else if !profilePasskeys.length}
        <p class="empty-modal">
          등록된 패스키가 없습니다. 비밀번호 로그인은 계속 사용할 수 있습니다.
        </p>
      {:else}
        <div class="passkey-list">
          {#each profilePasskeys as passkey (passkey.id)}
            <div class="passkey-row">
              <div>
                <strong>{passkey.name || '이름 없는 패스키'}</strong><small
                  >{new Date(passkey.createdAt).toLocaleString('ko-KR')} 등록</small
                >
              </div>
              <button
                class="secondary-button"
                disabled={profileBusy}
                onclick={() => void removePasskey(passkey)}>제거</button
              >
            </div>
          {/each}
        </div>
      {/if}
      {#if profileMessage}<p class="form-hint">{profileMessage}</p>{/if}
    </div>
  </div>
{/if}

{#if editingFile}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => event.currentTarget === event.target && (editingFile = null)}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rename-title">
      <button class="modal-close" aria-label="닫기" onclick={() => (editingFile = null)}>×</button>
      <p class="eyebrow">rename</p>
      <h2 id="rename-title">이름 변경</h2>
      <p class="modal-description">파일을 찾기 쉬운 이름으로 바꿔보세요.</p>
      <label class="form-field">
        <span>새 이름</span>
        <input
          bind:value={editName}
          aria-label="새 이름"
          onkeydown={(event) => event.key === 'Enter' && void saveRename()}
        />
      </label>
      <div class="modal-actions">
        <button class="secondary-button" onclick={() => (editingFile = null)}>취소</button>
        <button class="primary-button" disabled={!editName.trim()} onclick={saveRename}>저장</button
        >
      </div>
    </div>
  </div>
{/if}

{#if sharingFolder}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => event.currentTarget === event.target && (sharingFolder = null)}
  >
    <div class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <button class="modal-close" aria-label="닫기" onclick={() => (sharingFolder = null)}>×</button
      >
      <p class="eyebrow">folder access</p>
      <h2 id="share-title">“{sharingFolder.name}” 공유</h2>
      <p class="muted">
        사용자를 검색해 신청을 보내세요. 상대가 수락하기 전까지는 폴더가 공개되지 않습니다.
      </p>
      <label class="form-field share-search"
        ><span>사용자 검색 · @핸들네임</span><input
          bind:value={shareQuery}
          oninput={() => void searchShareUsers()}
          placeholder="@handle 또는 이름"
        /></label
      >
      <div class="share-list">
        {#if !shareUsers.length}<p class="empty-modal">공유할 활성 사용자가 없습니다.</p>{/if}
        {#each shareUsers as person (person.id)}
          <label class="share-person">
            <span class="avatar small-avatar">{person.displayName.slice(0, 1)}</span>
            <span
              ><strong>{person.displayName}</strong><small
                >@{person.handle ?? person.loginId ?? 'member'}</small
              ></span
            >
            <input
              type="checkbox"
              checked={sharedUserIds.has(person.id)}
              onchange={() => toggleSharedUser(person.id)}
            />
            {#if sharedUserIds.has(person.id)}<select
                aria-label={`${person.displayName} 권한`}
                value={sharePermissions.get(person.id) ?? 'viewer'}
                onchange={(event) =>
                  setSharePermission(
                    person.id,
                    (event.currentTarget as HTMLSelectElement).value as 'viewer' | 'editor'
                  )}
                ><option value="viewer">읽기 전용</option><option value="editor">편집 가능</option
                ></select
              >{/if}
          </label>
        {/each}
      </div>
      <div class="modal-actions share-actions">
        <span>{sharedUserIds.size}명 선택됨</span>
        <button class="primary-button" disabled={savingShares} onclick={saveShareSettings}
          >{savingShares ? '저장 중…' : '공유 설정 저장'}</button
        >
      </div>
    </div>
  </div>
{/if}

{#if showUsers}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => event.currentTarget === event.target && (showUsers = false)}
  >
    <div class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="users-title">
      <button class="modal-close" aria-label="닫기" onclick={() => (showUsers = false)}>×</button>
      <p class="eyebrow">member controls</p>
      <h2 id="users-title">멤버 관리</h2>
      <p class="muted">
        계정 상태와 비밀번호 변경 링크를 한곳에서 관리합니다. 링크는 생성 시점부터 1시간 동안만
        유효합니다.
      </p>
      {#if !users.filter((person) => person.role === 'member').length}
        <p class="empty-modal">등록된 멤버가 없습니다. 먼저 멤버를 초대하세요.</p>
      {/if}
      {#each users.filter((person) => person.role === 'member') as person (person.id)}
        <div class="member-row">
          <span class="avatar small-avatar">{person.displayName.slice(0, 1).toUpperCase()}</span>
          <div class="member-details">
            <strong>{person.displayName}</strong>
            <small
              >@{person.handle ?? person.loginId ?? 'member'} · {person.status === 'active'
                ? '활성'
                : person.status === 'disabled'
                  ? '비활성'
                  : '등록 중'}</small
            >
          </div>
          <div class="member-actions">
            {#if person.status === 'active'}
              <button
                class="secondary-button"
                disabled={updatingMemberId === person.id}
                onclick={() => void setMemberStatus(person, 'disabled')}>비활성화</button
              >
              <button
                class="primary-button"
                disabled={updatingMemberId === person.id}
                onclick={() => void createDirectResetLink(person)}
                >{updatingMemberId === person.id ? '처리 중…' : '변경 링크 생성'}</button
              >
            {:else if person.status === 'disabled'}
              <button
                class="secondary-button"
                disabled={updatingMemberId === person.id}
                onclick={() => void setMemberStatus(person, 'active')}
                >{updatingMemberId === person.id ? '처리 중…' : '활성화'}</button
              >
            {:else}
              <span class="member-pending">등록 완료 대기</span>
            {/if}
          </div>
          {#if generatedResetLinks[person.id]}
            <div class="member-link-result">
              <span class="mono reset-link">{generatedResetLinks[person.id].link}</span>
              <button
                class="secondary-button"
                onclick={() => navigator.clipboard?.writeText(generatedResetLinks[person.id].link)}
                >복사</button
              >
              <small
                >{new Date(generatedResetLinks[person.id].expiresAt).toLocaleString('ko-KR')}까지
                유효</small
              >
            </div>
          {/if}
        </div>
      {/each}
      <h3 class="reset-request-heading">분실 요청</h3>
      {#if !resetRequests.length}<p class="empty-modal">대기 중인 요청이 없습니다.</p>{/if}
      {#each resetRequests as request (request.id)}
        <div class="reset-row">
          <div>
            <strong>{request.display_name}</strong>
            <small
              >{request.login_id} · {new Date(request.created_at).toLocaleString('ko-KR')}</small
            >
          </div>
          {#if request.link}
            <div class="reset-link-actions">
              <span class="mono reset-link">{request.link}</span>
              <button
                class="secondary-button"
                onclick={() => navigator.clipboard?.writeText(request.link ?? '')}>복사</button
              >
            </div>
          {:else}
            <button class="secondary-button" onclick={() => void createResetLink(request)}
              >변경 링크 생성</button
            >
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .app-shell {
    display: grid;
    grid-template-columns: 252px minmax(0, 1fr);
    min-height: 100vh;
    background: radial-gradient(circle at 70% -10%, #38291d55, transparent 33%), #0b0d0f;
  }
  .sidebar {
    display: flex;
    flex-direction: column;
    padding: 28px 18px 20px;
    border-right: 1px solid var(--line);
    background: linear-gradient(180deg, #0f1114, #0b0d0f 72%);
  }
  .side-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 0 10px 58px;
    font-size: 0.9rem;
    letter-spacing: -0.03em;
  }
  .brand-dot {
    width: 12px;
    height: 16px;
    border-radius: 2px 6px 2px 2px;
    background: var(--copper);
    transform: skew(-15deg);
  }
  .space-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px 10px;
  }
  .connection-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 0 4px #9fd7a31a;
  }
  .connection-dot.offline {
    background: var(--danger);
    box-shadow: 0 0 0 4px #e27c7c1a;
  }
  .connection-state {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--dim);
    font:
      0.62rem 'DM Mono',
      monospace;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: 0;
    border-radius: 8px;
    padding: 11px 12px;
    color: var(--muted);
    background: transparent;
    text-align: left;
    font-size: 0.82rem;
    transition:
      background 0.16s ease,
      color 0.16s ease,
      transform 0.16s ease;
  }
  .nav-item:hover,
  .nav-item.active {
    color: var(--ink);
    background: linear-gradient(90deg, #201a15, var(--surface));
  }
  .nav-item:hover {
    transform: translateX(2px);
  }
  .nav-glyph {
    width: 16px;
    color: var(--copper);
  }
  .nav-count {
    margin-left: auto;
    color: var(--dim);
    font:
      0.7rem 'DM Mono',
      monospace;
  }
  .sidebar-rule {
    height: 1px;
    margin: 22px 12px;
    background: var(--line);
  }
  .sidebar-footer {
    display: grid;
    gap: 5px;
    margin-top: auto;
  }
  .connect-button {
    border: 1px solid var(--copper);
    border-radius: 8px;
    padding: 10px;
    color: var(--copper);
    background: transparent;
    font-size: 0.75rem;
  }
  .profile {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-top: 18px;
    padding: 10px 4px 6px;
    color: var(--ink);
    background: transparent;
    border: 0;
    width: 100%;
    text-align: left;
    cursor: pointer;
  }
  .profile:hover {
    color: var(--copper);
  }
  .profile strong,
  .profile small {
    display: block;
  }
  .logout-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 9px 10px;
    color: var(--muted);
    background: #111419;
    font-size: 0.72rem;
    transition:
      border-color 0.16s ease,
      color 0.16s ease,
      background 0.16s ease;
  }
  .logout-button:hover:not(:disabled) {
    border-color: #77513a;
    color: var(--copper);
    background: #211812;
  }
  .profile strong {
    font-size: 0.75rem;
  }
  .profile small {
    margin-top: 3px;
    color: var(--dim);
    font-size: 0.65rem;
  }
  .avatar {
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    border-radius: 50%;
    color: #17120d;
    background: var(--copper);
    font-weight: 700;
    font-size: 0.75rem;
  }
  .avatar-image {
    object-fit: cover;
    overflow: hidden;
  }
  .avatar-picker {
    position: relative;
    display: grid;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
  }
  .avatar-picker .avatar {
    width: 52px;
    height: 52px;
    font-size: 1rem;
  }
  .avatar-edit {
    position: absolute;
    right: -5px;
    bottom: -3px;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 3px 5px;
    color: var(--ink);
    background: #20252b;
    font-size: 0.55rem;
  }
  .profile-fields {
    display: grid;
    gap: 11px;
    margin-bottom: 18px;
  }
  .form-field small,
  .password-heading small {
    display: block;
    margin-top: 4px;
    color: var(--dim);
    font-size: 0.63rem;
  }
  .password-heading {
    border-top: 1px solid var(--line);
    padding-top: 16px;
    margin-bottom: 12px;
  }
  .password-heading strong {
    display: block;
    font-size: 0.78rem;
  }
  .profile-actions {
    margin-top: 0;
    margin-bottom: 20px;
  }
  .login-id-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    padding: 13px 0;
    margin-bottom: 18px;
  }
  .login-id-row strong,
  .login-id-row small {
    display: block;
  }
  .login-id-row strong {
    font-size: 0.75rem;
  }
  .login-id-row small {
    margin-top: 4px;
    color: var(--dim);
    font-size: 0.63rem;
  }
  .login-id-value {
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 7px 9px;
    color: var(--copper);
    background: #111419;
    font:
      0.68rem 'DM Mono',
      monospace;
    cursor: pointer;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .reset-request-heading {
    margin: 0 0 10px;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
  }
  .small-avatar {
    width: 30px;
    height: 30px;
  }
  .workspace {
    width: min(100%, 1220px);
    min-width: 0;
    margin: 0 auto;
    padding: 42px clamp(24px, 5vw, 76px) 80px;
  }
  .topbar {
    display: flex;
    align-items: end;
    justify-content: space-between;
    min-width: 0;
    gap: 20px;
    margin-bottom: 32px;
  }
  .topbar h1 {
    margin: 9px 0 0;
    font-size: clamp(1.8rem, 3vw, 2.7rem);
    letter-spacing: -0.06em;
  }
  .workspace-subtitle {
    overflow: hidden;
    max-width: 430px;
    margin: 10px 0 0;
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.65;
  }
  .top-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .storage-meter {
    display: grid;
    gap: 5px;
    min-width: 164px;
  }
  .storage-meter-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    color: var(--dim);
    font-size: 0.62rem;
  }
  .storage-meter-label strong {
    color: var(--muted);
    font:
      0.62rem 'DM Mono',
      monospace;
    font-weight: 400;
    white-space: nowrap;
  }
  .storage-meter-track {
    height: 4px;
    overflow: hidden;
    border-radius: 99px;
    background: #282d32;
  }
  .storage-meter-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--copper);
    transition: width 0.3s ease;
  }
  .icon-button {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 11px;
    color: var(--muted);
    background: var(--surface);
    font-size: 1rem;
    transition:
      color 0.16s ease,
      border-color 0.16s ease,
      background 0.16s ease;
  }
  .icon-button:hover {
    color: var(--ink);
    border-color: #59636d;
    background: var(--surface-strong);
  }
  .setup-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
    border: 1px solid #58412c;
    border-radius: 11px;
    padding: 15px 17px;
    color: var(--copper);
    background: #211a14;
  }
  .setup-banner p {
    margin: 5px 0 0;
    color: #a98a6e;
    font-size: 0.73rem;
  }
  .upload-button {
    border: 1px solid #725337;
    border-radius: 9px;
    padding: 10px 13px;
    color: #20150d;
    background: var(--copper);
    font-size: 0.75rem;
    font-weight: 700;
    transition:
      background 0.16s ease,
      transform 0.16s ease;
    cursor: pointer;
    white-space: nowrap;
  }
  .privacy-banner {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 34px;
    border: 1px solid #6f4b2f;
    border-radius: 8px;
    padding: 7px 10px;
    color: #d9b08a;
    background: #211a14;
    font-size: 0.68rem;
    line-height: 1.35;
    margin-bottom: 14px;
  }
  .privacy-notice-icon {
    display: grid;
    flex: 0 0 auto;
    width: 17px;
    height: 17px;
    place-items: center;
    border: 1px solid #c6884f;
    border-radius: 50%;
    color: #f0b273;
    font:
      700 0.68rem 'DM Mono',
      monospace;
  }
  .upload-button:hover {
    background: var(--copper-bright);
    transform: translateY(-1px);
  }
  .upload-button input {
    display: none;
  }
  .drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    overflow: hidden;
    pointer-events: none;
    background: #0b0d0fcc;
    animation: drop-overlay-in 0.22s ease-out both;
  }
  .drop-overlay::before {
    position: absolute;
    inset: 22px;
    border: 1px dashed #d99b5f99;
    border-radius: 24px;
    content: '';
    box-shadow: inset 0 0 80px #d8893f0f;
  }
  .drop-overlay-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 15px;
    border: 1px solid #d99b5f99;
    border-radius: 16px;
    padding: 18px 22px;
    color: var(--ink);
    background: #191512f2;
    box-shadow: 0 18px 60px #000b;
    animation: drop-card-float 1.8s ease-in-out infinite;
  }
  .drop-overlay-card strong,
  .drop-overlay-card span {
    display: block;
  }
  .drop-overlay-card strong {
    font-size: 0.9rem;
  }
  .drop-overlay-card span:last-child {
    margin-top: 5px;
    color: var(--muted);
    font-size: 0.7rem;
  }
  .drop-overlay-icon {
    display: grid;
    width: 42px;
    height: 42px;
    place-items: center;
    border: 1px solid #d99b5f;
    border-radius: 12px;
    color: var(--copper-bright);
    background: var(--copper-soft);
    font-size: 1.4rem;
  }
  .drop-orbit {
    position: absolute;
    width: min(50vw, 560px);
    aspect-ratio: 1;
    border: 1px solid #d99b5f2e;
    border-radius: 50%;
    animation: drop-orbit-pulse 2.4s ease-out infinite;
  }
  .drop-orbit-two {
    width: min(34vw, 380px);
    animation-delay: 0.7s;
  }
  @keyframes drop-overlay-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes drop-card-float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-5px);
    }
  }
  @keyframes drop-orbit-pulse {
    0% {
      opacity: 0.15;
      transform: scale(0.82);
    }
    70%,
    100% {
      opacity: 0;
      transform: scale(1.12);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .drop-overlay,
    .drop-overlay-card,
    .drop-orbit,
    .file-row.folder-drop-target .file-icon.folder {
      animation: none;
    }
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 12px;
  }
  .breadcrumbs {
    display: flex;
    flex: 0 0 auto;
    gap: 9px;
    align-items: center;
    color: var(--muted);
    font-size: 0.8rem;
    white-space: nowrap;
  }
  .breadcrumbs button {
    border: 0;
    padding: 0;
    color: var(--copper);
    background: transparent;
  }
  .breadcrumbs button.current {
    color: var(--ink);
  }
  .parent-drop-zone {
    border: 1px dashed var(--line) !important;
    border-radius: 7px !important;
    padding: 5px 8px !important;
    color: var(--muted) !important;
    background: transparent !important;
    font-size: 0.68rem;
  }
  .parent-drop-zone:hover,
  .parent-drop-zone.move-drop-target {
    border-color: var(--copper) !important;
    color: var(--copper-bright) !important;
    background: var(--copper-soft) !important;
  }
  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-width: 0;
    justify-content: flex-end;
  }
  .danger-button {
    border: 1px solid #6b3939;
    border-radius: 7px;
    padding: 9px 12px;
    color: #edaaaa;
    background: #261719;
    font-size: 0.72rem;
    white-space: nowrap;
  }
  .danger-button:hover:not(:disabled) {
    border-color: var(--danger);
    color: #ffd3d3;
    background: #351b1d;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 5px;
    width: min(240px, 35vw);
    border: 1px solid transparent;
    border-bottom-color: var(--line);
    color: var(--dim);
  }
  .search input {
    border: 0;
    padding: 8px 4px;
    background: transparent;
    font-size: 0.72rem;
  }
  .search input:focus {
    border: 0;
  }
  .search:focus-within {
    border-color: var(--line);
    border-radius: 8px;
    background: #11151a;
  }
  .secondary-button {
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 9px 12px;
    color: var(--muted);
    background: #171b20;
    font-size: 0.72rem;
  }
  .secondary-button:hover {
    color: var(--ink);
    border-color: #4c555e;
  }
  .primary-button {
    border: 1px solid var(--copper);
    border-radius: 9px;
    padding: 10px 14px;
    color: #1b120c;
    background: var(--copper);
    font-size: 0.75rem;
    font-weight: 700;
    transition:
      background 0.16s ease,
      transform 0.16s ease;
  }
  .primary-button:hover:not(:disabled) {
    background: var(--copper-bright);
    transform: translateY(-1px);
  }
  .sort-select {
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 8px 9px;
    color: var(--muted);
    background: var(--surface);
    font-size: 0.68rem;
  }
  .sort-direction {
    padding: 7px 9px;
  }
  .inline-message {
    margin: 0 0 10px;
    font-size: 0.75rem;
  }
  .trash-notice {
    margin: 0 0 10px;
    border: 1px solid color-mix(in srgb, var(--copper) 28%, var(--line));
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--muted);
    background: #171411;
    font-size: 0.72rem;
  }
  .file-table {
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: #101317b8;
    box-shadow: 0 16px 40px #00000012;
  }
  .table-head,
  .file-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 96px 112px 320px;
    align-items: center;
    gap: 14px;
  }
  .table-head {
    padding: 12px 12px 10px;
    color: var(--dim);
    font:
      0.65rem 'DM Mono',
      monospace;
    text-transform: uppercase;
    background: #15191e;
  }
  .table-name-heading {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .table-name-heading input {
    width: 14px;
    height: 14px;
    accent-color: var(--copper);
  }
  .table-head > span:last-child {
    text-align: right;
  }
  .file-row {
    min-height: 62px;
    border-top: 1px solid var(--line-soft);
    padding: 10px 12px;
  }
  .file-row:hover {
    background: #191e24;
  }
  .file-row.selected {
    background: linear-gradient(90deg, #272018, #191e24);
  }
  .file-row.folder-drop-target {
    position: relative;
    z-index: 1;
    border-color: var(--copper);
    background: linear-gradient(90deg, #3a2819, #24201b);
    box-shadow:
      inset 0 0 0 1px #d99b5f66,
      0 0 28px #d8893f24;
    transform: translateX(4px);
    transition:
      background 0.18s ease,
      border-color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.18s ease;
  }
  .file-row.folder-drop-target .file-icon.folder {
    animation: folder-drop-pulse 0.9s ease-in-out infinite;
    box-shadow: 0 0 0 5px #d8893f1c;
  }
  .drag-handle[draggable='true'] {
    cursor: grab;
  }
  .drag-handle[draggable='true']:active {
    cursor: grabbing;
  }
  .file-row.dragging-source {
    opacity: 0.55;
    outline: 1px dashed var(--copper);
    outline-offset: -4px;
  }
  .file-row.move-drop-target {
    border-color: var(--success);
    background: hsl(124 25% 18% / 0.7);
    box-shadow: inset 0 0 0 1px hsl(124 40% 50% / 0.25);
  }
  .file-row.move-drop-target .file-main strong::after {
    margin-left: 8px;
    color: var(--success);
    content: '여기에 놓기';
    font:
      0.62rem 'DM Mono',
      monospace;
  }
  @keyframes folder-drop-pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }
  .file-name {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
  }
  .drag-handle {
    width: 10px;
    color: var(--dim);
    cursor: grab;
    font-size: 1rem;
    line-height: 1;
    pointer-events: none;
  }
  .file-name input {
    width: 14px;
    height: 14px;
    accent-color: var(--copper);
  }
  .file-main {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
    border: 0;
    padding: 0;
    color: var(--ink);
    background: transparent;
    text-align: left;
  }
  .file-main > span:last-child {
    min-width: 0;
    overflow: hidden;
  }
  .file-main strong,
  .file-main small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-main strong {
    max-width: 100%;
    font-size: 0.78rem;
    font-weight: 500;
  }
  .file-main small {
    margin-top: 4px;
    color: var(--dim);
    font:
      0.62rem 'DM Mono',
      monospace;
  }
  .file-icon {
    display: grid;
    width: 26px;
    height: 30px;
    place-items: center;
    border: 1px solid var(--file-border);
    border-radius: 5px;
    color: var(--file-accent);
    font-size: 0.9rem;
    overflow: hidden;
    position: relative;
  }
  .file-icon.folder {
    border-color: var(--folder-border);
    color: var(--folder-accent);
    background: var(--folder-surface);
  }
  .file-icon.image {
    border-color: var(--image-border);
    background: var(--image-surface);
  }
  .file-icon.video {
    border-color: var(--video-border);
    background: var(--video-surface);
  }
  .folder-glyph {
    width: 15px;
    height: 11px;
    border: 1px solid currentColor;
    border-radius: 2px;
    background: currentColor;
    clip-path: polygon(0 20%, 42% 20%, 52% 0, 100% 0, 100% 100%, 0 100%);
    opacity: 0.95;
  }
  .file-icon img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: #090b0d;
  }
  .file-icon i {
    position: absolute;
    inset: auto 3px 3px auto;
    display: grid;
    width: 14px;
    height: 14px;
    place-items: center;
    border-radius: 50%;
    color: #17120d;
    background: var(--video-accent);
    font-size: 0.46rem;
    font-style: normal;
  }
  .file-meta {
    color: var(--muted);
    font:
      0.68rem 'DM Mono',
      monospace;
  }
  .row-actions {
    display: flex;
    justify-content: end;
    gap: 4px;
    width: 100%;
    min-width: 320px;
    flex-wrap: nowrap;
    opacity: 0.62;
    transition: opacity 0.18s ease;
  }
  .file-row:hover .row-actions,
  .file-row:focus-within .row-actions {
    opacity: 1;
  }
  .row-actions button {
    flex: 0 0 auto;
    min-width: max-content;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 5px 7px;
    color: var(--muted);
    background: transparent;
    font-size: 0.68rem;
    text-decoration: none;
    white-space: nowrap;
    word-break: keep-all;
    overflow-wrap: normal;
    writing-mode: horizontal-tb;
  }
  .row-actions button:hover {
    color: var(--copper);
    border-color: #4b3a2a;
    background: #211a14;
  }
  .row-actions .danger-button:hover {
    color: var(--danger);
  }
  .empty-row {
    display: grid;
    min-height: 270px;
    place-content: center;
    justify-items: center;
    gap: 8px;
    border-top: 1px solid var(--line-soft);
    color: var(--muted);
  }
  .list-refreshing {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 14px;
    color: var(--muted);
    font-size: 0.68rem;
  }
  .list-refreshing .spinner {
    width: 12px;
    height: 12px;
  }
  .empty-row strong {
    color: var(--ink);
    font-size: 0.85rem;
  }
  .empty-row small {
    color: var(--dim);
    font-size: 0.7rem;
  }
  .empty-mark {
    color: var(--copper);
    font-size: 2rem;
  }
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--line);
    border-top-color: var(--copper);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .upload-tray {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 3;
    width: min(360px, calc(100vw - 32px));
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 14px;
    background: #15191d;
    box-shadow: 0 16px 50px #0008;
  }
  .upload-status-chip {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #77513a;
    border-radius: 999px;
    padding: 10px 13px;
    color: var(--ink);
    background: #1c1712;
    box-shadow: 0 12px 34px #0008;
    font-size: 0.72rem;
  }
  .upload-status-chip .spinner {
    width: 13px;
    height: 13px;
  }
  .tray-title,
  .upload-line > div:first-child {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
  .upload-line > div:first-child {
    min-width: 0;
  }
  .tray-title {
    margin-bottom: 12px;
    font-size: 0.78rem;
  }
  .tray-title button,
  .modal-close {
    border: 0;
    color: var(--muted);
    background: transparent;
  }
  .upload-line {
    padding: 10px 0;
    border-top: 1px solid #242a30;
  }
  .upload-line strong,
  .upload-line span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .upload-line strong {
    flex: 1;
    min-width: 0;
    max-width: none;
    font-size: 0.7rem;
    font-weight: 500;
  }
  .upload-line span {
    color: var(--copper);
    font:
      0.62rem 'DM Mono',
      monospace;
  }
  .upload-line span.error {
    color: var(--danger);
  }
  .upload-line button {
    border: 0;
    padding: 0;
    color: var(--muted);
    background: transparent;
    font-size: 0.65rem;
  }
  .upload-line button:hover {
    color: var(--copper);
  }
  .progress {
    height: 3px;
    margin-top: 8px;
    border-radius: 4px;
    background: #2b3035;
  }
  .progress i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--copper);
    transition: width 0.2s ease;
  }
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 4;
    display: grid;
    place-items: center;
    padding: 20px;
    background: #050607d9;
    backdrop-filter: blur(7px);
  }
  .context-menu {
    position: fixed;
    z-index: 8;
    width: 218px;
    overflow: hidden;
    border: 1px solid #444d57;
    border-radius: 12px;
    padding: 6px;
    background: #1a1f25;
    box-shadow:
      0 18px 52px #000b,
      inset 0 1px #ffffff0d;
  }
  .context-menu-name {
    overflow: hidden;
    margin: 4px 7px 7px;
    color: var(--muted);
    font:
      0.62rem 'DM Mono',
      monospace;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .context-menu button {
    display: block;
    width: 100%;
    border: 0;
    border-radius: 7px;
    padding: 9px 8px;
    color: var(--ink);
    background: transparent;
    text-align: left;
    font-size: 0.74rem;
  }
  .context-menu button:hover {
    color: var(--copper);
    background: #292017;
  }
  .context-menu .context-danger {
    color: var(--danger);
  }
  .context-menu .context-danger:hover {
    color: #ffc0c0;
    background: #2a1718;
  }
  .context-rule {
    height: 1px;
    margin: 5px 7px;
    background: var(--line);
  }
  .preview-backdrop {
    z-index: 7;
  }
  .preview-modal {
    width: min(980px, 100%);
    max-height: min(760px, calc(100vh - 40px));
    overflow: hidden;
    border: 1px solid #424b55;
    border-radius: 16px;
    background: #13171c;
    box-shadow: 0 24px 80px #000c;
  }
  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 18px 20px;
    border-bottom: 1px solid var(--line);
  }
  .preview-header h2 {
    overflow: hidden;
    max-width: 580px;
    margin: 4px 0 0;
    font-size: 0.95rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .preview-kind {
    margin: 5px 0 0;
    color: var(--copper);
    font-size: 0.65rem;
  }
  .preview-actions {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .preview-actions .modal-close {
    position: static;
    padding: 4px 7px;
    font-size: 1.35rem;
  }
  .preview-stage {
    display: grid;
    min-height: min(56vh, 540px);
    place-items: center;
    background: #090b0d;
  }
  .preview-stage video,
  .preview-stage img,
  .preview-stage iframe {
    display: block;
    width: 100%;
    max-height: min(66vh, 620px);
    border: 0;
  }
  .audio-file-mark {
    color: var(--copper);
    font-size: 1.25rem;
    font-style: normal;
  }
  .audio-preview-card {
    display: grid;
    width: min(100% - 40px, 620px);
    grid-template-columns: auto minmax(0, 1fr);
    gap: 16px;
    border: 1px solid #5f4937;
    border-radius: 14px;
    padding: 24px;
    background: radial-gradient(circle at top right, #3a271a, #15191d 60%);
  }
  .audio-preview-mark {
    display: grid;
    width: 48px;
    height: 48px;
    place-items: center;
    border: 1px solid #8c613e;
    border-radius: 12px;
    color: var(--copper);
    background: #2a1d13;
    font-size: 1.6rem;
  }
  .audio-preview-card strong,
  .audio-preview-card small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .audio-preview-card strong {
    margin-top: 3px;
    font-size: 0.82rem;
  }
  .audio-preview-card small {
    margin-top: 5px;
    color: var(--dim);
    font-size: 0.66rem;
  }
  .audio-preview-card audio {
    width: 100%;
    grid-column: 1 / -1;
    margin-top: 4px;
  }
  .preview-stage video,
  .preview-stage img {
    object-fit: contain;
  }
  .preview-stage iframe {
    height: min(66vh, 620px);
    background: #fff;
  }
  .modal {
    position: relative;
    width: min(100%, 420px);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 30px;
    background: linear-gradient(145deg, #1b2026, #14171b);
    box-shadow:
      0 24px 80px #000b,
      inset 0 1px #ffffff0d;
  }
  .wide-modal {
    width: min(100%, 520px);
  }
  .modal-close {
    position: absolute;
    top: 15px;
    right: 16px;
    font-size: 1.4rem;
  }
  .modal h2 {
    margin: 10px 0 12px;
    font-size: 1.6rem;
    letter-spacing: -0.05em;
  }
  .modal-description {
    margin: -3px 0 20px;
    color: var(--muted);
  }
  .modal-error {
    margin: -6px 0 0;
    border-left: 2px solid var(--danger);
    padding: 7px 9px;
    color: #f0a0a0;
    background: #3a161a66;
    font-size: 0.74rem;
    line-height: 1.45;
  }
  .modal p {
    line-height: 1.6;
    font-size: 0.78rem;
  }
  .modal .primary-button {
    margin-top: 0;
  }
  .conflict-modal {
    width: min(100%, 500px);
  }
  .conflict-file {
    display: grid;
    gap: 5px;
    margin: 0 0 16px;
    border: 1px solid #3b434c;
    border-radius: 10px;
    padding: 11px 13px;
    background: #11151a;
  }
  .conflict-file span,
  .conflict-apply-all small,
  .conflict-choice small {
    color: var(--dim);
    font-size: 0.66rem;
  }
  .conflict-file strong {
    overflow: hidden;
    color: var(--ink);
    font:
      0.72rem 'DM Mono',
      monospace;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .conflict-actions {
    display: grid;
    gap: 8px;
  }
  .conflict-choice {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 9px;
    padding: 10px 12px;
    color: var(--ink);
    background: #171b20;
    text-align: left;
    transition:
      border-color 0.16s ease,
      background 0.16s ease,
      transform 0.16s ease;
  }
  .conflict-choice:hover {
    border-color: #69737e;
    background: #20262d;
    transform: translateY(-1px);
  }
  .conflict-choice > span,
  .conflict-choice strong,
  .conflict-choice small,
  .conflict-apply-all strong,
  .conflict-apply-all small {
    display: block;
  }
  .conflict-choice strong,
  .conflict-apply-all strong {
    font-size: 0.74rem;
  }
  .conflict-choice small {
    margin-top: 3px;
    line-height: 1.4;
  }
  .conflict-choice-primary {
    border-color: #c98d59;
    background: linear-gradient(90deg, #3b291b, #241d18);
  }
  .conflict-choice-primary:hover {
    border-color: var(--copper);
    background: linear-gradient(90deg, #4a301e, #2d211a);
  }
  .conflict-choice-primary strong {
    color: var(--copper-bright);
  }
  .conflict-apply-all {
    display: grid;
    gap: 10px;
    margin-top: 18px;
    border-top: 1px solid var(--line);
    padding-top: 16px;
  }
  .conflict-apply-all small {
    margin-top: 3px;
  }
  .conflict-batch-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
  }
  .conflict-batch-actions button {
    min-width: 0;
    padding-inline: 8px;
    white-space: nowrap;
  }
  .form-field {
    display: grid;
    gap: 8px;
  }
  .form-field > span {
    color: var(--muted);
    font-size: 0.7rem;
    font-weight: 600;
  }
  .form-field input {
    width: 100%;
    padding: 12px 13px;
    font-size: 0.82rem;
    transition:
      border-color 0.16s ease,
      background 0.16s ease;
  }
  .form-field input:focus {
    border-color: var(--copper);
    background: #11151a;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 9px;
    margin-top: 20px;
  }
  .modal-actions .primary-button {
    min-width: 112px;
  }
  .share-actions {
    justify-content: space-between;
  }
  .share-actions > span {
    color: var(--dim);
    font:
      0.65rem 'DM Mono',
      monospace;
  }
  .share-search {
    margin-top: 18px;
  }
  .share-person select {
    min-width: 88px;
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 6px 7px;
    color: var(--ink);
    background: #11151a;
    font-size: 0.66rem;
  }
  .share-invitation-banner {
    display: grid;
    gap: 12px;
    margin-bottom: 18px;
    border: 1px solid #77513a;
    border-radius: 12px;
    padding: 14px 16px;
    background: linear-gradient(100deg, #241a13, #17191c);
  }
  .share-invitation-banner strong,
  .share-invitation-banner small {
    display: block;
  }
  .share-invitation-banner small {
    margin-top: 4px;
    color: var(--muted);
  }
  .invitation-actions,
  .invitation-row {
    display: grid;
    gap: 8px;
  }
  .invitation-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    border-top: 1px solid #3a2b20;
    padding-top: 10px;
    font-size: 0.72rem;
  }
  @media (max-width: 760px) {
    .invitation-row {
      grid-template-columns: 1fr 1fr;
    }
    .invitation-row span {
      grid-column: 1 / -1;
    }
  }
  .invite-link {
    overflow: auto;
    margin-top: 20px;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px;
    color: var(--copper);
    background: #0d0f11;
    font-size: 0.7rem;
    white-space: nowrap;
  }
  .profile-summary {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 18px 0 24px;
  }
  .profile-summary strong,
  .profile-summary small,
  .passkey-heading small,
  .passkey-row strong,
  .passkey-row small {
    display: block;
  }
  .profile-summary strong {
    font-size: 0.9rem;
  }
  .profile-summary small,
  .passkey-heading small,
  .passkey-row small {
    margin-top: 3px;
    color: var(--dim);
    font-size: 0.66rem;
  }
  .passkey-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid var(--line);
    padding-top: 16px;
  }
  .passkey-heading strong,
  .passkey-row strong {
    font-size: 0.78rem;
  }
  .passkey-heading .primary-button {
    white-space: nowrap;
  }
  .passkey-list {
    margin-top: 14px;
    border-top: 1px solid var(--line);
  }
  .passkey-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid var(--line);
    padding: 12px 0;
  }
  .member-row {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    align-items: center;
    gap: 11px;
    border-top: 1px solid var(--line);
    padding: 14px 0;
  }
  .member-details strong,
  .member-details small {
    display: block;
  }
  .member-details strong {
    font-size: 0.8rem;
  }
  .member-details small,
  .member-pending,
  .member-link-result small {
    margin-top: 3px;
    color: var(--dim);
    font-size: 0.65rem;
  }
  .member-actions {
    display: flex;
    gap: 7px;
  }
  .member-link-result {
    display: grid;
    grid-column: 2 / -1;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 7px;
    margin-top: 2px;
    border: 1px solid #77513a;
    border-radius: 8px;
    padding: 9px;
    background: #17130f;
  }
  .member-link-result small {
    grid-column: 1 / -1;
    margin: 0;
  }
  .share-list {
    max-height: min(360px, 45vh);
    margin-top: 18px;
    overflow: auto;
    border-block: 1px solid var(--line);
  }
  .share-person {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    align-items: center;
    gap: 11px;
    padding: 12px 2px;
    border-top: 1px solid #242a30;
    transition: background 0.16s ease;
  }
  .share-person:hover {
    background: #1b2025;
  }
  .share-person:first-child {
    border-top: 0;
  }
  .share-person strong,
  .share-person small {
    display: block;
  }
  .share-person strong {
    font-size: 0.78rem;
  }
  .share-person small {
    margin-top: 3px;
    color: var(--dim);
    font:
      0.64rem 'DM Mono',
      monospace;
  }
  .share-person input {
    width: 16px;
    height: 16px;
    accent-color: var(--copper);
  }
  .empty-modal {
    color: var(--muted);
  }
  .reset-row {
    display: grid;
    gap: 10px;
    border-top: 1px solid var(--line);
    padding: 13px 0;
  }
  .reset-row > div:first-child strong,
  .reset-row > div:first-child small {
    display: block;
  }
  .reset-row > div:first-child strong {
    font-size: 0.8rem;
  }
  .reset-row > div:first-child small {
    margin-top: 4px;
    color: var(--dim);
    font-size: 0.65rem;
  }
  .reset-link-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .reset-link {
    min-width: 0;
    overflow: hidden;
    color: var(--copper);
    font-size: 0.64rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 1180px) {
    .toolbar {
      align-items: flex-start;
      flex-direction: column;
    }
    .toolbar-actions {
      width: 100%;
      justify-content: flex-start;
    }
    .table-head,
    .file-row {
      grid-template-columns: minmax(0, 1fr) 78px 90px 230px;
      gap: 10px;
    }
    .row-actions {
      min-width: 0;
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    .row-actions button {
      padding: 4px 5px;
      font-size: 0.62rem;
    }
  }
  @media (max-width: 760px) {
    .member-row {
      grid-template-columns: 30px minmax(0, 1fr);
    }
    .member-actions,
    .member-link-result {
      grid-column: 1 / -1;
    }
    .member-actions {
      flex-wrap: wrap;
    }
    .move-hint {
      margin: 0;
      color: var(--success);
      font:
        0.68rem 'DM Mono',
        monospace;
    }
    .app-shell {
      display: block;
    }
    .sidebar {
      display: block;
      min-height: auto;
      padding: 18px 18px 10px;
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
    .side-brand {
      margin: 0 0 18px;
    }
    .space-label,
    .sidebar-rule,
    .sidebar-footer .nav-item {
      display: none;
    }
    .sidebar-footer {
      display: flex;
      position: absolute;
      top: 12px;
      right: 12px;
    }
    .top-actions {
      align-items: flex-end;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .storage-meter {
      flex: 1 1 100%;
      min-width: min(100%, 220px);
      order: -1;
    }
    .profile {
      margin: 0;
    }
    .profile span:last-child {
      display: none;
    }
    .logout-button {
      width: 34px;
      height: 34px;
      padding: 0;
      font-size: 0;
    }
    .logout-button span {
      font-size: 0.9rem;
    }
    .workspace {
      padding: 28px 18px 100px;
    }
    .topbar {
      align-items: start;
    }
    .upload-button {
      padding: 8px 10px;
    }
    .toolbar {
      align-items: start;
      flex-direction: column;
    }
    .toolbar-actions {
      width: 100%;
      flex-wrap: wrap;
    }
    .privacy-banner {
      display: flex;
      width: 100%;
    }
    .search {
      flex: 1;
      width: auto;
    }
    .table-head {
      display: none;
    }
    .file-row {
      grid-template-columns: minmax(0, 1fr) 62px 68px;
      gap: 8px;
    }
    .file-meta:nth-child(3) {
      display: none;
    }
    .row-actions {
      grid-column: 1 / -1;
      width: auto;
      min-width: 0;
      flex-wrap: wrap;
      justify-content: start;
      padding-left: 39px;
      opacity: 1;
    }
    .file-main strong {
      max-width: 50vw;
    }
    .setup-banner {
      align-items: start;
      flex-direction: column;
    }
    .setup-banner .secondary-button {
      width: 100%;
    }
    .upload-tray {
      right: 16px;
      bottom: 16px;
    }
    .upload-status-chip {
      right: 16px;
      bottom: 16px;
    }
    .preview-header {
      align-items: flex-start;
      padding: 15px;
    }
    .preview-header h2 {
      max-width: 48vw;
    }
    .preview-actions .secondary-button {
      display: none;
    }
    .conflict-batch-actions {
      grid-template-columns: 1fr;
    }
    .conflict-batch-actions button {
      width: 100%;
    }
  }
</style>
