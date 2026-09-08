import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.REVIEW_TEST_URL || 'http://127.0.0.1:4179';
const output = new URL('../reports/review-resume/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const checks = [];
async function seed(page, count = 5) {
  await page.evaluate(async (count) => {
    const { db } = await import('/src/db/db.ts');
    const now = Date.now();
    const vocabulary = ['charge', 'adapt', 'run', 'fine', 'spring'];
    await db.words.bulkPut(vocabulary.slice(0, count).map((word, i) => ({ id: `w${i}`, word, createdAt: now + i, updatedAt: now })));
    await db.meanings.bulkPut(vocabulary.slice(0, count).flatMap((_, i) => [
      { id: `m${i}a`, wordId: `w${i}`, chineseMeaning: '意思甲', partOfSpeech: 'v.', selectedForStudy: true,
        correctCount: 0, incorrectCount: 0, createdAt: now + i * 10, updatedAt: now },
      { id: `m${i}b`, wordId: `w${i}`, chineseMeaning: '意思乙', partOfSpeech: 'n.', selectedForStudy: true,
        correctCount: 0, incorrectCount: 0, createdAt: now + i * 10 + 1, updatedAt: now }
    ]));
  }, count);
  await page.reload();
}
async function reveal(page) {
  await page.getByRole('button', { name: /^(查看答案|想不起来，查看答案)$/ }).click();
}
async function save(page) {
  await page.getByRole('button', { name: /^保存并(完成|下一词)$/ }).click();
}
async function records(page) {
  return page.evaluate(async () => (await import('/src/db/db.ts')).db.reviewRecords.toArray());
}
try {
  for (const mode of ['en-zh', 'zh-en', 'adaptive']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin + '/review/' + mode);
    await page.getByText('当前没有待复习的单词', { exact: true }).waitFor();
    await seed(page);
    await page.getByText('第 1 / 5 个单词 · 本题 2 个义项', { exact: true }).waitFor();
    const first = page.getByRole('textbox').first();
    await first.fill(mode === 'zh-en' ? 'char' : '还没填完');
    await page.reload();
    await page.getByText('已恢复上次进度', { exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox').first().inputValue(), mode === 'zh-en' ? 'char' : '还没填完');
    await page.getByRole('link', { name: '暂存退出', exact: true }).click();
    await page.getByText('继续上次复习 · 已保留答案和进度', { exact: true }).waitFor();
    await page.goto(origin + '/review/' + mode);
    await reveal(page);
    // First sense is remembered; only second sense should reappear.
    const ratingGroups = mode === 'zh-en' ? page.getByRole('group', { name: /义项 \d+ 评分/ })
      : page.getByRole('group', { name: /掌握程度$/ });
    await ratingGroups.first().getByRole('button', { name: '记得', exact: true }).click();
    await page.reload();
    await page.getByText('已恢复上次进度', { exact: true }).waitFor();
    const restoredGroups = mode === 'zh-en' ? page.getByRole('group', { name: /义项 \d+ 评分/ })
      : page.getByRole('group', { name: /掌握程度$/ });
    await restoredGroups.first().waitFor();
    assert.equal(await restoredGroups.first().getByRole('button', { name: '记得', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal((await records(page)).length, 0);
    // Open a second tab before committing. Its later save must be idempotent.
    const staleTab = await context.newPage();
    await staleTab.goto(origin + '/review/' + mode);
    await staleTab.getByRole('button', { name: /^保存并(完成|下一词)$/ }).waitFor();
    await save(page);
    await page.getByText('第 2 / 5 个单词 · 本题 2 个义项', { exact: true }).waitFor();
    await save(staleTab);
    await staleTab.getByText('第 2 / 5 个单词 · 本题 2 个义项', { exact: true }).waitFor();
    assert.equal((await records(page)).length, 2);
    await staleTab.close();
    // Three other words intervene. Use manual grades so every mode follows the same queue.
    for (let number = 2; number <= 4; number++) {
      await page.getByText(`第 ${number} / 5 个单词 · 本题 2 个义项`, { exact: true }).waitFor();
      await reveal(page);
      const gradeButtons = page.getByRole('button', { name: '记得', exact: true });
      for (const button of await gradeButtons.all()) await button.click();
      await save(page);
    }
    await page.getByText('错义项再练 1 / 2 · 本题 1 个义项', { exact: true }).waitFor();
    const run = await page.evaluate(async (mode) => (await import('/src/db/db.ts')).db.activeReviewRuns.get(JSON.stringify([null, mode])), mode);
    assert.equal(run.queue[run.index].word.word, 'charge');
    assert.deepEqual(run.queue[run.index].meanings.map((meaning) => meaning.id), ['m0b']);
    await page.screenshot({ path: fileURLToPath(new URL(`${mode}-retry.png`, output)), fullPage: true, animations: 'disabled' });
    await reveal(page);
    await page.getByRole('button', { name: '记得', exact: true }).click();
    await save(page);
    await page.getByText('第 5 / 5 个单词 · 本题 2 个义项', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('第 5 / 5 个单词 · 本题 2 个义项', { exact: true }).waitFor();
    assert.equal((await records(page)).length, 9);
    await reveal(page);
    for (const button of await page.getByRole('button', { name: '记得', exact: true }).all()) await button.click();
    await save(page);
    await page.getByText('已完成 5 个单词', { exact: true }).waitFor();
    await page.getByText('复习 10 个义项 · 完成 1 次再练', { exact: true }).waitFor();
    assert.equal((await records(page)).length, 11);
    const state = await page.evaluate(async () => (await import('/src/db/db.ts')).db.meaningReviewStates.get('m0a'));
    assert.equal(state.reps, 1, 'Already remembered sense must not be rescheduled by retry');
    assert.deepEqual(errors, []);
    checks.push(`${mode}: input + revealed grades survive refresh; pause/continue; 3-word gap; only forgotten sense retried; stale-tab save is idempotent; final counts`);
    await context.close();
  }

  // Exhaust retry limit, early finish, and sanitize content removed between sessions.
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(origin + '/review/en-zh');
  await page.getByText('当前没有待复习的单词', { exact: true }).waitFor();
  await seed(page, 1);
  for (let i = 0; i < 3; i++) {
    await reveal(page);
    await save(page);
    if (i < 2) await page.getByText(`错义项再练 ${i + 1} / 2 · 本题 2 个义项`, { exact: true }).waitFor();
  }
  await page.getByText('已完成 1 个单词', { exact: true }).waitFor();
  assert.equal((await records(page)).length, 6);
  await page.getByText('复习 2 个义项 · 完成 2 次再练', { exact: true }).waitFor();
  await page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    await db.meaningReviewStates.toCollection().modify({ dueAt: Date.now() - 1 });
  });
  await page.reload();
  await page.getByRole('textbox').first().fill('保留输入');
  await page.getByRole('link', { name: '暂存退出', exact: true }).click();
  await page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    await db.meanings.update('m0b', { selectedForStudy: false });
  });
  await page.goto(origin + '/review/en-zh');
  await page.getByText('第 1 / 1 个单词 · 本题 1 个义项', { exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox').count(), 1);
  assert.equal(await page.getByRole('textbox').inputValue(), '', 'Changed question discards stale slot draft');
  const beforeEnd = (await records(page)).length;
  await page.getByRole('button', { name: '结束本轮', exact: true }).click();
  await page.getByText('已完成 0 个单词', { exact: true }).waitFor();
  assert.equal((await records(page)).length, beforeEnd);
  // Repository keys isolate accounts without requiring real credentials or network calls.
  const isolation = await page.evaluate(async () => {
    const { setCurrentOwnerUserId } = await import('/src/services/ownership/ownership.ts');
    const { loadReviewRun } = await import('/src/services/srs/reviewRunRepository.ts');
    setCurrentOwnerUserId('test-user-b');
    const { run } = await loadReviewRun('en-zh');
    setCurrentOwnerUserId(null);
    return { owner: run.localOwnerUserId, tasks: run.queue.length };
  });
  assert.deepEqual(isolation, { owner: 'test-user-b', tasks: 0 });
  checks.push('Two-retry cap, manual finish without new review records, deselected meaning pruned on resume, per-account queue isolation');
  await context.close();
  const migrationContext = await browser.newContext({ serviceWorkers: 'block' });
  const migrationPage = await migrationContext.newPage();
  await migrationPage.route('**/migration-fixture', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated migration fixture</title>' }));
  await migrationPage.goto(origin + '/migration-fixture');
  const migrated = await migrationPage.evaluate(async () => {
    const { default: Dexie } = await import('/node_modules/dexie/dist/dexie.mjs');
    const old = new Dexie('lightwords');
    old.version(6).stores({
      words: 'id, word, createdAt, updatedAt, localOwnerUserId',
      meanings: 'id, wordId, selectedForStudy, createdAt, updatedAt, localOwnerUserId',
      reviewRecords: 'id, wordId, meaningId, mode, reviewedAt, localOwnerUserId',
      reviewSessions: 'id, wordId, createdAt, localOwnerUserId',
      meaningReviewStates: 'meaningId, dueAt, state, localOwnerUserId',
      syncMeta: 'entityKey, syncStatus, updatedAt, localOwnerUserId',
      dictionaryCache: 'normalizedWord, updatedAt', settings: 'id',
      performanceProfiles: 'meaningId, updatedAt', meaningDifficulties: 'meaningId, updatedAt',
      confusionPairs: 'id, &[wordAId+wordBId], wordAId, wordBId, updatedAt'
    });
    await old.open();
    await old.table('words').put({ id: 'legacy', word: 'charge', createdAt: 1, updatedAt: 1 });
    await old.table('reviewRecords').put({ id: 'old-record', wordId: 'legacy', meaningId: 'old-meaning', mode: 'en-to-zh', correct: true, reviewedAt: 2 });
    old.close();
    const { db } = await import('/src/db/db.ts');
    await db.open();
    return { version: db.verno, word: (await db.words.get('legacy')).word,
      records: await db.reviewRecords.count(), runs: await db.activeReviewRuns.count() };
  });
  assert.deepEqual(migrated, { version: 8, word: 'charge', records: 1, runs: 0 });
  checks.push('Real IndexedDB v6 → v8 upgrade preserves existing vocabulary and review records');
  await migrationContext.close();
  const report = { passed: true, checkedAt: new Date().toISOString(), checks };
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
