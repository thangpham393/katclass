const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const ts=require('typescript');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.resolve('src',name.slice(2)):name,...args);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {sortWorkbookQuestions,workbookSections}=require('../src/lib/question-order.ts');
const {parseDialogue}=require('../src/lib/question-dialogue.ts');
const {QuestionDialogue}=require('../src/components/question-dialogue.tsx');
const {QuestionText,QuestionPinyinContext}=require('../src/components/question-visuals.tsx');
const {alignPinyin,textWithoutEmbeddedPinyin,pinyinAllowed}=require('../src/lib/question-pinyin.ts');
const {workbookIntro,questionWithoutWorkbookIntro,workbookIntroRows}=require('../src/lib/workbook-intro.ts');
const {questionWordBank,wordBankKey}=require('../src/lib/question-word-bank.ts');
const {reviewStatus,reviewAnswerText}=require('../src/lib/homework-review.ts');
const q=(id,unit,section,number,type='multiple_choice',file='source.pdf')=>({id,type,lesson_id:`lesson-${unit}`,lesson:{unit,title:`Bài ${unit}`,textbook_id:'book'},content:{source:{unit,section,numbers:[number],file}}});
test('Exercise types stay together across source sections, PDFs and lessons',()=>{
 const input=[q('b',2,1,1),q('d',1,2,11,'fill_blank'),q('c',1,1,2,'pinyin_choice'),q('a',1,1,1)];
 assert.deepEqual(sortWorkbookQuestions(input).map(q=>q.id),['a','b','c','d']);assert.deepEqual(input.map(q=>q.id),['b','d','c','a']);
 const groups=workbookSections(input);assert.equal(groups.length,3);assert.deepEqual(groups[0].questions.map(q=>q.id),['a','b']);
 assert(groups.every(group=>group.questions.every(q=>q.type===group.key)));
 const files=[q('1',1,1,1,'multiple_choice','a.pdf'),q('2',1,1,1,'fill_blank','b.pdf'),q('3',1,1,2,'multiple_choice','c.pdf')];
 assert.deepEqual(workbookSections(files).map(g=>g.questions.map(q=>q.id)),[['1','3'],['2']]);
});
test('Legacy source codes from the reported 31-question assignment cannot create singleton sections or a navigation wall',()=>{
 const types=['translation','fill_blank','matching','reorder','pinyin_choice','multiple_choice','essay'];
 const input=Array.from({length:31},(_,i)=>q(`q${i}`,2,`1-${String(14+i%6).padStart(3,'0')}-${i%2+1}`,i+1,types[i%types.length],`page-${i}.pdf`));
 const groups=workbookSections(input);assert.equal(groups.length,7);assert.equal(groups.reduce((n,g)=>n+g.questions.length,0),31);
 assert.equal(new Set(groups.map(g=>g.key)).size,7);assert(groups.every(g=>g.questions.length>=4));
 assert(groups.every(g=>!g.title.includes('1-0')));
 const {WorkbookQuestionList}=require('../src/components/workbook-question-list.tsx');
 const html=renderToStaticMarkup(React.createElement(WorkbookQuestionList,{questions:input,renderQuestion:q=>React.createElement('div',{key:q.id,'data-question':q.id},q.id)}));
 assert.equal((html.match(/<section /g)??[]).length,7);assert.equal((html.match(/data-question=/g)??[]).length,31);
 assert(!html.includes('<nav'));assert(!html.includes('Các phần trong bài'));assert(!html.includes('Phần 1-'));
});
test('Natural source order handles numeric and string section identifiers within each type',()=>{
 const input=[q('10',1,'1-010-2',10),q('2',1,'1-002-1',2),q('1',1,'1-002-1',1)];
 assert.deepEqual(sortWorkbookQuestions(input).map(q=>q.id),['1','2','10']);
 const legacy=[{id:'1',type:'fill_blank',content:{}},{id:'2',type:'multiple_choice',content:{}},{id:'3',type:'fill_blank',content:{}}];
 assert.deepEqual(sortWorkbookQuestions(legacy).map(q=>q.id),['2','1','3']);
});
test('All source-tagged HSK payloads group each type once and retain deterministic source order',()=>{
 for(const filename of fs.readdirSync('supabase/library').filter(f=>f.includes('hsk')&&f.endsWith('.json'))){
  const payload=JSON.parse(fs.readFileSync(path.join('supabase/library',filename)));const input=payload.lessons.flatMap(l=>(l.questions??[]).filter(q=>q.content.source).map((q,i)=>({...q,id:`${l.unit}-${i}`,lesson_id:`${filename}-${l.unit}`,lesson:{unit:l.unit,title:l.title,textbook_id:filename}})));
  const scrambled=input.slice().reverse();const sorted=sortWorkbookQuestions(scrambled);
  assert.deepEqual(sorted.map(q=>q.id),sortWorkbookQuestions(input).map(q=>q.id),filename);
  const groups=workbookSections(scrambled);assert.equal(groups.length,new Set(input.map(q=>q.type)).size,filename);assert(groups.every(g=>g.questions.every(q=>q.type===g.key)),filename);
 }
});
test('Flat source dialogues render as separate turns and retain blank locations and instruction',()=>{
 const text='Hoàn thành lời đáp.\nA:___你有什么打算？ B: 我打算___。 A: 好！';const d=parseDialogue(text);
 assert.equal(d.instruction,'Hoàn thành lời đáp.');assert.deepEqual(d.turns.map(t=>t.speaker),['A','B','A']);assert.equal(d.turns[1].text,'我打算___。');
 assert.equal(parseDialogue('选择正确答案：你好吗？'),null);assert.equal(parseDialogue('Từ 周末 có nghĩa là:'),null);assert.equal(parseDialogue('A：你好！B：你好！')?.turns.length,2);
 const html=renderToStaticMarkup(React.createElement(QuestionDialogue,{text}));assert.match(html,/aria-label="Hội thoại"/);assert.equal((html.match(/aria-label="Người nói/g)??[]).length,3);
});
test('Unlabelled workbook dialogues retain source turns, consecutive sentences and inline blank numbering',()=>{
 const {QuestionInput}=require('../src/components/question-player-input.tsx');
 const lessons=JSON.parse(fs.readFileSync('supabase/library/yct-workbooks.json')).lessons;
 const dialogues=lessons.flatMap(l=>l.questions).filter(q=>q.type==='fill_blank'&&q.content.source?.format==='dialogue');
 assert.equal(dialogues.length,4);
 for(const question of dialogues){
  const lines=question.content.prompt.split('\n');const d=parseDialogue(question.content.prompt);
  assert.equal(d.instruction,lines[0]);assert.deepEqual(d.turns.map(t=>t.text),lines.slice(1));
  assert.deepEqual(d.turns.map(t=>t.speaker),lines.slice(1).map((_,i)=>i%2?'B':'A'));
  const blanks=question.content.prompt.split('___').length-1;
  const html=renderToStaticMarkup(React.createElement(QuestionInput,{question,value:Array.from({length:blanks},(_,i)=>`answer-${i+1}`),onChange:()=>{}}));
  assert.match(html,/aria-label="Hội thoại"/);assert.equal((html.match(/aria-label="Người nói/g)??[]).length,lines.length-1);
  for(let i=1;i<=blanks;i++)assert.match(html,new RegExp(`aria-label="Chỗ trống ${i}"[^>]*value="answer-${i}"`));
 }
 const first=dialogues[0];const d=parseDialogue(first.content.prompt);
 assert.equal(d.turns[1].text,'我___张龙。你呢？');assert.equal(d.turns.length,4);
});
test('Dialogue titles alone and ordinary multiline exercises never invent turns',()=>{
 assert.equal(parseDialogue('Hoàn thành hội thoại. Viết đầy đủ các câu còn thiếu.'),null);
 assert.equal(parseDialogue('Hoàn thành hội thoại:\n你好！'),null);
 assert.equal(parseDialogue('Dịch các câu sau:\n你好！\n谢谢！'),null);
 assert.equal(parseDialogue('Hoàn thành hội thoại: 你好！你好吗？我很好。'),null);
 const d=parseDialogue('Hoàn thành hội thoại:\r\n\r\n你___她吗？\r\n我不认识她。她叫___？\r\n她叫李芳。她是我的老师。');
 assert.equal(d.turns.length,3);assert.equal(d.turns[1].text,'我不认识她。她叫___？');
});
test('Embedded legacy pronunciation is moved above each character; hiding it keeps only original Hanzi',()=>{
 const text='你____什么名字？ nǐ ___ shénme míngzi?';assert.equal(textWithoutEmbeddedPinyin(text),'你____什么名字？');
 assert.deepEqual(alignPinyin('shénme míngzi',4),['shén','me','míng','zi']);assert.deepEqual(alignPinyin('nǚ lǜ',2),['nǚ','lǜ']);
 assert.equal(textWithoutEmbeddedPinyin('Từ 作业 có nghĩa là:'),'Từ 作业 có nghĩa là:');
 const html=renderToStaticMarkup(React.createElement(QuestionPinyinContext.Provider,{value:{show:true}},React.createElement(QuestionText,{text})));
 assert.equal((html.match(/<ruby/g)??[]).length,5);assert.match(html,/你<rt[^>]*>nǐ/);assert(!html.includes('nǐ ___ shénme míngzi?'));
});
test('Review resolves choices and matching columns and differentiates partial, blank and manual work',()=>{
 const detail={type:'multi_matching',content:{columns:[{label:'Pinyin',options:['nǐ','hǎo']},{label:'Nghĩa',options:['bạn','tốt']}]},total:2,correct:1,parts:[{actual:'a'},{actual:null}]};
 assert.equal(reviewStatus(detail),'partial');assert.equal(reviewAnswerText(detail,{key:'0:1'},'b'),'B. tốt');
 assert.equal(reviewStatus({...detail,correct:0,parts:[{actual:null}]}),'skipped');assert.equal(reviewStatus({...detail,total:0}),'manual');
 assert.equal(reviewStatus({...detail,total:1,correct:0,parts:[{actual:'a',correct:true},{actual:'b',correct:false}]}),'partial');
 assert.equal(reviewStatus({...detail,correct:0,parts:[{actual:'  '}]}),'skipped');
 const reading={type:'reading',content:{items:[{type:'short_answer'}]}};assert.equal(reviewAnswerText(reading,{key:'0'},'中国'),'中国');
});
const lessonRows=(lesson,level='HSK3')=>lesson.questions.map((q,i)=>({...q,id:`${level}-${lesson.unit}-${i}`,level,tags:[],lesson_id:`${level}-${lesson.unit}`,lesson:{id:`${level}-${lesson.unit}`,title:lesson.title,unit:lesson.unit,textbook_id:level}}));
const layoutFixture=JSON.parse(fs.readFileSync('tests/fixtures/workbook-layout.json'));
const nativeHsk3=JSON.parse(fs.readFileSync('supabase/library/kat-hsk3-baitap.json'));
const hasNativeHsk3Intros=nativeHsk3.lessons.every(l=>workbookIntro(l.questions[0]));
test('All 20 HSK 3 recaps render separately before unchanged questions, including snapshot views',()=>{
 const {WorkbookQuestionList}=require('../src/components/workbook-question-list.tsx');
 const {QuestionInput}=require('../src/components/question-player-input.tsx');
 const payload=hasNativeHsk3Intros?nativeHsk3:{lessons:layoutFixture.hsk3IntroLessons};
 let count=0;
 for(const lesson of payload.lessons){
  const rows=lessonRows(lesson);const before=JSON.stringify(rows);const intro=workbookIntro(rows[0]);assert(intro);
  assert.equal(rows.filter(row=>workbookIntro(row)).length,1);assert.match(intro.title,new RegExp(`BÀI ${lesson.unit}(?:\\D|$)`));
  const cleaned=rows.map(questionWithoutWorkbookIntro);assert.equal(cleaned[0].content.passage,undefined);
  assert.deepEqual(cleaned.map(row=>[row.id,row.content.prompt,row.content.options,row.answer]),rows.map(row=>[row.id,row.content.prompt,row.content.options,row.answer]));
  const html=renderToStaticMarkup(React.createElement(QuestionPinyinContext.Provider,{value:{show:true}},React.createElement(WorkbookQuestionList,{questions:rows,showPinyin:true,renderQuestion:row=>React.createElement('div',{'data-question-id':row.id},React.createElement(QuestionInput,{question:row,onChange:()=>{}}))})));
  assert.equal((html.match(/aria-label="Nhắc lại kiến thức"/g)??[]).length,1);assert.equal((html.match(/data-question-id=/g)??[]).length,rows.length);
  assert(html.indexOf('aria-label="Nhắc lại kiến thức"')<html.indexOf('id="exercise-section-0"'));
  assert.equal((html.match(/NHẮC LẠI KIẾN THỨC/g)??[]).length,1);assert(!html.includes('<ruby'));assert.equal(JSON.stringify(rows),before);
  count+=rows.length;
 }
 assert.equal(payload.lessons.length,20);assert.equal(count,hasNativeHsk3Intros?800:20);
});
test('Reading passages remain attached; filtered review keeps the separate intro without reintroducing question 1',()=>{
 const reading={type:'reading',content:{passage:'NHẮC LẠI KIẾN THỨC\nĐoạn văn cần trả lời.',items:[]}};
 assert.equal(workbookIntro(reading),null);assert.strictEqual(questionWithoutWorkbookIntro(reading),reading);
 const ordinary={type:'multiple_choice',content:{passage:'Đọc câu sau:\n你好吗？'}};assert.strictEqual(questionWithoutWorkbookIntro(ordinary),ordinary);
 const {WorkbookQuestionList}=require('../src/components/workbook-question-list.tsx');
 const rows=lessonRows(layoutFixture.hsk3Lesson10);
 const html=renderToStaticMarkup(React.createElement(WorkbookQuestionList,{questions:rows.slice(1),introQuestions:[...rows,rows[0]],renderQuestion:q=>React.createElement('div',{'data-question-id':q.id})}));
 assert.equal((html.match(/aria-label="Nhắc lại kiến thức"/g)??[]).length,1);assert.equal((html.match(/data-question-id=/g)??[]).length,39);
 assert.deepEqual(workbookIntroRows('Quy tắc      例子。\nTiếp theo\n\nTừ mới'),[[['Quy tắc','例子。'],['Tiếp theo']],[['Từ mới']]]);
});
test('HSK 3+ always suppresses annotations while Pinyin choices remain actual options',()=>{
 const {QuestionInput}=require('../src/components/question-player-input.tsx');
 const base={id:'level-test',type:'multiple_choice',content:{prompt:'你叫什么？',options:['叫 jiào','是 shì'],pinyin_mode:'auto'},tags:[]};
 for(const level of ['HSK3','HSK 4','HSK5','HSK6','HSK7']){
  const row={...base,level};assert.equal(pinyinAllowed(row),false);
  const html=renderToStaticMarkup(React.createElement(QuestionPinyinContext.Provider,{value:{show:true}},React.createElement(QuestionInput,{question:row,onChange:()=>{}})));
  assert(!html.includes('<ruby'));assert(!html.includes('jiào'));assert(html.includes('叫'));
 }
 for(const level of ['HSK1','HSK2','YCT1','KIDS'])assert.equal(pinyinAllowed({...base,level}),true);
 assert.equal(pinyinAllowed({...base,level:null,tags:['hsk3-new30']}),false);
 const row={...base,level:'HSK3',type:'pinyin_choice',content:{hanzi:'老师',options:['lǎoshī','làoshì']}};
 const html=renderToStaticMarkup(React.createElement(QuestionPinyinContext.Provider,{value:{show:true}},React.createElement(QuestionInput,{question:row,onChange:()=>{}})));
 assert(!html.includes('<ruby'));assert(html.includes('lǎoshī'));assert(html.includes('làoshì'));
 assert.equal((html.match(/<button /g)??[]).length,2,'No pronunciation button gives away Pinyin-choice answers');
});
test('Source word banks in HSK 2, both HSK 3 editions and YCT are parsed without inventing answer choices',()=>{
 for(const example of layoutFixture.bankExamples){const bank=questionWordBank(example.question);assert(bank,example.filename);assert(bank.words.every(word=>example.question.content.hint.includes(word)));}
 // One HSK 3 bank item is deliberately teacher-graded because the source is ambiguous.
 const expected={'hsk1-new30-baitap.json':130,'hsk2-new30-baitap.json':30,'hsk3-new30-baitap.json':170,'yct-workbooks.json':78};
 for(const [file,count] of Object.entries(expected)){
  if(!fs.existsSync(`supabase/library/${file}`))continue;
  const lessons=JSON.parse(fs.readFileSync(`supabase/library/${file}`)).lessons;const qs=lessons.flatMap(l=>l.questions);const banks=qs.filter(q=>questionWordBank(q));
  assert.equal(banks.length,count,file);
  for(const q of banks){const bank=questionWordBank(q);assert(bank.words.every(word=>q.content.hint.includes(word)));assert.equal(bank.remainingHint,'');}
 }
 if(hasNativeHsk3Intros){const banks=nativeHsk3.lessons.flatMap(l=>l.questions).filter(q=>questionWordBank(q));assert(banks.length>=159);const big=banks.filter(q=>questionWordBank(q).words.length===10);assert.equal(big.length,159);}
 assert.equal(questionWordBank({type:'fill_blank',content:{hint:'Động từ nghĩa là “gọi / tên là”'}}),null);
 assert.equal(questionWordBank({type:'fill_blank',content:{hint:'Bổ ngữ 好 & liên từ 那 (Câu 27–32)'}}),null);
 assert.deepEqual(questionWordBank({type:'fill_blank',content:{hint:'问、不、叫、国、没、什、认、也、很、是'}}).words,['问','不','叫','国','没','什','认','也','很','是']);
 for(const [hint,words] of [['CHỌN 又 HAY 再 (Câu 19–26)\nĐiền A. 又 hoặc B. 再 vào chỗ trống cho phù hợp:',['又','再']],['Câu 27–30: điền 跟 / 一样 / 不 vào chỗ trống.',['跟','一样','不']],['Câu 27–29: điền 只有 hoặc 才 vào chỗ trống.',['只有','才']]])assert.deepEqual(questionWordBank({type:'fill_blank',content:{hint}}).words,words);
 const native={type:'fill_blank',content:{prompt:'我___。',word_bank:{words:['学习','工作'],reuse:false}},answer:['学习']};
 require('../src/lib/question-schema.ts').validateQuestionDefinition(native);assert.deepEqual(questionWordBank(native).words,['学习','工作']);
 assert.throws(()=>require('../src/lib/question-schema.ts').validateQuestionDefinition({...native,content:{...native.content,word_bank:{words:[]}}}));
});
test('Shared banks appear once above their source exercise, with separate banks for other lessons/files',()=>{
 const {WorkbookQuestionList}=require('../src/components/workbook-question-list.tsx');
 const rows=lessonRows(layoutFixture.hsk3Lesson10);
 const bankRows=rows.filter(row=>questionWordBank(row));assert.equal(bankRows.length,8);assert.equal(new Set(bankRows.map(wordBankKey)).size,1);
 const html=renderToStaticMarkup(React.createElement(WorkbookQuestionList,{questions:rows,renderQuestion:row=>React.createElement('div',{'data-question-id':row.id},row.content.prompt)}));
 assert.equal((html.match(/aria-label="Từ cho sẵn"/g)??[]).length,1);assert(html.indexOf('aria-label="Từ cho sẵn"')<html.indexOf(`data-question-id="${bankRows[0].id}"`));
 assert.notEqual(wordBankKey({...bankRows[0],lesson_id:'another-lesson'}),wordBankKey(bankRows[0]));
 assert.notEqual(wordBankKey({...bankRows[0],content:{...bankRows[0].content,source:{...bankRows[0].content.source,sha256:'other-hash'}}}),wordBankKey(bankRows[0]));
});
