import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const resultMarket = (page: Page) =>
  page.getByRole('region', { name: 'Match result', exact: true });
async function ready(page: Page, route = '') {
  await page.goto(`./${route ? `#/${route}` : ''}`);
  await expect(page.locator('.connection-control')).toContainText('REPLAY CONNECTED');
  await page.evaluate(() => document.fonts.ready);
}
async function openEditor(page: Page) {
  await resultMarket(page)
    .getByRole('button', { name: /Edit Match result, Home price/ })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function fillEditor(
  page: Page,
  home = '2.71',
  reason = 'Adjusted after reviewing the replay',
) {
  await page.getByLabel('Home price', { exact: true }).fill(home);
  await page.getByLabel('Draw price', { exact: true }).fill('3.45');
  await page.getByLabel('Away price', { exact: true }).fill('4.21');
  await page.getByLabel('Reason for change').fill(reason);
}
async function apply(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}
async function book(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('ryvqen:desk:v1') ?? '{}') as {
        journal?: { reason: string; after: string; kind: string }[];
        overrides?: Record<string, { prices?: Record<string, number> | null; suspended: boolean }>;
        watchlist?: string[];
      },
  );
}

test('live prices move, pause holds the exact frame, and resume reconnects', async ({ page }) => {
  await ready(page);
  const first = await resultMarket(page).locator('.outcome-price').allTextContents();
  await expect
    .poll(() => resultMarket(page).locator('.outcome-price').allTextContents(), { timeout: 8000 })
    .not.toEqual(first);
  await page.getByRole('button', { name: 'Pause replay feed', exact: true }).click();
  await expect(page.locator('.connection-control')).toContainText('PAUSED');
  const paused = await resultMarket(page).locator('.outcome-price').allTextContents();
  await page.waitForTimeout(2200);
  expect(await resultMarket(page).locator('.outcome-price').allTextContents()).toEqual(paused);
  await expect(
    resultMarket(page).getByRole('button', { name: /Edit Match result, Home/ }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Resume replay feed', exact: true }).click();
  await expect(page.locator('.connection-control')).toContainText('REPLAY CONNECTED');
});

test('manual prices, exact journal values and reasons survive a complete reload', async ({
  page,
}) => {
  await ready(page);
  await openEditor(page);
  await fillEditor(page);
  await apply(page);
  await expect(resultMarket(page).getByText('MANUAL', { exact: true })).toBeVisible();
  await expect(resultMarket(page).getByRole('button', { name: /Home price 2.71/ })).toBeVisible();
  await page.reload();
  await expect(page.locator('.connection-control')).toContainText('REPLAY CONNECTED');
  expect((await book(page)).overrides?.['evt-001:result']?.prices?.['result-0']).toBe(271);
  await expect(resultMarket(page).getByRole('button', { name: /Home price 2.71/ })).toBeVisible();
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await expect(
    page.getByText('Adjusted after reviewing the replay', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.change-comparison')).toContainText('Home 2.71');
});

test('pause, resume and release preserve their distinct market semantics', async ({ page }) => {
  await ready(page);
  await openEditor(page);
  await fillEditor(page);
  await apply(page);
  await resultMarket(page)
    .getByRole('button', { name: 'Suspend Match result', exact: true })
    .click();
  await page.getByLabel('Reason for change').fill('Temporary local review');
  await apply(page);
  await expect(resultMarket(page).getByText('PAUSED', { exact: true })).toBeVisible();
  await expect(
    resultMarket(page).getByRole('button', { name: /Edit Match result, Home/ }),
  ).toBeDisabled();
  await resultMarket(page)
    .getByRole('button', { name: 'Resume Match result', exact: true })
    .click();
  await page.getByLabel('Reason for change').fill('Review complete, reopen');
  await apply(page);
  await expect(resultMarket(page).getByRole('button', { name: /Home price 2.71/ })).toBeEnabled();
  await resultMarket(page)
    .getByRole('button', { name: 'Return Match result to feed', exact: true })
    .click();
  await page.getByLabel('Reason for change').fill('Follow the replay again');
  await apply(page);
  await expect(resultMarket(page).getByText('FEED', { exact: true })).toBeVisible();
  expect((await book(page)).overrides?.['evt-001:result']?.prices).toBeNull();
  expect((await book(page)).journal?.map((e) => e.kind)).toEqual([
    'release',
    'resume',
    'suspend',
    'price',
  ]);
});

test('invalid prices and short reasons stay in the dialog without changing data', async ({
  page,
}) => {
  await ready(page);
  await openEditor(page);
  await fillEditor(page, '0.90', 'x');
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('between 1.01 and 1000.00');
  await page.getByLabel('Home price', { exact: true }).fill('2.50');
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('at least 4 characters');
  expect((await book(page)).journal).toBeUndefined();
  await page.getByRole('button', { name: 'Close market editor', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('a rejected request leaves no market override or invented journal entry', async ({ page }) => {
  await ready(page, 'system');
  await page.getByRole('button', { name: /Reject next change/ }).click();
  await page.getByRole('link', { name: 'Desk', exact: true }).click();
  await openEditor(page);
  await fillEditor(page);
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('rejected');
  expect((await book(page)).journal).toBeUndefined();
  await apply(page);
  expect((await book(page)).journal).toHaveLength(1);
});

test('two tabs cannot silently overwrite a market opened at the same revision', async ({
  page,
  context,
}) => {
  await ready(page);
  const other = await context.newPage();
  await ready(other);
  await openEditor(page);
  await fillEditor(page, '2.51', 'First operator decision');
  await openEditor(other);
  await fillEditor(other, '2.99', 'Stale decision from the other tab');
  await apply(page);
  await other.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(other.getByRole('dialog').getByRole('alert')).toContainText('another tab');
  expect((await book(other)).journal).toHaveLength(1);
  expect((await book(other)).overrides?.['evt-001:result']?.prices?.['result-0']).toBe(251);
  await other.close();
});

test('blocked browser storage reports failure without false success', async ({ page }) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'ryvqen:desk:v1') throw new DOMException('Full', 'QuotaExceededError');
      set.call(this, key, value);
    };
  });
  await ready(page);
  await openEditor(page);
  await fillEditor(page);
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('not applied');
  expect((await book(page)).journal).toBeUndefined();
});

test('unreadable bytes can be downloaded before a guarded workspace reset', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('corrupt-seeded')) {
      localStorage.setItem('ryvqen:desk:v1', '{unfinished-workspace');
      sessionStorage.setItem('corrupt-seeded', 'yes');
    }
  });
  await ready(page);
  await expect(page.getByRole('alert')).toContainText('could not be read');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const downloaded = await downloading;
  expect(await readFile((await downloaded.path())!, 'utf8')).toBe('{unfinished-workspace');
  await page.getByRole('button', { name: 'Reset unreadable data', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm reset', exact: true }).click();
  await expect(page.locator('.storage-banner')).not.toBeVisible();
  expect((await book(page)).watchlist).toEqual([]);
  await openEditor(page);
  await fillEditor(page);
  await apply(page);
  expect((await book(page)).journal).toHaveLength(1);
});

test('watchlists persist and the large fixture directory has a keyboard-friendly page view', async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole('button', { name: 'Add Northbridge versus AC Valora to watchlist', exact: true })
    .click();
  await page.getByRole('link', { name: 'Fixtures', exact: true }).click();
  const virtualRows = page.getByTestId('virtual-list').locator('.fixture-row');
  await expect(virtualRows.first()).toBeVisible();
  expect(await virtualRows.count()).toBeLessThan(30);
  await page.getByRole('button', { name: 'Use paginated view', exact: true }).click();
  await expect(page.getByText('Page 1 of 12', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 12', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await expect(page.locator('.paginated-list .fixture-row')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.connection-control')).toContainText('REPLAY CONNECTED');
  expect((await book(page)).watchlist).toContain('evt-001');
  await expect(page.locator('.directory-heading')).toContainText('1 MATCHING FIXTURES');
});

test('duplicate, late and gap scenarios update real counters and recover safely', async ({
  page,
}) => {
  await ready(page, 'system');
  await expect
    .poll(
      async () =>
        Number((await page.locator('.system-details').innerText()).match(/#(\d+)/)?.[1] ?? 0),
      { timeout: 10000 },
    )
    .toBeGreaterThanOrEqual(3);
  await page.getByRole('button', { name: 'Send duplicate', exact: false }).click();
  await expect(page.locator('.system-metrics>div').nth(1).locator('strong')).toHaveText('01');
  await page.getByRole('button', { name: 'Send late frame', exact: false }).click();
  await expect(page.locator('.system-metrics>div').nth(1).locator('strong')).toHaveText('02');
  await page.getByRole('button', { name: 'Create a gap', exact: false }).click();
  await expect(page.locator('.system-metrics>div').nth(3).locator('strong')).toHaveText('01');
  await expect(page.locator('.system-status')).toHaveText('CONNECTED');
});

test('the journal export contains exact saved changes and no fictional actions', async ({
  page,
}) => {
  await ready(page);
  await openEditor(page);
  await fillEditor(page, '2.71', 'Keep this exact export reason');
  await apply(page);
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export journal', exact: true }).click();
  const download = await downloading;
  const data = JSON.parse(await readFile((await download.path())!, 'utf8')) as {
    entries: { reason: string; after: string }[];
  };
  expect(data.entries).toHaveLength(1);
  expect(data.entries[0]?.reason).toBe('Keep this exact export reason');
  expect(data.entries[0]?.after).toContain('Home 2.71');
});

test('motion preference, system reduced motion and keyboard navigation remain usable', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
  await page.getByRole('button', { name: 'Resume motion', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page.locator('.ball-pulse').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  await page.keyboard.press('/');
  await expect(page.getByLabel('Search all fixtures')).toBeFocused();
  await page.getByLabel('Search all fixtures').fill('Montara');
  await expect(page.locator('.directory-heading')).toContainText('MATCHING FIXTURES');
  await page.getByRole('link', { name: 'Desk', exact: true }).click();
  await page.getByRole('link', { name: 'Skip to content', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('representative screens and the market dialog pass accessibility scans', async ({ page }) => {
  await ready(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await openEditor(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Close market editor', exact: true }).click();
  await page.getByRole('link', { name: 'Fixtures', exact: true }).click();
  await page.getByRole('button', { name: 'Use paginated view', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('all routes fit the actual viewport and capture the finished experience', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const widths = info.project.name === 'mobile-chromium' ? [320, 390] : [1440];
  for (const width of widths) {
    await page.setViewportSize({
      width,
      height: info.project.name === 'mobile-chromium' ? 850 : 1000,
    });
    for (const route of ['', 'fixtures', 'journal', 'system', 'guide']) {
      await ready(page, route);
      await expect(page.locator('main h1')).toBeVisible();
      const actual = page.viewportSize()!.width;
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${route || 'desk'} at ${width}`,
      ).toBeLessThanOrEqual(actual);
      if (route === '' || route === 'system' || route === 'fixtures')
        await page.screenshot({
          path: info.outputPath(`${route || 'desk'}-${width}.png`),
          fullPage: true,
        });
    }
  }
  await ready(page, '?invalid');
  await page.goto('./#/?event=unknown');
  await expect(
    page.getByRole('heading', { name: 'Fixture not found.', exact: true }),
  ).toBeVisible();
  await page.goto('./#/not-a-page');
  await expect(
    page.getByRole('heading', { name: 'This page is out of play.', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
