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
  for(let i=0;i<3;i++) {
    const prompt = await page.locator('.tilt-question h2').textContent();
    const word = answers[prompt.match(/“(.+)”/)[1]];
    await page.getByRole('button',{name:new RegExp('Chọn (trái|phải): '+word+'$')}).click();
    assert.equal(await page.locator('.tilt-card-correct .tilt-hanzi').textContent(),word);
    if(i===0) await page.screenshot({path:output+'/correct.png',fullPage:true});
    await page.getByRole('button',{name:i===2?'Kết quả':'Câu tiếp theo',exact:true}).click();
  }
  assert.match(await page.locator('.tilt-finish').textContent(),/Đúng 3\/3 câu · 40 điểm/);
  await page.getByRole('button',{name:'Chơi lại',exact:true}).first().click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:output+'/mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),'No horizontal overflow on mobile');
  const mCamera=await page.locator('.tilt-camera-ring').boundingBox(), mLeft=await page.locator('.tilt-card-left').boundingBox();
  assert(mCamera.y+mCamera.height<mLeft.y,'Camera above cards on mobile');
  await page.getByRole('button',{name:'Trò khác',exact:true}).click();
  await page.getByRole('button',{name:/Ai nhanh hơn/}).waitFor();
  assert.deepEqual(errors,[],'No browser runtime or hydration errors');
  console.log('PASS: layout, mobile overflow, pause, camera denial fallback, scoring, streak bonus, results and restart. Screenshots: '+output);
})().catch(error=>{console.error(error);console.error(logs.slice(-8).join(''));process.exitCode=1;}).finally(async()=>{
  await browser?.close(); server?.kill('SIGTERM');
  fs.unlinkSync(path.join(route,'page.tsx')); fs.rmdirSync(route);
});
