type WorkspacePresentationInput = {
  showShared: boolean;
  showRequests: boolean;
  trash: boolean;
  folderName: string | null;
};

export function formatWorkspaceTimestamp(value: string, includeTime = false): string {
  const date = new Date(value);
  return includeTime ? date.toLocaleString('ko-KR') : date.toLocaleDateString('ko-KR');
}

export function getWorkspacePresentation(input: WorkspacePresentationInput) {
  if (input.trash) {
    return {
      eyebrow: '7일 보관',
      title: '휴지통',
      description: '삭제한 항목을 복구하거나 영구 삭제하세요.'
    };
  }

  if (input.showRequests) {
    return {
      eyebrow: '확인 필요',
      title: '공유 요청',
      description: '새로 도착한 폴더 공유 요청을 검토하세요.'
    };
  }

  if (input.showShared) {
    return {
      eyebrow: '함께 쓰는 파일',
      title: '공유 폴더',
      description: '나에게 공유된 폴더와 권한을 확인하세요.'
    };
  }

  if (input.folderName) {
    return {
      eyebrow: '저장 공간',
      title: input.folderName,
      description: '이 폴더의 파일을 찾고 정리하세요.'
    };
  }

  return {
    eyebrow: '내 파일',
    title: '저장 공간',
    description: '파일을 찾고 정리하거나 새 항목을 추가하세요.'
  };
}
