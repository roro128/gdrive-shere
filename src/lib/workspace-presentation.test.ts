import { describe, expect, it } from 'vitest';
import { formatWorkspaceTimestamp, getWorkspacePresentation } from './workspace-presentation';

describe('getWorkspacePresentation', () => {
  it('formats workspace timestamps with an explicit display mode', () => {
    const dateOnly = formatWorkspaceTimestamp('2026-07-29T12:34:56.000Z');
    const dateTime = formatWorkspaceTimestamp('2026-07-29T12:34:56.000Z', true);
    expect(dateOnly).toContain('2026');
    expect(dateTime).toContain('2026');
    expect(dateTime).not.toBe(dateOnly);
  });

  it('Given the private root When the workspace renders Then it explains the primary file task', () => {
    expect(
      getWorkspacePresentation({
        showShared: false,
        showRequests: false,
        trash: false,
        folderName: null
      })
    ).toEqual({
      eyebrow: '내 파일',
      title: '저장 공간',
      description: '파일을 찾고 정리하거나 새 항목을 추가하세요.'
    });
  });

  it('Given a nested folder When the workspace renders Then the folder name becomes the task title', () => {
    expect(
      getWorkspacePresentation({
        showShared: false,
        showRequests: false,
        trash: false,
        folderName: '브랜드 자료'
      })
    ).toEqual({
      eyebrow: '저장 공간',
      title: '브랜드 자료',
      description: '이 폴더의 파일을 찾고 정리하세요.'
    });
  });

  it.each([
    {
      input: { showShared: true, showRequests: false, trash: false, folderName: null },
      expected: {
        eyebrow: '함께 쓰는 파일',
        title: '공유 폴더',
        description: '나에게 공유된 폴더와 권한을 확인하세요.'
      }
    },
    {
      input: { showShared: false, showRequests: true, trash: false, folderName: null },
      expected: {
        eyebrow: '확인 필요',
        title: '공유 요청',
        description: '새로 도착한 폴더 공유 요청을 검토하세요.'
      }
    },
    {
      input: { showShared: false, showRequests: false, trash: true, folderName: null },
      expected: {
        eyebrow: '7일 보관',
        title: '휴지통',
        description: '삭제한 항목을 복구하거나 영구 삭제하세요.'
      }
    }
  ])(
    'Given a special view When it opens Then its next action is explicit',
    ({ input, expected }) => {
      expect(getWorkspacePresentation(input)).toEqual(expected);
    }
  );
});
