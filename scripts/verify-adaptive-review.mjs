// Run against the Vite development server in a fresh browser context.
// PLAYWRIGHT_MODULE may point to a bundled playwright package if not installed locally.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.REVIEW_TEST_URL || 'http://127.0.0.1:4179';
const output = new URL('../reports/adaptive-review/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
async function visible(text) { await page.getByText(text, { exact: true }).waitFor(); }
async function snapshot() {
  return page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    return { records: await db.reviewRecords.toArray(), states: await db.meaningReviewStates.toArray(),
      profiles: await db.performanceProfiles.toArray(), meta: await db.syncMeta.toArray(), sessions: await db.reviewSessions.toArray(), runs: await db.activeReviewRuns.toArray() };
  });
}
try {
  await page.goto(origin + '/review/adaptive');
  await visible('当前没有待复习的单词');
  await page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    const now = Date.now();
    const words = ['charge', 'adapt'].map((word, i) => ({ id: `w${i}`, word,
      createdAt: now + i, updatedAt: now, localOwnerUserId: null }));
    const meanings = [
      ['fee', 'w0', '收费'], ['power', 'w0', '充电'], ['accuse', 'w0', '指控'],
      ['future', 'w0', '冲锋'], ['disabled', 'w0', '委托'], ['adapt', 'w1', '适应']
    ].map(([id, wordId, chineseMeaning], i) => ({ id, wordId, chineseMeaning, partOfSpeech: 'v.',
      selectedForStudy: id !== 'disabled', correctCount: 0, incorrectCount: 0,
      createdAt: now + i, updatedAt: now, localOwnerUserId: null }));
    await db.words.bulkPut(words);
    await db.meanings.bulkPut(meanings);
    await db.meaningReviewStates.bulkPut(['fee', 'power', 'future'].map((meaningId) => ({
      meaningId, state: 'review', dueAt: meaningId === 'future' ? now + 86400000 : now - 60000,
      lastReviewAt: now - 86400000, reps: 2, lapses: 0, stability: 3, difficulty: 5,
      createdAt: now - 86400000, updatedAt: now, localOwnerUserId: null
    })));
    await db.performanceProfiles.put({ meaningId: 'adapt', recognitionScore: 0.8, recallScore: 0.8,
      spellingScore: 0.1, contextScore: 0.8, correctCount: 8, incorrectCount: 0, updatedAt: now });
  });
  await page.reload();
  await visible('第 1 / 2 个单词 · 本题 3 个义项');
  assert.equal(await page.getByRole('textbox').count(), 3);
  const before = await snapshot();
  await page.getByLabel('v. 释义 1', { exact: true }).fill('指控');
  await page.getByLabel('v. 释义 2', { exact: true }).fill('索价');
  await page.getByRole('button', { name: '查看答案', exact: true }).click();
  await visible('匹配 2 / 3 个义项');
  await page.getByRole('group', { name: '收费掌握程度', exact: true }).getByRole('button', { name: '熟练', exact: true }).click();
  await page.locator('[data-review-slot="power"]').getByText('信心反馈（选填）', { exact: true }).click();
  await page.locator('[data-review-slot="power"]').getByRole('button', { name: '😎 很确定', exact: true }).click();
  await page.locator('[data-review-slot="accuse"]').getByText('信心反馈（选填）', { exact: true }).click();
  await page.locator('[data-review-slot="accuse"]').getByRole('button', { name: '😵 不太会', exact: true }).click();
  // Out-of-order matches carry the corresponding example with their answer.
  await page.locator('[data-review-slot="fee"]').getByText('The police charged him with theft.', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-review-slot="power"] details').last().getAttribute('open'), null);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: fileURLToPath(new URL('mobile-feedback.png', output)), fullPage: true });

  // Inject a one-time failure on the SECOND record to exercise actual IndexedDB rollback.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    let calls = 0;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'reviewRecords' && ++calls === 2) {
        IDBObjectStore.prototype.add = original;
        throw new Error('Simulated save failure');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '保存并下一词', exact: true }).click();
  await page.getByRole('alert').waitFor();
  const failed = await snapshot();
  assert.deepEqual(failed, before, 'Failed batch must roll back records, states, profiles and dirty flags');
  await visible('第 1 / 2 个单词 · 本题 3 个义项');
  await page.getByRole('button', { name: '重试保存', exact: true }).click();
  await visible('第 2 / 2 个单词 · 本题 1 个义项');
  await visible('拼写');
  const saved = await snapshot();
  assert.equal(saved.records.length, 3);
  assert.equal(saved.sessions.length, 1);
  assert.deepEqual(saved.records.map((item) => [item.meaningId, item.result]).sort(),
    [['accuse', 'good'], ['fee', 'easy'], ['power', 'again']]);
  assert(saved.records.every((item) => item.mode === 'en-to-zh' && item.questionType === 'en-to-zh' && item.responseTimeMs > 0));
  assert.equal(saved.records.find((item) => item.meaningId === 'fee').confidence, 3);
  assert.equal(saved.records.find((item) => item.meaningId === 'power').confidence, 0);
  assert.deepEqual(saved.states.find((item) => item.meaningId === 'future'), before.states.find((item) => item.meaningId === 'future'));
  assert.equal(saved.states.some((item) => item.meaningId === 'disabled'), false);
  assert.equal(saved.meta.filter((item) => item.syncStatus === 'dirty').length, 6);
  assert.notEqual(saved.states.find((item) => item.meaningId === 'fee').dueAt, saved.states.find((item) => item.meaningId === 'power').dueAt);

  await page.getByLabel('请输入英文单词', { exact: true }).fill(' ADAPT ');
  await page.getByRole('button', { name: '提交答案', exact: true }).click();
  await visible('正确答案：adapt');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: fileURLToPath(new URL('desktop-feedback.png', output)), fullPage: true });
  // Dispatch two clicks in the same event loop: only one transaction should be committed.
  await page.getByRole('button', { name: '保存并下一词', exact: true }).evaluate((button) => { button.click(); button.click(); });
  await page.getByText('错义项再练 1 / 2 · 本题 1 个义项', { exact: true }).waitFor();
  await page.getByRole('button', { name: '结束本轮', exact: true }).click();
  await visible('已完成 2 个单词');
  await page.reload();
  await visible('当前没有待复习的单词');
  const final = await snapshot();
  assert.equal(final.records.length, 4);
  assert.equal(final.records.find((item) => item.meaningId === 'adapt').questionType, 'spelling');
  assert.equal(final.records.find((item) => item.meaningId === 'adapt').mode, 'zh-to-en');
  assert.deepEqual(final.states.find((item) => item.meaningId === 'future'), before.states.find((item) => item.meaningId === 'future'));

  // A context-only weakness falls back to Chinese → English. Explicit blank reveal is supported.
  await page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    await db.meaningReviewStates.update('adapt', { dueAt: Date.now() - 1000 });
    await db.performanceProfiles.update('adapt', { spellingScore: 0.8, contextScore: 0.1 });
  });
  await page.reload();
  await visible('中译英');
  await page.getByRole('button', { name: '想不起来，查看答案', exact: true }).click();
  await visible('匹配 0 / 1 个义项');
  await visible('正确答案：adapt');
  await page.getByRole('button', { name: '保存并下一词', exact: true }).click();
  await page.getByText('错义项再练 1 / 2 · 本题 1 个义项', { exact: true }).waitFor();
  await page.getByRole('button', { name: '结束本轮', exact: true }).click();
  await visible('已完成 1 个单词');
  const fallback = await snapshot();
  assert.equal(fallback.records.length, 5);
  assert.equal(fallback.records.filter((item) => item.meaningId === 'adapt' && item.result === 'again')[0].questionType, 'zh-to-en');
  assert.deepEqual(errors, []);
  const report = { passed: true, checkedAt: new Date().toISOString(), checks: [
    'word grouping with due/new/future/unselected senses', 'unordered aliases and partial recall',
    'per-sense ratings, confidence, FSRS due dates and dirty flags', 'atomic rollback and retry without duplicates',
    'spelling mode and context fallback', 'explicit blank reveal', 'same-tick duplicate save protection',
    'refresh persistence and empty state', '390px layout without horizontal overflow', 'no uncaught browser errors'
  ], recordCount: fallback.records.length, errors };
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
