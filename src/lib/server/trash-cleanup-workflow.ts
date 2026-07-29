export type TrashCleanupTarget = {
  id: string;
  driveFileId: string;
};

export type TrashCleanupResult =
  | { target: TrashCleanupTarget; status: 'deleted' }
  | { target: TrashCleanupTarget; status: 'retry'; error: string };

export type TrashCleanupEffects = {
  deleteDriveFile: (driveFileId: string) => Promise<void>;
  deleteDatabaseRow: (id: string) => Promise<void>;
  formatError?: (cause: unknown) => string;
};

function defaultErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function processTrashCleanup(
  targets: readonly TrashCleanupTarget[],
  effects: TrashCleanupEffects
): Promise<readonly TrashCleanupResult[]> {
  return targets.reduce(async (resultsPromise, target) => {
    const results = await resultsPromise;
    try {
      await effects.deleteDriveFile(target.driveFileId);
      await effects.deleteDatabaseRow(target.id);
      return [...results, { target, status: 'deleted' as const }];
    } catch (cause) {
      return [
        ...results,
        {
          target,
          status: 'retry' as const,
          error: (effects.formatError ?? defaultErrorMessage)(cause)
        }
      ];
    }
  }, Promise.resolve<readonly TrashCleanupResult[]>([]));
}
