const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,file);
const { cumulativeVocabPlan, cumulativeVocabLabel, currentVocabLabel, uniqueClassroomVocab } = require('../src/lib/classroom-vocab-scope.ts');
const lesson=(unit,book='hsk3')=>({id:'lesson-'+unit,unit,textbook_id:book,course_id:'course',textbook:book?{name:book}:null,course:{name:'Khóa học'},vocab:[]});

test('Lesson 11 includes units 1–11 of its textbook, even when course is also present',()=>{
  assert.deepEqual(cumulativeVocabPlan([lesson(11)]),[{field:'textbook_id',id:'hsk3',throughUnit:11,name:'hsk3'}]);
  assert.equal(currentVocabLabel([lesson(11)]),'Bài 11');
  assert.equal(cumulativeVocabLabel([lesson(11)]),'Bài 1–11');
});
test('Multiple assigned lessons use the maximum unit per source and keep textbooks separate',()=>{
  const lessons=[lesson(4),lesson(11),lesson(2,'yct')];
  assert.deepEqual(cumulativeVocabPlan(lessons).map(p=>[p.id,p.throughUnit]),[['hsk3',11],['yct',2]]);
  assert.equal(cumulativeVocabLabel(lessons),'Bài 1–11 · hsk3; Bài 1–2 · yct');
});
test('Legacy course lessons have a scoped fallback; missing numbering/source does not broaden to all vocabulary',()=>{
  assert.deepEqual(cumulativeVocabPlan([lesson(3,null)]),[{field:'course_id',id:'course',throughUnit:3,name:'Khóa học'}]);
  for(const lessons of [[],[lesson(null)],[lesson(0)],[{...lesson(11),textbook_id:null,course_id:null}]]) assert.throws(()=>cumulativeVocabPlan(lessons));
});
test('Repeated vocabulary across lessons counts once even when IDs differ',()=>{
  const first={id:'one',hanzi:'你',meaning:'Bạn'};
  assert.deepEqual(uniqueClassroomVocab([first,{...first,id:'two',hanzi:' 你 '},{id:'three',hanzi:'好'},{id:'blank',hanzi:' '}]),[first,{id:'three',hanzi:'好'}]);
});
