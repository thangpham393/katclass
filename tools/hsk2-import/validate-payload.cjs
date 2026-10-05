const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const filename = path.resolve('src/lib/question-schema.ts');
const schema = new Module(filename);
schema._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
const payloadPath = 'supabase/library/hsk2-new30-baitap.json';
const payload = JSON.parse(fs.readFileSync(payloadPath,'utf8'));
const manifest = JSON.parse(fs.readFileSync('tools/hsk2-import/manifest.json','utf8'));
const pending = JSON.parse(fs.readFileSync('tools/hsk2-import/pending.json','utf8'));
const hash = require('node:crypto').createHash('sha256').update(fs.readFileSync(payloadPath)).digest('hex');
assert.equal(hash,manifest.payload_sha256);
assert.equal(payload.lessons.length,15);
const ids = new Set();
let count=0,essayCount=0;
for (const lesson of payload.lessons) {
  const source = manifest.sources.find(s=>s.unit===lesson.unit);
  const imported = new Set();
  for (const q of lesson.questions) {
    schema.exports.validateQuestionDefinition(q);
    const s=q.content.source;
    assert.equal(s.unit,lesson.unit);
    assert.equal(s.sha256,source.sha256);
    assert.equal(s.file,source.file);
    assert.equal(s.numbers.length,1);
    const id = s.section+':'+s.numbers[0];
    assert(!imported.has(id),`Duplicate source ${lesson.unit}:${id}`);
    imported.add(id);ids.add(lesson.unit+':'+id);
    if(q.type==='reorder')assert.notDeepEqual(q.content.tokens,q.answer,'Do not expose order answer in initial tokens');
    if(q.type==='sentence_correction')for(const a of q.answer)assert(!/[A-Za-z]|Đáp|Câu|Dạng/.test(a),`Answer table residue: ${a}`);
    if(q.type==='translation' && q.content.target_language==='zh')for(const a of q.answer)assert(!/[A-Za-z]|Đáp|Câu|Dạng/.test(a),`Answer table residue: ${a}`);
    if(q.type==='fill_blank')assert(!/A\.|B\.|C\./.test(q.content.prompt),'Vocabulary columns leaked into blank question');
    assert(!/DẠNG|BẢNG ĐÁP|ĐÁP ÁN|Câu \d+ -/.test(JSON.stringify(q.content)),'Worksheet headers leaked into prompt');
    if(q.type==='essay'){
      essayCount++;
      assert(Array.isArray(q.answer) && q.answer.length===1);
      assert(!/[A-Za-z]/.test(q.answer[0]),'Essay sample table residue');
      assert.equal(schema.exports.questionIsAnswered(q,''),false);
      assert.equal(schema.exports.questionIsAnswered(q,'Bài viết riêng'),true);
    }
    count++;
  }
  assert.equal(imported.size,source.imported_records);
  const held = pending.filter(p=>p.source.unit===lesson.unit);
  assert.equal(held.length,source.pending_items);
  for(const p of held){
    const id=p.source.section+':'+p.source.numbers[0];assert(!imported.has(id));imported.add(id);
    assert(p.reason?.trim());
  }
  assert.equal(imported.size,source.source_items);
}
assert.equal(count,773);assert.equal(essayCount,10);assert.equal(pending.length,17);
assert.equal(count+pending.length,790);
console.log(`PASS: ${count} questions validate, 790 source items accounted for, ${essayCount} private essay models, ${pending.length} pending`);
