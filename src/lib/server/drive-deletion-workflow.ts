export type DriveDeletionEffects = {
  deleteFile: (driveFileId: string) => Promise<void>;
  isMissingFileError?: (cause: unknown) => boolean;
};

export function deleteDriveFilesSequentially(
  driveFileIds: readonly string[],
  effects: DriveDeletionEffects
): Promise<void> {
  return driveFileIds.reduce(async (previous, driveFileId) => {
    await previous;
    try {
      await effects.deleteFile(driveFileId);
    } catch (cause) {
      if (effects.isMissingFileError?.(cause)) return;
      throw cause;
    }
  }, Promise.resolve());
}
