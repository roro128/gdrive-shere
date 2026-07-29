import type { RequestHandler } from '$lib/server/runtime';
import { requireUser } from '$lib/server/auth';
import { getDriveStorageQuota } from '$lib/server/google';
import { ok } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  await requireUser(event);
  try {
    const quota = await getDriveStorageQuota(event);
    return ok({ ...quota, available: quota.limit !== null });
  } catch {
    return ok({ limit: null, usage: 0, available: false });
  }
};
