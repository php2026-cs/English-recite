// 验收云同步的数据安全修复：登录用户的复习写入必须进入待同步队列，
// 删除必须清理云端且不被拉取复活，拉取不能抹掉本地专有字段。
// 用法：
//   npm run dev -- --host 127.0.0.1 --port 4181 --strictPort
//   node scripts/verify-sync-safety.mjs
// 可用 REVIEW_TEST_URL 更换地址，用 PLAYWRIGHT_MODULE 指向已有的 Playwright ESM 包。
// 脚本用假的 Supabase 客户端驱动真实的 SyncEngine，不产生任何网络请求。
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const root = process.env.REVIEW_TEST_URL || 'http://127.0.0.1:4181';
const USER = 'user-1';
const checks = [];

try {
  await mkdir(new URL('../reports/sync-safety/', import.meta.url), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1024, height: 800 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(root);

  // 在页面里注入一个记录调用的假 Supabase 客户端。
  await page.addScriptTag({
    content: `
      window.__syncStub = (function () {
        const calls = [];
        let rows = {};
        function builder(table, store) {
          const state = { table, op: null, payload: null, filters: [], orders: [], range: null };
          const api = {
            upsert(payload) { state.op = 'upsert'; state.payload = payload; store.calls.push(state); return Promise.resolve({ error: null }); },
            delete() { state.op = 'delete'; return api; },
            select() { state.op = 'select'; return api; },
            eq(column, value) { state.filters.push([column, value]); return api; },
            order(column) { state.orders.push(column); return api; },
            range(from, to) {
              state.range = [from, to];
              store.calls.push(state);
              const all = store.rows[table] || [];
              const slice = all.slice(from, to + 1);
              const empty = slice.length === 0 && from >= all.length;
              // 只有落在数据范围内的页才返回，超出后返回空页结束分页。
              return Promise.resolve({ data: empty ? [] : slice, error: null });
            },
            then(resolve, reject) { store.calls.push(state); return Promise.resolve({ error: null }).then(resolve, reject); }
          };
          return api;
        }
        return {
          calls,
          rows,
          reset() { calls.length = 0; },
          setRows(next) { rows = next; },
          from(table) { return builder(table, { calls, rows }); }
        };
      })();
    `
  });

  // ---- 1. 登录用户的复习结果必须进入待同步队列 ----
  const dirty = await page.evaluate(async ({ user }) => {
    const { db } = await import('/src/db/db.ts');
    const { setCurrentOwnerUserId } = await import('/src/services/ownership/ownership.ts');
    const { submitAdaptiveWordReview } = await import('/src/services/srs/srsReviewService.ts');
    const { syncMetaRepository } = await import('/src/services/sync/syncMetaRepository.ts');
    setCurrentOwnerUserId(user);
    await db.words.put({ id: 'w1', word: 'charge', localOwnerUserId: user, createdAt: 1, updatedAt: 1 });
    const meaning = { id: 'm1', wordId: 'w1', localOwnerUserId: user, partOfSpeech: 'v.',
      chineseMeaning: '收费', selectedForStudy: true, correctCount: 0, incorrectCount: 0, createdAt: 1, updatedAt: 1 };
    await db.meanings.put(meaning);
    await submitAdaptiveWordReview({
      word: await db.words.get('w1'), questionType: 'en-to-zh', responseTimeMs: 3000, hintUsed: false,
      results: [{ meaning, rating: 'good', confidence: 2, inputValue: '收费' }]
    });
    const dirtyRows = await syncMetaRepository.listDirty();
    const record = (await db.reviewRecords.toArray())[0];
    const storedMeaning = await db.meanings.get('m1');
    return {
      keys: dirtyRows.sort((a, b) => a.entityKey.localeCompare(b.entityKey)).map((row) => row.entityKey),
      owners: [...new Set(dirtyRows.map((row) => row.localOwnerUserId))],
      hintUsed: record.hintUsed,
      confidence: record.confidence,
      inputValue: record.inputValue,
      meaningUpdatedAt: storedMeaning.updatedAt,
      meaningCorrect: storedMeaning.correctCount
    };
  }, { user: USER });

  const reviewKeys = dirty.keys.filter((key) => key.startsWith('review:'));
  assert.equal(dirty.keys.length, 3, `复习写入应产生三条待同步记录，实际 ${JSON.stringify(dirty.keys)}`);
  assert.deepEqual(dirty.keys.filter((key) => !key.startsWith('review:')).sort(), ['meaning:m1', 'review-state:m1']);
  assert.equal(reviewKeys.length, 1, '复习记录必须进入待同步队列');
  assert.deepEqual(dirty.owners, [USER], '待同步记录必须带当前账号，否则同步永远看不到它们');
  assert.equal(dirty.meaningUpdatedAt > 1, true, '复习后应更新义项 updatedAt');
  assert.equal(dirty.meaningCorrect, 1);
  checks.push({ name: '登录复习写入带账号并进入待同步队列', passed: true, keys: dirty.keys });

  // ---- 2. 推送必须真正发送复习状态，并删除已墓碑化的行 ----
  const pushed = await page.evaluate(async ({ user }) => {
    const { SyncEngine } = await import('/src/services/sync/syncEngine.ts');
    const { db } = await import('/src/db/db.ts');
    const { wordRepository } = await import('/src/repositories/wordRepository.ts');
    const { syncMetaRepository } = await import('/src/services/sync/syncMetaRepository.ts');
    const stub = window.__syncStub;
    stub.reset();
    const engine = new SyncEngine(stub);
    await engine.push(user);
    const upserted = stub.calls.filter((call) => call.op === 'upsert').map((call) => call.table).sort();
    // 删除一个词：级联的义项与复习记录都要产生墓碑。
    const records = await db.reviewRecords.toArray();
    const removedReviewKeys = records.map((record) => `review:${record.id}`);
    await wordRepository.remove('w1');
    const tombstones = (await syncMetaRepository.listDirty()).map((row) => row.entityKey).sort();
    stub.reset();
    await engine.push(user);
    const deleted = stub.calls.filter((call) => call.op === 'delete')
      .map((call) => call.table)
      .sort();
    const remaining = (await syncMetaRepository.listDirty()).length;
    return { upserted, tombstones, deleted, remaining, recordCount: records.length, removedReviewKeys };
  }, { user: USER });

  assert.equal(pushed.upserted.includes('meaning_review_states'), true, '复习状态必须被推送（此前的缺陷）');
  assert.equal(pushed.upserted.includes('review_records'), true, '复习记录必须被推送（此前的缺陷）');
  assert.equal(pushed.upserted.includes('user_meanings'), true, '义项计数变更必须被推送');
  assert.equal(pushed.recordCount, 1);
  assert.deepEqual(pushed.tombstones, ['meaning:m1', ...pushed.removedReviewKeys, 'word:w1'].sort(),
    `删除单词应产生级联墓碑，实际 ${JSON.stringify(pushed.tombstones)}`);
  assert.deepEqual(pushed.deleted, ['review_records', 'user_meanings', 'user_words']);
  assert.equal(pushed.remaining, 0, '推送完成后不应残留待同步标记');
  checks.push({ name: '推送发送复习数据并删除墓碑行', passed: true, deleted: pushed.deleted });

  // ---- 3. 拉取不能抹掉本地专有字段，且要分页 ----
  const pulled = await page.evaluate(async ({ user }) => {
    const { SyncEngine } = await import('/src/services/sync/syncEngine.ts');
    const { db } = await import('/src/db/db.ts');
    const { setCurrentOwnerUserId } = await import('/src/services/ownership/ownership.ts');
    setCurrentOwnerUserId(user);
    const stub = window.__syncStub;
    // 远端 review_records 只有云端列；本地记录还有专有字段。
    stub.setRows({
      user_words: [], user_meanings: [], meaning_review_states: [],
      review_records: [{ id: 'r-remote', word_id: 'w1', meaning_id: 'm1', mode: 'en-to-zh',
        result: 'good', correct: true, reviewed_at: new Date(1000).toISOString(),
        previous_due_at: null, next_due_at: new Date(2000).toISOString(), response_time_ms: null,
        created_at: new Date(1000).toISOString() }]
    });
    await db.reviewRecords.clear();
    await db.reviewRecords.put({ id: 'r-remote', wordId: 'w1', meaningId: 'm1', mode: 'en-to-zh',
      correct: true, result: 'good', questionType: 'en-to-zh', errorType: 'wrong_meaning',
      confidence: 3, inputValue: '收费', hintUsed: true, reviewedAt: 1000, localOwnerUserId: user });
    const engine = new SyncEngine(stub);
    await engine.pull(user);
    const record = await db.reviewRecords.get('r-remote');
    // 分页：生成 1200 行，应完整取回。
    const many = Array.from({ length: 1200 }, (_, i) => ({ id: `w${i}`, word: `word${i}`,
      normalized_word: `word${i}`, created_at: new Date(i).toISOString(),
      updated_at: new Date(i).toISOString(), deleted_at: null }));
    stub.setRows({ user_words: many, user_meanings: [], meaning_review_states: [], review_records: [] });
    await db.words.clear();
    await engine.pull(user);
    const wordCount = await db.words.count();
    const ranges = stub.calls.filter((call) => call.range).map((call) => call.range);
    return { record, wordCount, ranges };
  }, { user: USER });

  assert.equal(pulled.record.hintUsed, true, '拉取不能抹掉 hintUsed');
  assert.equal(pulled.record.confidence, 3, '拉取不能抹掉 confidence');
  assert.equal(pulled.record.questionType, 'en-to-zh', '拉取不能抹掉 questionType');
  assert.equal(pulled.record.errorType, 'wrong_meaning', '拉取不能抹掉 errorType');
  assert.equal(pulled.record.inputValue, '收费', '拉取不能抹掉 inputValue');
  assert.equal(pulled.record.nextDueAt, 2000, '云端存在的字段仍应生效');
  assert.equal(pulled.wordCount, 1200, `分页应取回全部 1200 行，实际 ${pulled.wordCount}`);
  assert.equal(pulled.ranges.length >= 3, true, '应分页多次请求');
  checks.push({ name: '拉取保留本地专有字段并完整分页', passed: true, wordCount: pulled.wordCount });

  // ---- 4. 云端墓碑要删除本地行 ----
  const tombstoned = await page.evaluate(async ({ user }) => {
    const { SyncEngine } = await import('/src/services/sync/syncEngine.ts');
    const { db } = await import('/src/db/db.ts');
    const stub = window.__syncStub;
    stub.setRows({ user_words: [{ id: 'w1', word: 'charge', normalized_word: 'charge',
      created_at: new Date(1).toISOString(), updated_at: new Date(1).toISOString(),
      deleted_at: new Date(2).toISOString() }], user_meanings: [], meaning_review_states: [], review_records: [] });
    await db.words.put({ id: 'w1', word: 'charge', localOwnerUserId: user, createdAt: 1, updatedAt: 1 });
    await new SyncEngine(stub).pull(user);
    return db.words.get('w1');
  }, { user: USER });

  assert.equal(tombstoned, undefined, '云端墓碑应删除本地行，且不被复活');
  checks.push({ name: '云端墓碑删除本地行', passed: true });

  assert.deepEqual(errors, []);
  await context.close();
  const report = { passed: true, checkedAt: new Date().toISOString(), url: root, checks };
  await writeFile(new URL('../reports/sync-safety/report.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
