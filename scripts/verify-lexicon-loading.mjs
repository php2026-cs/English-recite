import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.LEXICON_TEST_URL || 'http://127.0.0.1:4182/English-recite/';
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const errors = [];
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.locator('main').waitFor();
  assert(!requests.some(url => url.includes('localLexicon-')), 'Home must not import the full dictionary');
  await page.goto(base + '#/lexicon/cet6');
  const entries = page.locator('a[href*="/lexicon/cet6/"]');
  await entries.nth(79).waitFor();
  assert.equal(await entries.count(), 80);
  await page.getByRole('button', { name: '显示更多' }).click();
  assert.equal(await entries.count(), 160);
  await page.getByPlaceholder('搜索六级单词').fill('charge');
  await page.locator('a[href$="/lexicon/cet6/charge"]').click();
  await page.getByRole('heading', { name: 'charge', exact: true }).waitFor();
  assert(requests.some(url => url.includes('localLexicon-')));
  await page.reload();
  await page.getByRole('heading', { name: 'charge', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await context.close();

  const offlineContext = await browser.newContext();
  const offlinePage = await offlineContext.newPage();
  await offlinePage.goto(base);
  await offlinePage.evaluate(async () => { await navigator.serviceWorker.ready; });
  await offlineContext.setOffline(true);
  await offlinePage.goto(base + '#/lexicon/cet6');
  await offlinePage.locator('a[href*="/lexicon/cet6/"]').nth(79).waitFor();
  await offlineContext.close();
  const report = { passed: true, checkedAt: new Date().toISOString(), checks: [
    'Home does not import full lexicon', '80 initial entries, load more to 160',
    'Search and detail route work with hash routing and refresh',
    'Dictionary opens offline after service-worker caching', 'No uncaught browser errors'
  ] };
  await mkdir(new URL('../reports/lexicon-loading/', import.meta.url), { recursive: true });
  await writeFile(new URL('../reports/lexicon-loading/report.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
