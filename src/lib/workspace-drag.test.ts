import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceSource = readFileSync(
  resolve(import.meta.dirname, 'components', 'Workspace.svelte'),
  'utf8'
);

describe('내부 파일 드래그 앤 드롭', () => {
  it('드래그 핸들이 포인터 이벤트를 받아 dragstart를 시작할 수 있다', () => {
    const dragHandleStyles =
      workspaceSource.match(/\.drag-handle\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';

    expect(dragHandleStyles).not.toMatch(/pointer-events\s*:\s*none/);
  });

  it('파일 행 전체가 포인터 내부 파일 드래그 소스다', () => {
    const rowStart = workspaceSource.indexOf('class="file-row"');
    const rowEnd = workspaceSource.indexOf('class="drag-handle"', rowStart);
    const rowMarkup = workspaceSource.slice(rowStart, rowEnd);

    expect(rowMarkup).toMatch(/data-folder-drop-id=\{isFolder\(file\) \? file\.id : undefined\}/);
    expect(rowMarkup).toMatch(/onpointerdown=\{\(event\) => beginFilePointerDrag\(event, file\)\}/);
    expect(rowMarkup).toMatch(/draggable=\{!showTrash && !file\.isAdminSpace && googleConnected\}/);
    expect(rowMarkup).toMatch(/ondragstart=\{\(event\) => startNativeFileDrag\(event, file\)\}/);
  });

  it('폴더 본문이 명시적인 내부 파일 drop target이다', () => {
    expect(workspaceSource).toMatch(/class="file-main"[\s\S]*?ondragover=\{\(event\) =>/);
    expect(workspaceSource).toMatch(/class="file-main"[\s\S]*?ondrop=\{\(event\) =>/);
  });

  it('파일 본문 클릭은 포인터 드래그 완료 뒤 실행되지 않는다', () => {
    expect(workspaceSource).toMatch(/onclick=\{\(\) => openFileFromMain\(file\)\}/);
    expect(workspaceSource).toMatch(/function consumeSuppressedFileClick/);
  });

  it('파일 행이 포인터 드래그 시작과 종료를 연결한다', () => {
    expect(workspaceSource).toMatch(/class="file-row"[\s\S]*?onpointerdown=\{\(event\) =>/);
    expect(workspaceSource).toMatch(/window\.addEventListener\('pointermove'/);
    expect(workspaceSource).toMatch(/window\.addEventListener\('pointerup'/);
    expect(workspaceSource).toMatch(/row\?\.setPointerCapture\?\.\(event\.pointerId\)/);
    expect(workspaceSource).toMatch(/releasePointerCapture\(event\.pointerId\)/);
  });

  it('폴더와 경로 버튼이 포인터 드래그 hit-test 대상이다', () => {
    expect(workspaceSource).toMatch(
      /data-folder-drop-id=\{isFolder\(file\) \? file\.id : undefined\}/
    );
    expect(workspaceSource).toMatch(/data-parent-drop-id=/);
  });

  it('포인터 캡처가 원본 폴더를 자기 자신으로 이동 대상으로 선택하지 않는다', () => {
    expect(workspaceSource).toMatch(
      /hitTarget && !filesToMove\.some\(\(file\) => file\.id === hitTarget\)/
    );
    expect(workspaceSource).toMatch(/: drag\.targetParentId/);
  });
});
