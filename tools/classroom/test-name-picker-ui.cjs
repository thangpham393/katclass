// Actual React components with local HTTP/storage fixtures; no production writes.
// Usage: node tools/classroom/test-name-picker-ui.cjs /private/tmp/classhub-picker-tools/node_modules/playwright
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require(path.resolve(process.argv[2]));
const origin = 'http://127.0.0.1:3134';
const route = path.resolve('src/app/name-picker-verification');
const output = '/private/tmp/classhub-name-picker-ui';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const students = ['Bình An', 'Cherry', 'Chi Anh', 'Bắp', 'Mễ'].map((name,i) => ({id:id(i+10),name,avatar:i===4?null:'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${['#fda4af','#a5b4fc','#fcd34d','#6ee7b7'][i]}"/><circle cx="90" cy="95" r="10" fill="#1e293b"/><circle cx="166" cy="95" r="10" fill="#1e293b"/><path d="M70 150 Q128 225 186 150" stroke="#1e293b" fill="none" stroke-width="10" stroke-linecap="round"/></svg>`).toString('base64'),makeup:false}));
assert(!fs.existsSync(route), 'Refuse to overwrite existing route');
fs.mkdirSync(route); fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(route,'page.tsx'), `"use client";
import { useState } from 'react';
import { NamePicker } from '@/components/classroom/name-picker';
import { ClassPhotoManager } from '@/components/classes/class-photo-manager';
import { ClassroomThemeProvider, ClassroomThemeToggle } from '@/components/classroom/theme-provider';
import '@/app/classroom/classroom.css';
const students = ${JSON.stringify(students)};
const roster = students.map(s=>({student_id:s.id,status:'active',joined_at:'',student:{...s,avatar:null,email:'',phone:null}}));
export default function Fixture() { const [active,setActive]=useState(true), [picked,setPicked]=useState<string[]>([]);
return <><div style={{padding:20}}><ClassPhotoManager classId="${id(1)}" students={roster}/></div><ClassroomThemeProvider><div style={{padding:20}}><button onClick={()=>setActive(v=>!v)}>Toggle overlay</button><ClassroomThemeToggle/><output data-testid="picked">{JSON.stringify(picked)}</output><div style={{height:660,display:active?'block':'none'}}><NamePicker students={students} sessionId="fixture" active={active} onPicked={s=>setPicked(p=>[...p,s.id])} photosHref="/name-picker-verification"/></div></div></ClassroomThemeProvider></> }
`);
let server, browser; const logs = [], errors = [], uploads = [], saves = []; let rejectSave = true; const stored = new Map();
(async()=>{
  server = spawn('npm',['run','dev','--','--hostname','127.0.0.1','--port','3134'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:origin+'/fixture',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',d=>logs.push(String(d))); server.stderr.on('data',d=>logs.push(String(d)));
  let ready=false;
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/name-picker-verification')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,400));}
  assert(ready,logs.join(''));
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1366,height:1000}}); page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/fixture/**',async r=>{
    const url=new URL(r.request().url()), p=url.pathname, method=r.request().method();
    if(p.endsWith('/rest/v1/class_photos')) {assert.equal(url.searchParams.get('class_id'),'eq.'+id(1)); return r.fulfill({contentType:'application/json',body:JSON.stringify([...stored].map(([photo_key,path])=>({photo_key,path})))});}
    if(p.includes('/storage/v1/object/class-photos/') && method==='POST') {
      const key=decodeURIComponent(p.split('/class-photos/')[1]); let bytes=r.request().postDataBuffer();
      const contentType=r.request().headers()['content-type'];
      if(contentType?.startsWith('multipart/')) {const form=await new Response(bytes,{headers:{'Content-Type':contentType}}).formData();const file=[...form.values()].find(v=>typeof v==='object'&&typeof v.arrayBuffer==='function');assert(file,'Storage request contains image blob');bytes=Buffer.from(await file.arrayBuffer());}
      uploads.push({path:key,bytes});return r.fulfill({contentType:'application/json',body:JSON.stringify({Key:key})});
    }
    if(p.endsWith('/rest/v1/rpc/save_class_photos')) {const data=r.request().postDataJSON();saves.push(data);if(rejectSave)return r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Fixture: lưu ảnh thất bại'})});for(const [key,path] of Object.entries(data.changes))path?stored.set(key,path):stored.delete(key);return r.fulfill({status:204});}
    if(p.includes('/storage/v1/object/sign/class-photos') && method==='POST') {return r.fulfill({contentType:'application/json',body:JSON.stringify(r.request().postDataJSON().paths.map(path=>({path,signedURL:'/object/class-photos/'+path})))});}
    if(p.includes('/storage/v1/object/class-photos/')) {const key=decodeURIComponent(p.split('/class-photos/')[1]);const up=uploads.find(u=>u.path===key);return r.fulfill({contentType:'image/jpeg',body:up?.bytes??Buffer.alloc(0)});}
    return r.fulfill({contentType:'application/json',body:'[]'});
  });
  await page.goto(origin+'/name-picker-verification');
  await page.getByRole('button',{name:'Quản lý ảnh'}).click();
  const source=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1600;c.height=900;const x=c.getContext('2d');x.fillStyle='#dbeafe';x.fillRect(0,0,1600,900);for(let i=0;i<5;i++){x.fillStyle=['#fda4af','#a5b4fc','#fcd34d','#6ee7b7','#7dd3fc'][i];x.beginPath();x.arc(260+i*270,400,95,0,Math.PI*2);x.fill();x.fillStyle='#1e293b';x.beginPath();x.arc(230+i*270,385,8,0,7);x.arc(290+i*270,385,8,0,7);x.fill();x.lineWidth=6;x.beginPath();x.arc(260+i*270,405,40,.15,Math.PI-.15);x.stroke();}return c.toDataURL().split(',')[1];});
  await page.locator('input[type=file]').first().setInputFiles({name:'group.png',mimeType:'image/png',buffer:Buffer.from(source,'base64')});
  await page.locator('.photo-editor-image img').waitFor();
  const box=await page.locator('.photo-editor-canvas').boundingBox();
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await page.locator('.photo-editor-assign').filter({hasText:'Chi Anh'}).click();
  await page.locator('.photo-editor-assign').filter({hasText:'Chi Anh'}).getByText('Chưa lưu').waitFor();
  // Zoom and pan keep crop coordinates on original source pixels.
  await page.getByRole('button',{name:'Phóng to',exact:true}).click();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2+25,{steps:5});await page.mouse.up();
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await page.locator('.photo-editor-assign').filter({hasText:'Bình An'}).click();
  await page.screenshot({path:output+'/crop-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Lưu ảnh',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'lưu ảnh thất bại'}).waitFor();
  assert.equal(await page.locator('.photo-editor').count(),1,'Failed save retains editor and drafts');
  assert.equal(Object.keys(saves[0].changes).length,3,'Group and both portraits save in one RPC');
  assert.equal(saves[0].cid,id(1));
  for(const up of uploads){assert(up.path.startsWith(id(1)+'/'));assert(up.bytes.length>100);}
  rejectSave=false;await page.getByRole('button',{name:'Lưu ảnh',exact:true}).click();
  await page.getByText('Đã lưu ảnh',{exact:true}).waitFor();assert.equal(stored.size,3);
  await page.getByRole('button',{name:'Quản lý ảnh'}).click();
  assert.equal(await page.locator('.photo-editor-assign img').count(),2,'Saved portraits reload');
  await page.waitForFunction(()=>[...document.querySelectorAll('.photo-editor-assign img')].every(img=>img.complete&&img.naturalWidth===512)&&document.querySelector('.photo-editor-image img')?.naturalWidth===1600);
  await page.waitForTimeout(300);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/crop-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Photo editor fits mobile width');
  await page.getByRole('button',{name:'Đóng',exact:true}).last().click();
  await page.setViewportSize({width:1366,height:1000});
  await page.getByRole('button',{name:/Gọi tên bằng ảnh/}).click();
  await page.getByRole('button',{name:'Cài đặt gọi tên'}).click();
  await page.getByRole('slider',{name:'Thời gian gọi tên'}).focus();await page.keyboard.press('Home');
  await page.screenshot({path:output+'/photo-ready.png',fullPage:true});
  const picked=async()=>JSON.parse(await page.getByTestId('picked').textContent());
  await page.getByRole('button',{name:'Bắt đầu gọi tên',exact:true}).click();
  await page.waitForTimeout(1200);await page.screenshot({path:output+'/photo-flying.png',fullPage:true});
  await page.locator('.name-picker-winner').waitFor();assert.equal((await picked()).length,1);
  await page.screenshot({path:output+'/photo-winner.png',fullPage:true});
  await page.getByRole('button',{name:/Đua bi/}).click();
  await page.getByRole('button',{name:'Bắt đầu đua bi',exact:true}).click();
  await page.waitForTimeout(1800);await page.screenshot({path:output+'/race-running.png',fullPage:true});
  await page.locator('.name-picker-winner').waitFor();assert.equal(new Set(await picked()).size,2,'Photo/race share no-repeat history');
  await page.getByRole('button',{name:/Vòng quay/}).click();
  await page.getByRole('button',{name:'Quay chọn học viên',exact:true}).click();
  assert(await page.getByRole('button',{name:/Đua bi/}).isDisabled(),'Cannot change mode while spinning');
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=picked]').textContent).length===3);
  assert.equal(new Set(await picked()).size,3,'Wheel shares photo/race history');
  await page.getByRole('button',{name:/Đua bi/}).click();
  await page.getByRole('button',{name:'Bắt đầu đua bi',exact:true}).click();
  await page.waitForTimeout(200);await page.getByRole('button',{name:'Toggle overlay',exact:true}).click();
  await page.waitForTimeout(5500);assert.equal((await picked()).length,3,'Hidden overlay cancels a pending pick');
  await page.getByRole('button',{name:'Toggle overlay',exact:true}).click();
  await page.reload();await page.getByText('3/5 đã được gọi',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Gọi tên bằng ảnh/}).click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/photo-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Picker fits mobile width');
  await page.getByRole('button',{name:'Chuyển sang giao diện sáng'}).click();await page.waitForTimeout(300);await page.screenshot({path:output+'/photo-mobile-light.png',fullPage:true});
  assert.deepEqual(errors,[],'No runtime or hydration errors');
  console.log('PASS: original-photo crop, zoom/pan, assignment, failed-save retry, private upload paths, portraits reload, all 3 modes, cross-mode fairness, reload history, cancellation, desktop/mobile and both themes. Screenshots: '+output);
})().catch(e=>{console.error(e);console.error(logs.slice(-10).join(''));process.exitCode=1;}).finally(async()=>{await browser?.close();server?.kill('SIGTERM');fs.unlinkSync(path.join(route,'page.tsx'));fs.rmdirSync(route);});
