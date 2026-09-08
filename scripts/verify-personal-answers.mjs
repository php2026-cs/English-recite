import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.REVIEW_TEST_URL || 'http://127.0.0.1:4179';
const output = new URL('../reports/personal-answers/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin + '/review/en-zh');
  await page.getByText('当前没有待复习的单词', { exact: true }).waitFor();
  await page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    await db.words.put({ id: 'charge', word: 'charge', createdAt: 1, updatedAt: 1 });
    await db.meanings.bulkPut([
      { id: 'verb', wordId: 'charge', chineseMeaning: '收费', partOfSpeech: 'v.', selectedForStudy: true,
        correctCount: 0, incorrectCount: 0, createdAt: 1, updatedAt: 1 },
      { id: 'noun', wordId: 'charge', chineseMeaning: '费用', partOfSpeech: 'n.', selectedForStudy: true,
        correctCount: 0, incorrectCount: 0, createdAt: 2, updatedAt: 1 }
    ]);
  });
  await page.reload();
  await page.getByLabel('v. 释义 1', { exact: true }).fill('收钱');
  await page.getByLabel('n. 释义 1', { exact: true }).fill('费用');
  await page.getByRole('button', { name: '查看答案', exact: true }).click();
  await page.getByText('匹配 1 / 2 个义项', { exact: true }).waitFor();
  const verb = page.locator('[data-review-slot="verb"]');
  await verb.getByRole('button', { name: '这个答案也算对', exact: true }).click();
  await page.getByText('匹配 2 / 2 个义项', { exact: true }).waitFor();
  await verb.getByText('已使用你的可接受答案', { exact: true }).waitFor();
  assert.equal(await verb.getByRole('button', { name: '记得', exact: true }).getAttribute('aria-pressed'), 'true');
  await verb.locator('mark').waitFor();
  assert.equal(await verb.locator('mark').textContent(), 'charges');
  assert.equal(await page.locator('[data-review-slot="noun"] mark').textContent(), 'charge');
  assert.equal(await verb.locator('p[lang="en"]').textContent(), 'The museum charges five pounds for admission.');
  const beforeSave = await page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    return { aliases: await db.personalMeaningAliases.count(), records: await db.reviewRecords.count() };
  });
  assert.deepEqual(beforeSave, { aliases: 1, records: 0 });
  await page.screenshot({ path: fileURLToPath(new URL('mobile.png', output)), fullPage: true, animations: 'disabled' });
  await page.reload();
  await page.getByText('已使用你的可接受答案', { exact: true }).waitFor();
  await page.getByText('匹配 2 / 2 个义项', { exact: true }).waitFor();
  await page.getByRole('button', { name: '保存并完成', exact: true }).click();
  await page.getByText('已完成 1 个单词', { exact: true }).waitFor();
  const saved = await page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    const records = await db.reviewRecords.toArray();
    await db.meaningReviewStates.toCollection().modify({ dueAt: Date.now() - 1 });
    return records;
  });
  assert.equal(saved.find((record) => record.meaningId === 'verb').result, 'good');
  assert.equal(saved.find((record) => record.meaningId === 'verb').inputValue, '收钱');
  const isolation = await page.evaluate(async () => {
    const { setCurrentOwnerUserId } = await import('/src/services/ownership/ownership.ts');
    const { personalVocabularyRepository } = await import('/src/repositories/personalVocabularyRepository.ts');
    const { db } = await import('/src/db/db.ts');
    const meaning = await db.meanings.get('verb');
    setCurrentOwnerUserId('another-user');
    const aliases = await personalVocabularyRepository.listAliases();
    let rejected = false;
    try { await personalVocabularyRepository.accept(meaning, '越权表达'); } catch { rejected = true; }
    setCurrentOwnerUserId(null);
    return { count: aliases.length, rejected };
  });
  assert.deepEqual(isolation, { count: 0, rejected: true });
  await page.reload();
  await page.getByLabel('v. 释义 1', { exact: true }).fill('收钱');
  await page.getByLabel('n. 释义 1', { exact: true }).fill('收钱');
  await page.getByRole('button', { name: '查看答案', exact: true }).click();
  await page.getByText('匹配 1 / 2 个义项', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-review-slot="noun"]').getByRole('button', { name: '忘记', exact: true }).getAttribute('aria-pressed'), 'true');
  await verb.getByRole('button', { name: '撤销这个表达', exact: true }).click();
  await page.getByText('匹配 0 / 2 个义项', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('匹配 0 / 2 个义项', { exact: true }).waitFor();
  assert.equal(await verb.getByRole('button', { name: '忘记', exact: true }).getAttribute('aria-pressed'), 'true');
  const afterUndo = await page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    return { aliases: await db.personalMeaningAliases.count(), records: await db.reviewRecords.count() };
  });
  assert.deepEqual(afterUndo, { aliases: 0, records: 2 });
  assert.deepEqual(errors, []);
  const report = { passed: true, checkedAt: new Date().toISOString(), checks: [
    'Only target charge / charges highlighted; original sentence unchanged',
    'One-click personal answer acceptance updates matching and default rating',
    'Accepted expression survives refresh and is reused on later review',
    'Saved FSRS result is good, so corrected answer does not enter retry',
    'Aliases stay inside the intended meaning/POS and account',
    'Undo restores unmatched status without changing historical review records',
    'No uncaught browser errors'
  ] };
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
