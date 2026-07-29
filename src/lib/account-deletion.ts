export const ACCOUNT_DELETION_CONFIRMATION = '계정 삭제';

export type AccountDeletionAcknowledgements = {
  files?: boolean;
  shares?: boolean;
  passkeys?: boolean;
};

export type AccountDeletionState = {
  files: boolean;
  shares: boolean;
  passkeys: boolean;
};

export type AccountDeletionAcknowledgementKey = keyof AccountDeletionState;

export function acceptsAccountDeletion(
  confirmation: string | undefined,
  acknowledged: AccountDeletionAcknowledgements | undefined
): boolean {
  return (
    confirmation?.trim() === ACCOUNT_DELETION_CONFIRMATION &&
    acknowledged?.files === true &&
    acknowledged.shares === true &&
    acknowledged.passkeys === true
  );
}

export function toAccountDeletionRequest(input: {
  confirmation: string;
  acknowledged: AccountDeletionState;
}) {
  return {
    confirmation: input.confirmation,
    acknowledged: { ...input.acknowledged }
  };
}

export function updateAccountDeletionAcknowledgement(
  acknowledged: AccountDeletionState,
  key: AccountDeletionAcknowledgementKey,
  value: boolean
): AccountDeletionState {
  return { ...acknowledged, [key]: value };
}

export const accountDeletionScope = [
  '내가 소유한 파일과 폴더를 Google Drive와 메타데이터에서 삭제',
  '내가 만든 공유와 내가 받은 공유 폴더 접근을 해제',
  '등록한 패스키, 로그인 세션, 계정 정보를 삭제'
] as const;
