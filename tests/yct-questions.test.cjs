const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const ts=require('typescript');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.resolve('src',name.slice(2)):name,...args);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {pinyinAllowed,pinyinSegments}=require('../src/lib/question-pinyin.ts');const {QuestionText,QuestionPinyinContext}=require('../src/components/question-visuals.tsx');const {isManualMedia}=require('../src/components/question-manual-response.tsx');const {validateQuestionDefinition,questionIsAnswered}=require('../src/lib/question-schema.ts');
test('Pinyin is suppressed wherever it gives away the exercise',()=>{
 for(const q of [{type:'pinyin_choice',content:{}},{type:'hanzi_pinyin',content:{}},{type:'reorder',content:{require_pinyin:true}},{type:'matching',content:{prompt:'Nối phiên âm',right:['ni hao']}},{type:'multi_matching',content:{columns:[{label:'Phiên âm'}]}},{type:'multiple_choice',content:{pinyin_mode:'hidden'}}])assert.equal(pinyinAllowed(q),false);
 assert.equal(pinyinAllowed({type:'multiple_choice',content:{prompt:'你叫什么？'}}),true);
 const parts=pinyinSegments('她的头发很长。现在睡觉。');assert(parts.some(x=>x.text==='长'&&x.pinyin==='cháng'));assert(parts.some(x=>x.text==='睡觉'&&x.pinyin==='shuìjiào'));assert(!parts.find(x=>x.text==='。').pinyin);
});
test('Ruby annotations can be toggled without changing the Hanzi',()=>{
 const rendered=show=>renderToStaticMarkup(React.createElement(QuestionPinyinContext.Provider,{value:{show}},React.createElement(QuestionText,{text:'你好！'})));
 assert.match(rendered(true),/<ruby(?:\s[^>]*)?>/);assert.match(rendered(true),/<rt/);assert.equal(rendered(false),'你好！');
});
test('Picture choices keep alignment and reject invalid asset references',()=>{
 const q={type:'multiple_choice',content:{options:['Tranh A','Tranh B'],option_images:[{url:'https://example.com/a.webp',alt:'Tranh A'},null]},answer:'A'};validateQuestionDefinition(q);
 assert.throws(()=>validateQuestionDefinition({...q,content:{...q.content,option_images:[null]}}),/khớp/);
 assert.throws(()=>validateQuestionDefinition({...q,content:{...q.content,image:{url:'javascript:alert(1)',alt:'Tranh'}}}),/HTTPS/);
});
test('Paragraph ordering stays incomplete until all original sentences are present',()=>{
 const q={type:'essay',content:{prompt:'Xếp đoạn',response_mode:'ordering',tokens:['我是学生。','我学习汉语。']},answer:['Giáo viên chấm theo tính liên kết.']};validateQuestionDefinition(q);
 assert.equal(questionIsAnswered(q,'["我是学生。"]'),false);assert.equal(questionIsAnswered(q,'["我是学生。","我是学生。"]'),false);assert.equal(questionIsAnswered(q,'["我学习汉语。","我是学生。"]'),true);
});
test('Student media accepts bounded image/audio data and rejects other data types',()=>{
 assert(isManualMedia('data:image/jpeg;base64,YQ=='));assert(isManualMedia('data:audio/webm;base64,YQ=='));assert(!isManualMedia('data:image/svg+xml;base64,YQ=='));assert(!isManualMedia('data:text/html;base64,YQ=='));assert(!isManualMedia('data:image/png;base64,'+'A'.repeat(2800000)));
});
