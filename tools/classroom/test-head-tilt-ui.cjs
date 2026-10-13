// Local fixtures only; no classroom or Supabase writes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/private/tmp/classhub-tilt-tools/node_modules/playwright');
const route = path.resolve('src/app/tilt-verification');
const origin = 'http://127.0.0.1:3127';
const output = '/private/tmp/classhub-tilt-ui';
assert(!fs.existsSync(route), 'Refuse to replace an existing route');
fs.mkdirSync(route); fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(route, 'page.tsx'), `"use client";
import { useState } from "react";
import { GameStage } from "@/components/classroom/game-stage";
import { ClassroomThemeProvider } from "@/components/classroom/theme-provider";
import "@/app/classroom/classroom.css";
const vocab = ${JSON.stringify([['冷','lěng','Lạnh'],['热','rè','Nóng'],['天气','tiānqì','Thời tiết']].map(([hanzi,pinyin,meaning],i)=>({id:String(i),hanzi,pinyin,meaning,example:null,audio_url:null,level:null,tags:[],created_at:''})))};
export default function Fixture() { const [active,setActive] = useState(true); return <ClassroomThemeProvider><div style={{padding:20}}><button onClick={()=>setActive(v=>!v)}>Toggle overlay</button><div style={{height:'calc(100dvh - 85px)',minHeight:550,display:active?'block':'none'}}><GameStage vocab={vocab} students={[]} onAward={()=>{}} active={active}/></div></div></ClassroomThemeProvider> }
`);
let server, browser;
const logs = [];
(async () => {
  server = spawn('npm', ['run','dev','--','--hostname','127.0.0.1','--port','3127'], { env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:origin+'/fixture',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture'}, stdio:['ignore','pipe','pipe'] });
  server.stdout.on('data',d=>logs.push(String(d))); server.stderr.on('data',d=>logs.push(String(d)));
  let ready = false;
  for(let i=0;i<100;i++) { try { if((await fetch(origin+'/tilt-verification')).ok) {ready=true;break;} } catch {} await new Promise(r=>setTimeout(r,400)); }
  assert(ready,logs.join(''));
  browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true });
  const page = await browser.newPage({viewport:{width:1366,height:900}});
  const errors = []; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{ navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied in fixture','NotAllowedError');}; });
  await page.goto(origin+'/tilt-verification');
  await page.getByRole('button',{name:/Nghiêng đầu chọn đáp án/}).click();
  await page.locator('.tilt-card').first().waitFor();
  await page.screenshot({path:output+'/desktop.png',fullPage:true});
  const left = await page.locator('.tilt-card-left').boundingBox(), camera = await page.locator('.tilt-camera-ring').boundingBox(), right = await page.locator('.tilt-card-right').boundingBox();
  assert(left.x+left.width < camera.x && camera.x+camera.width < right.x, 'Camera between two answer cards');
  await page.getByRole('button',{name:'Tạm dừng',exact:true}).click();
  await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('.tilt-card-correct').count(),0);
  await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  await page.getByRole('button',{name:'Bật camera',exact:true}).click();
  await page.locator('.tilt-camera-error').waitFor();
  assert.match(await page.locator('.tilt-camera-error').textContent(), /Chưa được phép/);
  const answers = {'Lạnh':'冷','Nóng':'热','Thời tiết':'天气'};
  const meanings = Object.fromEntries(Object.entries(answers).map(([meaning,hanzi])=>[hanzi,meaning]));
  const seenKinds = new Set();
  for(let i=0;i<9;i++) {
    const prompt = await page.locator('.tilt-question h2').textContent();
    const kind = await page.locator('.tilt-question').getAttribute('data-kind');
    const quoted = prompt.match(/“(.+)”/)[1];
    const word = kind==='vi_zh' ? answers[quoted] : kind==='zh_vi' ? meanings[quoted]
      : meanings[await page.locator('.tilt-question h2 .zh').textContent()]===quoted ? 'Đúng' : 'Sai';
    assert(word,'Question can be solved from visible vocabulary');
    if(!seenKinds.has(kind)) {
      await page.screenshot({path:output+'/'+kind+'-desktop.png',fullPage:true});
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:output+'/'+kind+'-mobile.png',fullPage:true});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),kind+' does not overflow on mobile');
      await page.setViewportSize({width:1366,height:900});
      seenKinds.add(kind);
    }
    await page.getByRole('button',{name:new RegExp('Chọn (trái|phải): '+word+'$')}).click();
    assert.equal(await page.locator('.tilt-card-correct .tilt-hanzi, .tilt-card-correct .tilt-option-text').textContent(),word);
    if(i===0) {
      await page.getByRole('button',{name:'Tạm dừng',exact:true}).click();
      await page.waitForTimeout(1200);
      assert.match(await page.locator('.tilt-round strong').textContent(), /Câu 1/,'Pause stops auto advance');
      await page.getByRole('button',{name:'Toggle overlay',exact:true}).click();
      await page.waitForTimeout(1200);
      await page.getByRole('button',{name:'Toggle overlay',exact:true}).click();
      assert.match(await page.locator('.tilt-round strong').textContent(), /Câu 1/,'Hidden overlay stops auto advance');
      await page.screenshot({path:output+'/correct.png',fullPage:true});
      await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
    }
    if(i===8) await page.locator('.tilt-finish').waitFor();
    else await page.waitForFunction(expected => document.querySelector('.tilt-round strong')?.textContent?.includes('Câu '+expected),i+2);
  }
  assert.equal(seenKinds.size,3,'All requested question types are played');
  assert.match(await page.locator('.tilt-finish').textContent(),/Đúng 9\/9 câu · 120 điểm/);
  // A manual next must cancel the old round's timer rather than skipping another question.
  await page.getByRole('button',{name:'Chơi lại',exact:true}).first().click();
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button',{name:'Câu tiếp theo',exact:true}).click();
  await page.waitForTimeout(1200);
  assert.match(await page.locator('.tilt-round strong').textContent(), /Câu 2/);
  // Restart during the result delay must not advance the newly created game.
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button',{name:'Chơi lại',exact:true}).first().click();
  await page.waitForTimeout(1200);
  assert.match(await page.locator('.tilt-round strong').textContent(), /Câu 1/);
  await page.getByRole('button',{name:'Chơi lại',exact:true}).first().click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:output+'/mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),'No horizontal overflow on mobile');
  const mCamera=await page.locator('.tilt-camera-ring').boundingBox(), mLeft=await page.locator('.tilt-card-left').boundingBox();
  assert(mCamera.y+mCamera.height<mLeft.y,'Camera above cards on mobile');
  await page.getByRole('button',{name:'Trò khác',exact:true}).click();
  await page.getByRole('button',{name:/Ai nhanh hơn/}).waitFor();
  assert.deepEqual(errors,[],'No browser runtime or hydration errors');
  console.log('PASS: auto advance, pause/hidden overlay, timer cleanup on manual next/restart, layout, camera denial fallback, scoring and results. Screenshots: '+output);
})().catch(error=>{console.error(error);console.error(logs.slice(-8).join(''));process.exitCode=1;}).finally(async()=>{
  await browser?.close(); server?.kill('SIGTERM');
  fs.unlinkSync(path.join(route,'page.tsx')); fs.rmdirSync(route);
});
