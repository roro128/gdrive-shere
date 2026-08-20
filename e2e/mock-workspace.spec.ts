import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixtureDirectory = resolve(process.cwd(), '.e2e-fixture');
const fixtureFiles = new Map([
  ['/', ['text/html', readFileSync(resolve(fixtureDirectory, 'mock-workspace.html'), 'utf8')]],
  [
    '/mock-workspace.css',
    ['text/css', readFileSync(resolve(fixtureDirectory, 'mock-workspace.css'), 'utf8')]
  ],
  [
    '/mock-workspace.js',
    ['text/javascript', readFileSync(resolve(fixtureDirectory, 'mock-workspace.js'), 'utf8')]
  ]
]);

const fixtureUrl = (query: string) => `http://127.0.0.1:4192/?${query}`;

async function installMockFixture(page: Page) {
  await page.route('**/*', (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== 'http://127.0.0.1:4192') return route.abort('blockedbyclient');
    const asset = fixtureFiles.get(requestUrl.pathname);
    if (!asset) return route.fulfill({ status: 404, body: 'Not Found' });
    return route.fulfill({ status: 200, contentType: asset[0], body: asset[1] });
  });
}

async function openMockWorkspace(page: Page, query = 'mock=1&mockReset=1') {
  await page.goto(fixtureUrl(query), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('navigation', { name: '작업공간 메뉴' })).toBeVisible({
    timeout: 15_000
  });
  await expect(page.getByRole('heading', { name: '저장 공간' })).toBeVisible({ timeout: 15_000 });
}

function fileRow(page: Page, name: string) {
  return page.getByRole('group', { name, exact: true });
}

test.describe('mock workspace', () => {
  test.beforeEach(async ({ page }) => {
    await installMockFixture(page);
    await openMockWorkspace(page);
  });

  test('uploads a real browser file, previews it, and skips a duplicate', async ({ page }) => {
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({
      name: 'local-smoke.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('local mock upload')
    });

    const uploaded = fileRow(page, 'local-smoke.txt');
    await expect(uploaded).toBeVisible();
    await uploaded.getByRole('button', { name: 'local-smoke.txt 미리보기' }).click();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'local-smoke.txt' })
    ).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click();

    await input.setInputFiles({
      name: 'local-smoke.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('duplicate upload')
    });
    const conflict = page.getByRole('dialog', { name: '같은 이름의 파일' });
    await expect(conflict).toBeVisible();
    await conflict.getByRole('button', { name: '건너뛰기' }).click();
    await expect(conflict).toBeHidden();
    await expect(page.getByRole('group', { name: 'local-smoke.txt', exact: true })).toHaveCount(1);
  });

  test('creates, renames, and rejects a duplicate folder', async ({ page }) => {
    await page.getByRole('button', { name: '새 폴더' }).click();
    const createDialog = page.getByRole('dialog', { name: '새 폴더' });
    await createDialog.getByPlaceholder('예: 프로젝트 자료').fill('로컬 테스트 폴더');
    await createDialog.getByRole('button', { name: '폴더 만들기' }).click();

    const folder = page.getByRole('group', { name: '로컬 테스트 폴더 폴더, 이동 대상' });
    await expect(folder).toBeVisible();
    await folder.getByRole('button', { name: '로컬 테스트 폴더 폴더 열기' }).click();
    await expect(page.getByRole('heading', { name: '로컬 테스트 폴더' })).toBeVisible();

    const root = page.getByRole('navigation', { name: '폴더 경로' });
    await root.getByRole('button', { name: '저장 공간' }).click();
    const rootFolder = page.getByRole('group', { name: '로컬 테스트 폴더 폴더, 이동 대상' });
    await rootFolder.getByRole('button', { name: '이름 변경' }).click();
    const renameDialog = page.getByRole('dialog', { name: '이름 변경' });
    await renameDialog.getByRole('textbox', { name: '새 이름' }).fill('로컬 테스트 폴더 변경');
    await renameDialog.getByRole('button', { name: '저장' }).click();
    await expect(
      page.getByRole('group', { name: '로컬 테스트 폴더 변경 폴더, 이동 대상' })
    ).toBeVisible();

    await page.getByRole('button', { name: '새 폴더' }).click();
    const duplicateDialog = page.getByRole('dialog', { name: '새 폴더' });
    await duplicateDialog.getByPlaceholder('예: 프로젝트 자료').fill('로컬 테스트 폴더 변경');
    await duplicateDialog.getByRole('button', { name: '폴더 만들기' }).click();
    await expect(duplicateDialog).toContainText('같은 이름의 항목이 이미 있습니다.');
  });

  test('keeps the shell usable on mobile and closes the folder dialog with Escape', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMockWorkspace(page);

    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        )
      )
      .toBeTruthy();

    await page.getByRole('button', { name: '새 폴더' }).click();
    const dialog = page.getByRole('dialog', { name: '새 폴더' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('navigates folders and restores a trashed file', async ({ page }) => {
    await page.getByRole('button', { name: '하위 폴더 A 폴더 열기' }).click();
    await expect(page.getByRole('heading', { name: '하위 폴더 A' })).toBeVisible();
    await expect(fileRow(page, '하위 폴더 파일.mp4')).toBeVisible();

    await page
      .getByRole('navigation', { name: '폴더 경로' })
      .getByRole('button', { name: '저장 공간' })
      .click();
    const rootFile = fileRow(page, '업로드 완료 파일.mp4');
    page.once('dialog', (dialog) => dialog.accept());
    await rootFile.getByRole('button', { name: '삭제' }).click();
    await expect(rootFile).toBeHidden();
    await page.getByRole('button', { name: '휴지통' }).click();
    const trashed = fileRow(page, '업로드 완료 파일.mp4');
    await expect(trashed).toBeVisible();
    await trashed.getByRole('button', { name: '복구' }).click();
    await expect(trashed).toBeHidden();
  });

  test('keeps viewer mode read-only', async ({ page }) => {
    await openMockWorkspace(page, 'mock=1&mockReset=1&mockAccess=viewer');

    await expect(page.locator('label.upload-button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '새 폴더' })).toHaveCount(0);
    await expect(
      fileRow(page, '업로드 완료 파일.mp4').getByRole('button', { name: '삭제' })
    ).toHaveCount(0);
    await expect(
      fileRow(page, '업로드 완료 파일.mp4').getByRole('button', { name: '다운로드' })
    ).toBeVisible();
  });

  test('opens the admin invite dialog in admin mock mode', async ({ page }) => {
    await openMockWorkspace(page, 'mock=1&mockReset=1&mockRole=admin');
    await page.getByRole('button', { name: '멤버 초대' }).click();
    await expect(page.getByRole('dialog')).toContainText('같이 쓸 사람을 초대하세요.');
  });
});
