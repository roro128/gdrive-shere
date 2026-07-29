type StorageQuota = {
  usage: number;
  limit: number | null;
  available?: boolean;
};

export type StorageQuotaState = {
  quota: StorageQuota | null;
};

export type StorageQuotaAction =
  { type: 'set-quota'; quota: StorageQuota | null } | { type: 'clear-quota' };

export function initialStorageQuotaState(): StorageQuotaState {
  return { quota: null };
}

export function storageQuotaReducer(
  state: StorageQuotaState,
  action: StorageQuotaAction
): StorageQuotaState {
  void state;
  switch (action.type) {
    case 'set-quota':
      return { quota: action.quota ? { ...action.quota } : null };
    case 'clear-quota':
      return { quota: null };
  }
}
