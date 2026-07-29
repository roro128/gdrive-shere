import { readResponseMessage } from './response-message';

export const INTERNAL_FILE_DRAG_TYPE = 'application/x-gdrive-file';

export type MovableFile = {
  id: string;
  name: string;
  parents?: string[];
};

type DragPayloadWriter = Pick<DataTransfer, 'setData'>;
type DragPayloadReader = Pick<DataTransfer, 'getData'>;
type MoveRequest = (fileId: string, targetParentId: string) => Promise<Response>;

type MoveFailure<T extends MovableFile> = {
  file: T;
  message: string;
};

export type MoveResult<T extends MovableFile> = {
  moved: T[];
  failed: MoveFailure<T>[];
};

export function selectMoveCandidates<T extends MovableFile>(
  files: readonly T[],
  targetParentId: string
): T[] {
  return files.filter((file) => file.id !== targetParentId && file.parents?.[0] !== targetParentId);
}

export function createInternalDragPayload(
  transfer: DragPayloadWriter,
  files: readonly MovableFile[]
): void {
  transfer.setData(INTERNAL_FILE_DRAG_TYPE, JSON.stringify(files.map((file) => file.id)));
}

export function readInternalDragIds(transfer: DragPayloadReader | null | undefined): string[] {
  const raw = transfer?.getData(INTERNAL_FILE_DRAG_TYPE);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : [];
  } catch {
    const legacyId = raw.trim();
    return legacyId && !legacyId.startsWith('[') && !legacyId.startsWith('{') ? [legacyId] : [];
  }
}

export function firstInternalDragId(transfer: DragPayloadReader | null | undefined): string | null {
  return readInternalDragIds(transfer)[0] ?? null;
}

export function resolveInternalDragIds(
  transfer: DragPayloadReader | null | undefined,
  fallbackIds: readonly string[] = []
): string[] {
  const ids = readInternalDragIds(transfer);
  return ids.length > 0 ? ids : [...fallbackIds];
}

async function responseMessage(response: Response): Promise<string> {
  return readResponseMessage(response, `이동 요청이 실패했습니다. (${response.status})`);
}

export async function moveFiles<T extends MovableFile>(
  files: readonly T[],
  targetParentId: string,
  request: MoveRequest
): Promise<MoveResult<T>> {
  const candidates = selectMoveCandidates(files, targetParentId);
  const settled = await Promise.all(
    candidates.map(async (file) => {
      try {
        const response = await request(file.id, targetParentId);
        if (response.ok) return { file, message: null };
        return { file, message: await responseMessage(response) };
      } catch {
        return {
          file,
          message: '연결을 확인한 뒤 다시 시도해주세요.'
        };
      }
    })
  );

  return {
    moved: settled.filter((item) => item.message === null).map((item) => item.file),
    failed: settled
      .filter((item): item is { file: T; message: string } => item.message !== null)
      .map(({ file, message }) => ({ file, message }))
  };
}
