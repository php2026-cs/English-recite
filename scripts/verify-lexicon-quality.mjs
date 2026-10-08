// 验收词典数据质量修复：未识别词性不再显示英文 other、脏释义已清除、重复义项已合并。
// 用法：
//   LEXICON_TEST_URL=<预览地址> node scripts/verify-lexicon-quality.mjs
// 需要与正式构建一致的 hash 路由与子路径（VITE_BASE_PATH=/English-recite/、VITE_ROUTER_MODE=hash）。
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const root = (process.env.LEXICON_TEST_URL || 'http://127.0.0.1:4182/English-recite/').replace(/\/$/, '');
const checks = [];

async function openEntry(page, word) {
  await page.goto(`${root}/#/lexicon/cet6/${encodeURIComponent(word)}`);
  await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });
  // 完整词典是懒加载的，等真实内容出现。
  await page.getByText(word, { exact: false }).first().waitFor({ timeout: 30_000 });
  return page.locator('main, body').first();
}

try {
  await mkdir(new URL('../reports/lexicon-quality/', import.meta.url), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // able 的两个义项词性均未识别，此前界面直接显示英文 "other"。
  await openEntry(page, 'able');
  const ableText = await page.locator('body').innerText();
  assert.equal(ableText.includes('其他词性'), true, '未识别词性应显示为「其他词性」');
  assert.equal(/\bother\b/.test(ableText), false, '界面不应出现英文 other');
  assert.equal(ableText.includes('能干的'), true, '应仍显示释义');
  await page.screenshot({ path: fileURLToPath(new URL('../reports/lexicon-quality/able-mobile.png', import.meta.url)), fullPage: true });
  checks.push({ name: '未识别词性显示中文兜底名称', passed: true });

  // ounce 的第 5 个义项是乱码 "Г"，清洗后不应再出现。
  await openEntry(page, 'ounce');
  const ounceText = await page.locator('body').innerText();
  assert.equal(ounceText.includes('Г'), false, '脏释义已被清除');
  assert.equal(ounceText.includes('盎司'), true, '正确义项仍保留');
  checks.push({ name: '脏释义已清除', passed: true });

  // absorb 此前同时有 v. 吸收 与 other 吸收，清洗后整个词条不再有未识别词性。
  await openEntry(page, 'absorb');
  const absorbText = await page.locator('body').innerText();
  assert.equal(absorbText.includes('吸收'), true, '正确义项仍保留');
  assert.equal(absorbText.includes('其他词性'), false, '重复的未识别义项已删除');
  checks.push({ name: '重复义项已合并', passed: true });

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  checks.push({ name: '手机布局与无未捕获异常', passed: true });

  await context.close();
  const report = { passed: true, checkedAt: new Date().toISOString(), url: root, checks };
  await writeFile(new URL('../reports/lexicon-quality/report.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
