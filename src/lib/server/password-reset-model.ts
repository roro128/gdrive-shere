export type PasswordResetRuntime = {
  now: () => string;
  newId: () => string;
};

export function buildPendingPasswordResetRequest(userId: string, runtime: PasswordResetRuntime) {
  return toPendingPasswordResetRequest({
    id: runtime.newId(),
    userId,
    createdAt: runtime.now()
  });
}

export function buildPasswordResetLinkPlan(
  input: {
    requestId: string;
    userId: string;
    tokenHash: string;
    createdBy: string;
    ttlMs: number;
  },
  runtime: PasswordResetRuntime
) {
  const createdAt = runtime.now();
  const expiresAt = new Date(Date.parse(createdAt) + input.ttlMs).toISOString();
  return {
    createdAt,
    expiresAt,
    record: toPasswordResetLinkRecord({
      id: runtime.newId(),
      requestId: input.requestId,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt,
      createdBy: input.createdBy,
      createdAt
    })
  };
}

export function toPendingPasswordResetRequest(input: {
  id: string;
  userId: string;
  createdAt: string;
}) {
  return {
    id: input.id,
    user_id: input.userId,
    status: 'pending' as const,
    created_at: input.createdAt,
    handled_at: null,
    handled_by: null
  };
}

export function toPasswordResetLinkRecord(input: {
  id: string;
  requestId: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
}) {
  return {
    id: input.id,
    request_id: input.requestId,
    user_id: input.userId,
    token_hash: input.tokenHash,
    expires_at: input.expiresAt,
    created_by: input.createdBy,
    created_at: input.createdAt
  };
}

export function toPasswordResetLinkUsedUpdate(usedAt: string) {
  return { used_at: usedAt };
}

export function toPasswordResetRequestHandledUpdate(input: {
  status: 'link_created' | 'completed';
  handledAt: string;
  handledBy?: string | null;
}) {
  return {
    status: input.status,
    handled_at: input.handledAt,
    ...(input.status === 'link_created' ? { handled_by: input.handledBy ?? null } : {})
  };
}

export function toUserPasswordUpdate(passwordHash: string, updatedAt: string) {
  return { password_hash: passwordHash, updated_at: updatedAt };
}

export function toAuthAccountPasswordUpdate(passwordHash: string, updatedAt: Date) {
  return { password: passwordHash, updatedAt };
}

export type PasswordResetLinkState = {
  used_at: string | null;
  expires_at: string;
  user_status: string;
  handle: string | null;
  login_id: string | null;
};

export type PasswordResetContext =
  | { valid: false }
  | { valid: true; handle: string | null; loginId: string | null; expiresAt: string };

export type PasswordResetRequestViewSource<TRequest extends object> = {
  request: TRequest;
  login_id: string | null;
  display_name: string;
  expires_at: string | null;
};

export function toPasswordResetRequestView<TRequest extends object>(
  row: PasswordResetRequestViewSource<TRequest>
) {
  return {
    ...row.request,
    login_id: row.login_id,
    display_name: row.display_name,
    expires_at: row.expires_at
  };
}

export function toPasswordResetContext(
  link: PasswordResetLinkState | null | undefined,
  currentTime: string
): PasswordResetContext {
  if (
    !link ||
    link.used_at !== null ||
    link.user_status !== 'active' ||
    link.expires_at <= currentTime
  ) {
    return { valid: false };
  }
  return {
    valid: true,
    handle: link.handle ?? link.login_id,
    loginId: link.login_id,
    expiresAt: link.expires_at
  };
}
