import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const root = process.env.REVIEW_TEST_URL || 'http://127.0.0.1:4181';
const checks = [];
try {
  await mkdir(new URL('../reports/two-rounds/',import.meta.url),{recursive:true});
  for (const mode of ['en-zh', 'zh-en', 'adaptive']) {
    const context = await browser.newContext({viewport: {width:390,height:844},serviceWorkers:'block'});
    const page = await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(root);
    await page.evaluate(async () => {
      const {db}=await import('/src/db/db.ts');
      for(const [i,word] of ['charge','fine'].entries()) {
        await db.words.put({id:word,word,createdAt:i+1,updatedAt:i+1});
        await db.meanings.put({id:word+'-v',wordId:word,partOfSpeech:'v.',chineseMeaning:word==='charge'?'收费':'罚款',selectedForStudy:true,correctCount:0,incorrectCount:0,createdAt:i+1,updatedAt:i+1});
        if(word==='charge') await db.meanings.put({id:word+'-n',wordId:word,partOfSpeech:'n.',chineseMeaning:'费用',selectedForStudy:true,correctCount:0,incorrectCount:0,createdAt:3,updatedAt:3});
      }
    });
    await page.goto(root+'/review/'+mode);
    for(let i=0;i<2;i++) {
      await page.getByRole('group',{name:'答案选项',exact:true}).waitFor();
      const run = await page.evaluate(async(mode)=>{const {db}=await import('/src/db/db.ts');return db.activeReviewRuns.get(JSON.stringify([null,mode]));},mode);
      assert.deepEqual(run.queue.map(t=>t.phase),['choice','choice','input','input']);
      const item=run.queue[run.index];
      const zh = await page.getByText('第一轮 · 中译英单选',{exact:true}).count();
      const labels=zh ? [item.word.word] : item.meanings.map(m=>`${m.partOfSpeech} ${m.chineseMeaning}`);
      for(const label of labels) await page.getByRole('group',{name:'答案选项',exact:true}).getByText(label,{exact:true}).click();
      if(i===0) await page.screenshot({path:fileURLToPath(new URL(`../reports/two-rounds/${mode}.png`,import.meta.url)),fullPage:true});
      await page.getByRole('button',{name:'确认选择',exact:true}).click();
      await page.getByText(/全部选对/).waitFor();
      await page.reload();
      await page.getByText(/全部选对/).waitFor();
      assert.equal(await page.evaluate(async()=>{const {db}=await import('/src/db/db.ts');return db.reviewRecords.count();}),0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole('button',{name:i===0?'下一题':'进入第二轮 · 输入回忆',exact:true}).click();
      const repeated=await page.evaluate(async({run,direction})=>{const {saveChoiceProgress}=await import('/src/services/srs/reviewRunRepository.ts');return saveChoiceProgress(run,direction);},{run,direction:zh?'zh-en':'en-zh'});
      assert.equal(repeated.index,i+1);
    }
    await page.getByText(/第二轮 · 输入回忆 · 第 1/).waitFor();
    await page.locator('input').first().waitFor();
    const run=await page.evaluate(async(mode)=>{const {db}=await import('/src/db/db.ts');return db.activeReviewRuns.get(JSON.stringify([null,mode]));},mode);
    const item=run.queue[run.index];
    if(item.direction==='zh-en') await page.locator('input').first().fill(item.word.word);
    else for(let i=0;i<item.meanings.length;i++) await page.locator('input').nth(i).fill(item.meanings[i].chineseMeaning);
    const submit=page.getByRole('button',{name:'提交答案',exact:true});
    if(await submit.count()) await submit.click(); else await page.getByRole('button',{name:'查看答案',exact:true}).click();
    await page.getByRole('button',{name:'保存并下一词',exact:true}).click();
    await page.getByText(/第二轮 · 输入回忆 · 第 2/).waitFor();
    assert.equal(await page.evaluate(async()=>{const {db}=await import('/src/db/db.ts');return db.reviewRecords.count();}),item.meanings.length);
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.review-transition').evaluate(e=>getComputedStyle(e).animationName),'none');
    assert.deepEqual(errors,[]);
    checks.push({mode,passed:true});
    await context.close();
  }
  await mkdir(new URL('../reports/two-rounds/',import.meta.url),{recursive:true});
  const report={passed:true,checkedAt:new Date().toISOString(),checks};
  await writeFile(new URL('../reports/two-rounds/report.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
