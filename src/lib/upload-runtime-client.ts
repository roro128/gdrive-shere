export type UploadRuntime = {
  createId: () => string;
  createController: () => AbortController;
  sleep: (milliseconds: number) => Promise<void>;
};

export const browserUploadRuntime: UploadRuntime = {
  createId: () => crypto.randomUUID(),
  createController: () => new AbortController(),
  sleep: (milliseconds) => new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds))
};
