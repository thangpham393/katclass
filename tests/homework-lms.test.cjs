const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const ts=require('typescript');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.resolve('src',name.slice(2)):name,...args);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {sortWorkbookQuestions,workbookSections}=require('../src/lib/question-order.ts');
const {parseDialogue}=require('../src/lib/question-dialogue.ts');
const {QuestionDialogue}=require('../src/components/question-dialogue.tsx');
const {QuestionText,QuestionPinyinContext}=require('../src/components/question-visuals.tsx');
const {alignPinyin,textWithoutEmbeddedPinyin}=require('../src/lib/question-pinyin.ts');
const {reviewStatus,reviewAnswerText}=require('../src/lib/homework-review.ts');
const q=(id,unit,section,number,type='multiple_choice',file='source.pdf')=>({id,type,lesson_id:`lesson-${unit}`,lesson:{unit,title:`Bài ${unit}`,textbook_id:'book'},content:{source:{unit,section,numbers:[number],file}}});
test('Question ordering follows lesson, source section and source number, while retaining mixed types in one source section',()=>{
 const input=[q('b',2,1,1),q('d',1,2,11),q('c',1,1,2,'pinyin_choice'),q('a',1,1,1)];
 assert.deepEqual(sortWorkbookQuestions(input).map(q=>q.id),['a','c','d','b']);assert.deepEqual(input.map(q=>q.id),['b','d','c','a']);
 const groups=workbookSections(sortWorkbookQuestions(input));assert.equal(groups.length,3);assert.deepEqual(groups[0].questions.map(q=>q.id),['a','c']);
 assert.deepEqual(workbookSections(input).flatMap(s=>s.questions).map(q=>q.id),input.map(q=>q.id),'Explicit test order remains unchanged');
});
test('Legacy questions group by type and stable question order; different PDFs never interleave',()=>{
 const legacy=[{id:'1',type:'fill_blank',content:{}},{id:'2',type:'multiple_choice',content:{}},{id:'3',type:'fill_blank',content:{}}];
 assert.deepEqual(sortWorkbookQuestions(legacy).map(q=>q.id),['2','1','3']);
 const files=[q('1',1,1,1,'multiple_choice','a.pdf'),q('2',1,1,1,'multiple_choice','b.pdf'),q('3',1,1,2,'multiple_choice','a.pdf')];
 assert.deepEqual(sortWorkbookQuestions(files).map(q=>q.id),['1','3','2']);
});
test('All source-tagged HSK payloads recover their section/number order after a deterministic scramble',()=>{
 for(const filename of fs.readdirSync('supabase/library').filter(f=>f.includes('hsk')&&f.endsWith('.json'))){
  const payload=JSON.parse(fs.readFileSync(path.join('supabase/library',filename)));const input=payload.lessons.flatMap(l=>(l.questions??[]).filter(q=>q.content.source).map((q,i)=>({...q,id:`${l.unit}-${i}`,lesson_id:`${filename}-${l.unit}`,lesson:{unit:l.unit,title:l.title,textbook_id:filename}})));
  const scrambled=input.slice().reverse();const sorted=sortWorkbookQuestions(scrambled);
  assert.deepEqual(sorted.map(q=>q.id),sortWorkbookQuestions(input).map(q=>q.id),filename);
 }
});
test('Flat source dialogues render as separate turns and retain blank locations and instruction',()=>{
 const text='Hoàn thành lời đáp.\nA:___你有什么打算？ B: 我打算___。 A: 好！';const d=parseDialogue(text);
 assert.equal(d.instruction,'Hoàn thành lời đáp.');assert.deepEqual(d.turns.map(t=>t.speaker),['A','B','A']);assert.equal(d.turns[1].text,'我打算___。');
 assert.equal(parseDialogue('选择正确答案：你好吗？'),null);assert.equal(parseDialogue('Từ 周末 có nghĩa là:'),null);assert.equal(parseDialogue('A：你好！B：你好！')?.turns.length,2);
 const html=renderToStaticMarkup(React.createElement(QuestionDialogue,{text}));assert.match(html,/aria-label="Hội thoại"/);assert.equal((html.match(/aria-label="Người nói/g)??[]).length,3);
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
