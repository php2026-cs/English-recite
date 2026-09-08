import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.REVIEW_TEST_URL || 'http://127.0.0.1:4179';
const output = new URL('../reports/en-zh-groups/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const checks = [];
try {
  for (const route of ['/review/en-zh', '/review/adaptive']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin + route);
    await page.getByText('当前没有待复习的单词', { exact: true }).waitFor();
    await page.evaluate(async () => {
      const { db } = await import('/src/db/db.ts');
      const now = Date.now();
      await db.words.put({ id: 'fine', word: 'fine', createdAt: now, updatedAt: now });
      await db.meanings.bulkPut([
        ['noun', 'n.', '罚款'], ['good', 'adj.', '好的'], ['verb', 'v.', '罚款'], ['small', 'adj.', '细小的']
      ].map(([id, partOfSpeech, chineseMeaning], i) => ({ id, wordId: 'fine', partOfSpeech,
        chineseMeaning, selectedForStudy: true, correctCount: 0, incorrectCount: 0,
        createdAt: now + i, updatedAt: now })));
    });
    await page.reload();
    await page.getByRole('region', { name: '名词填空' }).waitFor();
    assert.equal(await page.getByRole('region', { name: '形容词填空' }).getByRole('textbox').count(), 2);
    assert.equal(await page.getByRole('region', { name: '动词填空' }).getByRole('textbox').count(), 1);
    assert.equal(await page.getByText('参考答案：罚款', { exact: true }).count(), 0);
    assert.equal(await page.getByText('The driver was fined fifty pounds.', { exact: true }).count(), 0);
    await page.getByLabel('n. 释义 1', { exact: true }).fill('罚款');
    await page.getByLabel('adj. 释义 1', { exact: true }).fill('细小的');
    await page.getByLabel('adj. 释义 2', { exact: true }).fill('好的');
    await page.getByLabel('v. 释义 1', { exact: true }).fill('好的');
    await page.getByRole('button', { name: '查看答案', exact: true }).click();
    await page.getByText('匹配 3 / 4 个义项', { exact: true }).waitFor();
    const smallSlot = page.locator('[data-review-slot="good"]');
    await smallSlot.getByText('参考答案：细小的', { exact: true }).waitFor();
    await smallSlot.getByText('The beach is covered with fine sand.', { exact: true }).waitFor();
    await page.locator('[data-review-slot="noun"]').getByText('He paid a fine for parking here.', { exact: true }).waitFor();
    await page.locator('[data-review-slot="verb"]').getByText('The driver was fined fifty pounds.', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-review-slot="verb"]').getByRole('button', { name: '忘记', exact: true }).getAttribute('aria-pressed'), 'true');
    // Layout order is input -> answer -> mastery -> example, within the same slot.
    assert.equal(await smallSlot.evaluate((slot) => {
      const input = slot.querySelector('input');
      const feedback = slot.querySelector('[id^="en-zh-feedback"]');
      return Boolean(input.compareDocumentPosition(feedback) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        feedback.textContent.includes('掌握程度') && feedback.textContent.includes('The beach');
    }), true);
    await smallSlot.getByRole('button', { name: '熟练', exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const prefix = route.endsWith('adaptive') ? 'adaptive' : 'standard';
    await page.screenshot({ path: fileURLToPath(new URL(`${prefix}-mobile.png`, output)), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: fileURLToPath(new URL(`${prefix}-desktop.png`, output)), fullPage: true });
    await page.getByRole('button', { name: '保存并下一词', exact: true }).click();
    await page.getByText('错义项再练 1 / 2 · 本题 1 个义项', { exact: true }).waitFor();
    await page.getByRole('button', { name: '结束本轮', exact: true }).click();
    await page.getByText('已完成 1 个单词', { exact: true }).waitFor();
    const records = await page.evaluate(async () => {
      const { db } = await import('/src/db/db.ts');
      const records = await db.reviewRecords.toArray();
      await db.meaningReviewStates.toCollection().modify({ dueAt: Date.now() - 1000 });
      return records;
    });
    assert.equal(records.length, 4);
    assert.equal(records.find((row) => row.meaningId === 'small').result, 'easy');
    assert.equal(records.find((row) => row.meaningId === 'verb').result, 'again');
    assert.equal(records.find((row) => row.meaningId === 'verb').inputValue, '好的');
    // Revisit in standard mode so adaptive choice cannot hide the English → Chinese view.
    await page.goto(origin + '/review/en-zh');
    await page.getByRole('button', { name: '查看答案', exact: true }).click();
    await page.getByText('匹配 0 / 4 个义项', { exact: true }).waitFor();
    const summaries = page.locator('[data-review-slot] summary').filter({ hasText: /^例句/ });
    await summaries.first().waitFor();
    assert.equal(await summaries.count(), 4);
    assert.equal(await summaries.evaluateAll((elements) => elements.every((element) => !element.parentElement.open)), true);
    const repeatedNoun = page.locator('[data-review-slot="noun"]');
    await repeatedNoun.locator('summary').filter({ hasText: /^例句/ }).click();
    await repeatedNoun.getByText('He paid a fine for parking here.', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    checks.push({ route, passed: true, checks: ['POS headings and counts', 'no answers before reveal',
      'within-POS unordered inputs', 'cross-POS rejection', 'answer/rating/example attached to matching slot',
      'first-study bilingual example expanded', 'independent rating persistence',
      'repeat-study examples collapsed and can reopen', 'mobile and desktop layouts', 'no uncaught errors'] });
    await context.close();
  }
  const report = { passed: true, checkedAt: new Date().toISOString(), checks };
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
