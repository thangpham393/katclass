// Actual student player and actual PostgreSQL grading, with local-only fixtures. No live writes.
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
const {chromium}=require('/private/tmp/hsk-community-tools/node_modules/playwright');
const {PGlite}=require('/private/tmp/classhub-lms-tests/node_modules/@electric-sql/pglite/dist/index.cjs');
const port=3110;const origin=`http://127.0.0.1:${port}`;
const root=path.resolve('src/app/homework-verification');assert(!fs.existsSync(root),'Refuse to replace existing route');fs.mkdirSync(path.join(root,'[id]'),{recursive:true});
fs.writeFileSync(path.join(root,'[id]/page.tsx'),'// GENERATED LMS BROWSER VERIFICATION ONLY\nexport {default} from "@/app/student/homework/[id]/page";\n');
const work=path.resolve('tools/homework-lms/work');fs.mkdirSync(work,{recursive:true});
const q=(id,type,content,section,number)=>({id,type,content:{...content,source:{file:`fixture-${id}.pdf`,unit:1,section,numbers:[number]}},level:'HSK3',tags:[],lesson_id:'lesson-1',lesson:{id:'lesson-1',title:'Luyện tập hội thoại',unit:1,textbook_id:'textbook-1'},created_at:''});
const qs=[
 q('q1','multiple_choice',{prompt:'你____什么名字？ nǐ ___ shénme míngzi?',options:['是 shì','叫 jiào','人 rén','吗 ma']},'1-018-2',2),
 q('q2','fill_blank',{prompt:'A:___你有什么打算？ B: 我打算去爬山。',hint:'Từ cho sẵn: 周末 · 复习 · 作业'},'1-015-2',11),
 q('q3','fill_blank',{prompt:'A：你___什么？ B：我___茶。'},'1-017-2',12),
 q('q4','hanzi_pinyin',{prompt:'Viết chữ Hán và Pinyin: vui vẻ'},3,21),
 q('q5','essay',{prompt:'Hoàn thành lời đáp của B, bắt đầu bằng 那.\nA: 周末我不想去商店买东西。 B:',target_language:'zh'},4,31),
 q('q6','multiple_choice',{prompt:'A: 你好吗？ B: 我很好，谢谢！',options:['Đúng','Sai']},'1-018-2',40),
];
const groupingExamples=[
 ['essay',{prompt:'Viết lời giới thiệu bản thân.'}],
 ['fill_blank',{prompt:'我___汉语。',hint:'Từ cho sẵn: 学习 · 老师'}],
 ['multiple_choice',qs[0].content],
 ['translation',{prompt:'Dịch sang tiếng Trung: Tôi là học sinh.'}],
 ['reorder',{tokens:['汉语','我','学习','。']}],
 ['matching',{left:['你好','谢谢'],right:['Cảm ơn','Xin chào']}],
 ['pinyin_choice',{hanzi:'老师',options:['lǎoshī','làoshì']}],
 ['multi_matching',{left:['你','好'],columns:[{label:'Pinyin',options:['nǐ','hǎo']},{label:'Nghĩa',options:['tốt','bạn']}]}],
];
const grouping31=Array.from({length:31},(_,i)=>{
 const [type,content]=groupingExamples[i%groupingExamples.length];
 const row=q(`group-${i}`,type,content,`1-${String(14+i%6).padStart(3,'0')}-${i%2+1}`,i+1);
 row.content.source.unit=2;row.lesson={...row.lesson,unit:2,title:'Bạn tên gì?'};
 return row;
});
// The exact two unlabelled dialogues reported by the user, including source newlines.
const dialogueQs=JSON.parse(fs.readFileSync('supabase/library/yct-workbooks.json')).lessons.flatMap(l=>l.questions)
 .filter(row=>row.type==='fill_blank'&&row.content.source?.unit===2&&row.content.source?.format==='dialogue')
 .map((row,i)=>({...q(`dialogue-${i}`,row.type,row.content,row.content.source.section,i+1),level:'YCT1'}));
assert.equal(dialogueQs.length,2);
const expected=['B',['周末'],['喝','喝'],{hanzi:'快乐',pinyin:'kuàilè'},['Bài mẫu không được lộ cho học viên'],'A'];
let server,browser;const logs=[];let sub=null;let review=null;let posts=[];
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;
 create table questions(id uuid,type text constraint questions_type_check check(type in('multiple_choice')),content jsonb);
 create table question_answers(question_id uuid,answer jsonb);
 create table classes(id uuid,teacher_id uuid);create table class_students(class_id uuid,student_id uuid);
 create table homeworks(id uuid,class_id uuid,kind text,time_limit_minutes int,manual_tasks text[],teacher_note text);
 create table homework_questions(homework_id uuid,question_id uuid,sort int);
 create table test_attempts(homework_id uuid,student_id uuid,started_at timestamptz);
 create table submissions(id uuid,homework_id uuid,student_id uuid,answers jsonb,auto_score numeric,score numeric,status text,submitted_at timestamptz,graded_at timestamptz,graded_by uuid);
 create function my_profile_id() returns uuid language sql as $$select null::uuid$$;
 create function has_perm(p text) returns boolean language sql as $$select false$$;
 create function submit_homework(hw_id uuid,my_answers jsonb) returns submissions language plpgsql as $$begin return null;end$$;`);
 for(const f of ['0049_written_exercise_types.sql','0051_hsk2_written_and_manual_exercises.sql','0052_homework_review_and_pinyin.sql'])await db.exec(fs.readFileSync(path.join('supabase/migrations',f),'utf8'));
 server=spawn('npm',['run','dev','--','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:origin+'/fixture',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-anon-key'},stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>logs.push(String(d)));server.stderr.on('data',d=>logs.push(String(d)));
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin+'/homework-verification/fixture')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,400));}assert(ready,logs.join(''));
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const user={id:'00000000-0000-0000-0000-000000000001',aud:'authenticated',role:'authenticated',email:'fixture@example.test',app_metadata:{},user_metadata:{},created_at:'2026-10-09T00:00:00Z'};
 const access=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+86400})).toString('base64url'),'fixture'].join('.');
 const session={access_token:access,refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,token_type:'bearer',user};
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/'}]);
 await page.route('**/fixture/**',async route=>{
  const url=new URL(route.request().url());let result=null;
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}});return;}
  if(url.pathname.endsWith('/profiles'))result={id:user.id,name:'Học viên kiểm thử',email:user.email,role:'student',avatar:null,branch_id:null};
  else if(url.pathname.endsWith('/role_permissions'))result=[];
  else if(url.pathname.endsWith('/homeworks'))result={id:'fixture',title:'HSK · Luyện tập theo từng phần',kind:'homework',class_id:'fixture-class',class:{id:'fixture-class',name:'Lớp HSK kiểm thử'},manual_tasks:[],teacher_note:'',time_limit_minutes:null,open_at:null,due_at:null,homework_questions:(url.searchParams.get('id')==='eq.grouping31'?grouping31:url.searchParams.get('id')==='eq.dialogue'?dialogueQs:qs).slice().reverse().map((question,i)=>({sort:i,question}))};
  else if(url.pathname.endsWith('/submissions'))result=sub;
  else if(url.pathname.endsWith('/rpc/submit_homework')){
   const answers=route.request().postDataJSON().my_answers;posts.push(answers);const details=[];
   for(let i=0;i<qs.length;i++){
    const {rows}=await db.query('select build_question_review($1,$2,$3,$4) as r',[qs[i].type,JSON.stringify(qs[i].content),JSON.stringify(expected[i]),answers[qs[i].id]===undefined?null:JSON.stringify(answers[qs[i].id])]);details.push({...rows[0].r,question_id:qs[i].id,explanation:i===0?'叫 dùng để hỏi tên trong câu 你叫什么名字？':null});
   }
   review={legacy:false,questions:details};sub={id:'submission-fixture',student_id:user.id,answers,auto_score:Math.round(details.reduce((s,q)=>s+q.correct,0)*100/details.reduce((s,q)=>s+q.total,0))/10,score:null,status:'submitted',submitted_at:new Date().toISOString()};result=sub;
  }else if(url.pathname.endsWith('/rpc/get_homework_review')){assert(sub,'No review before submission');result=review;}
  else if(url.pathname.includes('/auth/v1/user'))result=user;
  else throw new Error(`Unmocked fixture route: ${url.pathname}`);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result),headers:{'Access-Control-Allow-Origin':'*'}});
 });
 const initialSubmission=page.waitForResponse(r=>r.url().includes('/fixture/rest/v1/submissions'));
 await page.goto(origin+'/homework-verification/fixture');await initialSubmission;await page.getByRole('heading',{name:'HSK · Luyện tập theo từng phần'}).waitFor();await page.getByRole('heading',{name:'Trắc nghiệm',exact:true}).waitFor();
 const cards=page.locator('[id^="exercise-section-"]');await cards.first().waitFor();assert.equal(await cards.count(),4);
 assert.equal(await page.getByRole('navigation',{name:'Các phần trong bài tập'}).count(),0);
 assert.equal(await cards.nth(0).getByRole('button').count(),6,'All multiple-choice questions are contiguous');
 assert.equal(await cards.nth(1).locator('input').count(),3,'All fill-blank questions are contiguous across different PDFs/codes');
 assert(!((await page.locator('body').textContent()).includes('Phần 1-')));
 assert.match(await cards.first().textContent(),/Câu 2 trong đề/);assert(!((await cards.first().textContent()).includes('nǐ ___ shénme míngzi?')));
 const dialogue=page.getByRole('group',{name:'Hội thoại'});assert.equal(await dialogue.count(),4);assert.equal(await dialogue.nth(1).locator('input').count(),1);assert.equal(await dialogue.nth(2).locator('input').count(),2);
 await page.getByLabel('Chỗ trống 1',{exact:true}).first().fill('周末');await page.getByLabel('Bài viết',{exact:true}).fill('那我们在家看电视吧。');
 const ruby=page.locator('ruby').first();assert.equal(await ruby.evaluate(e=>getComputedStyle(e).rubyPosition),'over');
 await page.screenshot({path:path.join(work,'player-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Ẩn phiên âm',exact:true}).click();assert.equal(await page.locator('ruby').count(),0);await page.getByRole('button',{name:'Hiện phiên âm',exact:true}).click();
 await page.getByRole('button',{name:'Nộp bài',exact:true}).click();await page.getByRole('heading',{name:'Xem lại bài làm',exact:true}).waitFor();assert.equal(await page.locator('[id^="review-section-"]').count(),4);assert.equal(posts.length,1);assert.equal(Object.keys(posts[0]).length,2,'Incomplete homework submitted');
 await page.getByText('Giải thích',{exact:true}).waitFor();assert(!((await page.locator('body').textContent()).includes('Bài mẫu không được lộ')));assert.equal(await page.locator('#review-section-0 input:enabled').count(),0);
 await page.getByRole('button',{name:/Cần xem lại/}).click();assert(!((await page.locator('[id^="review-section-"]').allTextContents()).join(' ')).includes('Câu 11 trong đề'));
 await page.getByRole('button',{name:'Tất cả',exact:true}).click();await page.screenshot({path:path.join(work,'review-mobile.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile overflow');
 await page.reload();await page.getByRole('heading',{name:'Xem lại bài làm',exact:true}).waitFor();
 await page.getByRole('button',{name:'Tiếp tục / sửa bài đã nộp',exact:true}).click();assert.equal(await page.getByLabel('Chỗ trống 1',{exact:true}).first().inputValue(),'周末');assert.equal(await page.getByLabel('Bài viết',{exact:true}).inputValue(),'那我们在家看电视吧。');
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(work,'player-desktop.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Desktop overflow');assert.deepEqual(errors,[]);
 sub=null;
 const groupingSubmission=page.waitForResponse(r=>r.url().includes('/fixture/rest/v1/submissions'));
 await page.goto(origin+'/homework-verification/grouping31');await groupingSubmission;
 await page.waitForFunction(()=>document.querySelectorAll('[id^="exercise-section-"]').length===8);
 assert.equal(await page.locator('[id^="exercise-section-"] > div').count(),31,'Every assigned question appears once');
 assert.equal(new Set(await page.locator('[id^="exercise-section-"] > header > h2').allTextContents()).size,8,'One heading per exercise type');
 assert.equal(await page.getByRole('navigation',{name:'Các phần trong bài tập'}).count(),0);
 await page.screenshot({path:path.join(work,'grouping31-desktop.png'),fullPage:true});
 await page.screenshot({path:path.join(work,'grouping31-desktop-top.png')});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(work,'grouping31-mobile.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'31-question mobile overflow');
 const dialogueSubmission=page.waitForResponse(r=>r.url().includes('/fixture/rest/v1/submissions'));
 await page.goto(origin+'/homework-verification/dialogue');await dialogueSubmission;
 await page.getByRole('group',{name:'Hội thoại'}).nth(1).waitFor();
 const sourceDialogues=page.getByRole('group',{name:'Hội thoại'});assert.equal(await sourceDialogues.count(),2);
 for(let i=0;i<2;i++){
  const group=sourceDialogues.nth(i);const turns=group.locator(':scope > div');
  assert.equal(await turns.count(),i===0?4:3,'Original source turns are preserved, including follow-up sentences');
  for(const [j,count] of (i===0?[1,1,1,0]:[1,1,0]).entries())assert.equal(await turns.nth(j).locator('input').count(),count);
  for(let j=0;j<(i===0?3:2);j++)await group.getByLabel(`Chỗ trống ${j+1}`,{exact:true}).fill(`答${i}-${j}`);
  for(let j=0;j<(i===0?3:2);j++)assert.equal(await group.getByLabel(`Chỗ trống ${j+1}`,{exact:true}).inputValue(),`答${i}-${j}`,'Each blank updates its own answer index');
 }
 assert(await page.locator('ruby').count()>0,'Dialogue Hanzi retain pinyin above characters');
 await page.screenshot({path:path.join(work,'unlabelled-dialogue-mobile.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Unlabelled dialogue mobile overflow');
 await page.setViewportSize({width:1280,height:1600});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:path.join(work,'unlabelled-dialogue-desktop.png')});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Unlabelled dialogue desktop overflow');
 assert.deepEqual(errors,[]);
 await db.close();console.log('PASS: actual player at 390px and 1280px, grouped types across source PDFs/string section codes, no navigation wall, labelled and exact unlabelled source dialogue turns/inline answer indices, ruby above Hanzi, incomplete submission, review/filter/reload, continue editing, no browser exceptions or horizontal overflow');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.kill('SIGTERM');const file=path.join(root,'[id]/page.tsx');if(fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes('GENERATED LMS BROWSER VERIFICATION ONLY')){fs.unlinkSync(file);fs.rmdirSync(path.join(root,'[id]'));fs.rmdirSync(root);}});
