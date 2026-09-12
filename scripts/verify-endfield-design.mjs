import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,channel:'chromium'});
const root=process.env.REVIEW_TEST_URL || 'http://127.0.0.1:4181';
const out=new URL('../reports/endfield-design/',import.meta.url);
await mkdir(out,{recursive:true});
const checks=[];
try {
  for(const viewport of [{width:390,height:844},{width:1440,height:1000},{width:320,height:720}]) {
    const context=await browser.newContext({viewport,serviceWorkers:'block'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(root);
    await page.getByRole('heading',{name:'让每个词，都记得更牢。'}).waitFor();
    assert(await page.locator('[data-ark-theme=endfield]').count());
    for(const route of ['/','/words/new','/settings','/review']) {
      await page.goto(root+route);await page.locator('main h1').waitFor();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflows');
      await page.screenshot({path:fileURLToPath(new URL(`${viewport.width}-${route.replaceAll('/','_')||'home'}.png`,out)),fullPage:true});
    }
    await page.goto(root);
    await page.getByRole('link',{name:'开始背诵'}).click();
    assert(page.url().endsWith('/review'));
    const nav=page.getByRole('navigation',{name:viewport.width>=1024?'主导航':'手机导航',exact:true});
    assert.equal(await nav.locator('a[aria-current=page]').innerText().then(s=>s.includes('背诵')),true);
    await page.keyboard.press('Tab');
    await nav.getByRole('link',{name:/设置/}).focus();
    assert.notEqual(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'none');
    assert.deepEqual(errors,[]);checks.push({viewport,passed:true});await context.close();
  }
  // Render original project SVG into the two installable app icons.
  const icon=await browser.newPage();
  const svg=await readFile(new URL('../public/icon.svg',import.meta.url),'utf8');
  await icon.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`);
  for(const size of [192,512]) {await icon.setViewportSize({width:size,height:size});await icon.screenshot({path:fileURLToPath(new URL(`../public/icon-${size}.png`,import.meta.url))});}
  await icon.close();
  await writeFile(new URL('report.json',out),JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
} finally {await browser.close();}
