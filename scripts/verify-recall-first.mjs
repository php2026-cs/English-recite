// 验收「直接回忆」（recall-first）练习方式：先独立输入，需要时才请求选项。
// 用法：先启动开发服务器，再运行本脚本。
//   npm run dev -- --host 127.0.0.1 --port 4181 --strictPort
//   node scripts/verify-recall-first.mjs
// 可用 REVIEW_TEST_URL 更换地址，用 PLAYWRIGHT_MODULE 指向已有的 Playwright ESM 包。
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const root = process.env.REVIEW_TEST_URL || 'http://127.0.0.1:4181';
const runKey = JSON.stringify([null, 'en-zh']);
const checks = [];

async function readRun(page) {
  return page.evaluate(async (key) => {
    const { db } = await import('/src/db/db.ts');
    return db.activeReviewRuns.get(key);
  }, runKey);
}

try {
  await mkdir(new URL('../reports/recall-first/', import.meta.url), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // ---- 1. 直接回忆：只排输入轮，借助提示答对记为困难且不进入表现画像 ----
  await page.goto(root);
  await page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    await db.settings.put({
      id: 'app', reviewFlow: 'recall-first', dailyNewMeaningLimit: 20, desiredRetention: 0.9,
      dailyReminderEnabled: false, reminderTime: '20:00', reminderOnlyWhenDue: true,
      showDueCount: true, timezone: 'Asia/Shanghai'
    });
    const seed = [
      ['charge', [['v.', '收费'], ['n.', '费用']]],
      ['fine', [['adj.', '罚款']]]
    ];
    for (const [word, senses] of seed) {
      await db.words.put({ id: word, word, createdAt: 1, updatedAt: 1 });
      for (const [partOfSpeech, chineseMeaning] of senses) {
        await db.meanings.put({
          id: `${word}-${partOfSpeech}`, wordId: word, partOfSpeech, chineseMeaning,
          selectedForStudy: true, correctCount: 0, incorrectCount: 0, createdAt: 1, updatedAt: 1
        });
      }
    }
  });
  await page.goto(`${root}/review/en-zh`);
  await page.getByText(/第 1 \/ 2 个单词/).waitFor();

  const created = await readRun(page);
  assert.equal(created.flow, 'recall-first');
  assert.deepEqual(created.queue.map((task) => task.phase), ['input', 'input']);
  assert.equal(created.queue.some((task) => task.phase === 'choice'), false);
  assert.equal(await page.getByText('直接回忆 · 第 1 / 2 个单词').count(), 1);
  checks.push({ name: '直接回忆只排输入轮', passed: true });

  // 未点提示前不应出现选项
  assert.equal(await page.locator('section[aria-label="回忆提示"]').count(), 0);
  await page.getByRole('button', { name: '给我选项', exact: true }).click();
  const hint = page.locator('section[aria-label="回忆提示"]');
  await hint.waitFor();
  await hint.locator('button.choice-option').first().waitFor({ timeout: 60_000 });
  assert.match(await hint.innerText(), /已使用提示 · 本题不会计为独立掌握/);
  checks.push({ name: '选项按需加载且标明不计独立掌握', passed: true });

  // 点选正确选项填入对应空格。选项按钮文本是「字母 + 词性 + 释义」，按完整标签精确匹配，
  // 避免干扰项恰好包含相同字样时点错。
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [partOfSpeech, gloss] of [['v.', '收费'], ['n.', '费用']]) {
    const option = hint.locator('button.choice-option')
      .filter({ hasText: new RegExp(`^[A-Z]\\s*${escape(partOfSpeech)}\\s+${escape(gloss)}$`) });
    assert.equal(await option.count(), 1, `应恰好有一个「${partOfSpeech} ${gloss}」选项`);
    await option.click();
  }
  const filled = await page.evaluate(async () => {
    const els = Array.from(document.querySelectorAll('input[id^="en-zh-slot-"]'));
    return els.map((el) => el.value);
  });
  assert.deepEqual([...filled].sort(), ['收费', '费用']);
  checks.push({ name: '提示选项填入对应空格', passed: true });

  await page.screenshot({ path: fileURLToPath(new URL('../reports/recall-first/en-zh-hint.png', import.meta.url)), fullPage: true });
  await page.getByRole('button', { name: '查看答案', exact: true }).click();
  await page.getByText(/本题借助了选项提示/).waitFor();
  for (const label of ['记得', '熟练']) {
    const button = page.getByRole('group', { name: '收费掌握程度' }).getByRole('button', { name: label, exact: true });
    assert.equal(await button.isDisabled(), true, `${label} 在借助提示后应禁用`);
  }
  assert.equal(await page.getByRole('group', { name: '收费掌握程度' }).getByRole('button', { name: '困难', exact: true }).isDisabled(), false);
  checks.push({ name: '借助提示后记得与熟练被禁用', passed: true });

  await page.getByRole('button', { name: '保存并下一词', exact: true }).click();
  await page.getByText(/第 2 \/ 2 个单词/).waitFor();

  // 第二个单词不用提示，直接输入
  assert.equal(await page.locator('section[aria-label="回忆提示"]').count(), 0);
  await page.locator('input[id^="en-zh-slot-"]').first().fill('罚款');
  await page.getByRole('button', { name: '查看答案', exact: true }).click();
  await page.getByText(/匹配 1 \/ 1 个义项/).waitFor();
  assert.equal(await page.getByText(/本题借助了选项提示/).count(), 0);
  await page.getByRole('button', { name: '保存并完成', exact: true }).click();
  await page.getByText(/本轮结束/).waitFor();

  const stored = await page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    return {
      records: await db.reviewRecords.toArray(),
      profiles: await db.performanceProfiles.count(),
      states: await db.meaningReviewStates.toArray()
    };
  });
  const hinted = stored.records.filter((record) => record.hintUsed);
  const direct = stored.records.filter((record) => !record.hintUsed);
  assert.equal(stored.records.length, 3, `应写入 3 条复习记录，实际 ${stored.records.length}`);
  assert.equal(hinted.length, 2, 'charge 的两个义项都应记录为借助提示');
  assert.deepEqual([...new Set(hinted.map((record) => record.result))], ['hard'], '借助提示答对必须降级为困难');
  assert.deepEqual([...new Set(direct.map((record) => record.result))], ['good'], '独立答对仍是记得');
  assert.equal(stored.profiles, 1, '只有独立作答的义项才更新表现画像');
  const hintFlagged = stored.states.filter((state) => state.fsrsData?.studySupport?.lastHintUsed);
  assert.equal(hintFlagged.length, 2, '借助提示的状态应带 lastHintUsed');
  assert.equal(hintFlagged.some((state) => state.fsrsData.studySupport.lastIndependentAt),
    false, '借助提示不应记录独立作答时间');
  const independent = stored.states.filter((state) => state.fsrsData?.studySupport?.lastIndependentAt);
  assert.equal(independent.length, 1, '独立答对应记录独立作答时间');
  checks.push({ name: '提示降级、画像跳过与状态标记入库', passed: true });

  // ---- 2. 选回先选后填，以及旧会话缺少 flow 时保持两轮流程 ----
  await page.evaluate(async (key) => {
    const { db } = await import('/src/db/db.ts');
    await db.activeReviewRuns.delete(key);
    await db.settings.put({ id: 'app', reviewFlow: 'two-rounds' });
    // 清空调度状态，让这些义项重新变成新学，能再次组出队列。
    await db.meaningReviewStates.clear();
  }, runKey);
  await page.goto(`${root}/review/en-zh`);
  await page.getByText(/第一轮 · 选择辨认/).waitFor();
  const legacyQueue = await readRun(page);
  assert.deepEqual(legacyQueue.queue.map((task) => task.phase), ['choice', 'choice', 'input', 'input']);

  // 抹掉 flow 字段，模拟升级前保存的旧会话
  await page.evaluate(async (key) => {
    const { db } = await import('/src/db/db.ts');
    const run = await db.activeReviewRuns.get(key);
    delete run.flow;
    run.index = 0;
    run.status = 'active';
    await db.activeReviewRuns.put(run);
  }, runKey);
  await page.reload();
  await page.getByText(/第一轮 · 选择辨认/).waitFor();
  const reloaded = await readRun(page);
  assert.equal(reloaded.flow, undefined);
  assert.deepEqual(reloaded.queue.map((task) => task.phase), ['choice', 'choice', 'input', 'input']);
  checks.push({ name: '旧会话缺少 flow 仍是两轮', passed: true });

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '390px 不应横向溢出');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.review-transition').evaluate((el) => getComputedStyle(el).animationName), 'none');
  assert.deepEqual(errors, []);
  checks.push({ name: '手机布局、减少动态效果与无未捕获异常', passed: true });

  await context.close();
  const report = { passed: true, checkedAt: new Date().toISOString(), url: root, checks };
  await writeFile(new URL('../reports/recall-first/report.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
