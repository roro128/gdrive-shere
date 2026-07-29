export type FileReaderLike = {
  result: unknown;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  readAsDataURL: (file: Blob) => void;
};

export function readFileAsDataUrl(
  file: Blob,
  createReader: () => FileReaderLike = () => new FileReader() as unknown as FileReaderLike
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = createReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

export type ClipboardWriter = {
  writeText: (text: string) => Promise<void>;
};

export async function copyTextToClipboard(
  text: string,
  clipboard: ClipboardWriter | undefined = globalThis.navigator?.clipboard
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
