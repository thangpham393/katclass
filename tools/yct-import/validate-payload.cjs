const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const Module=require('node:module');const ts=require('typescript');const crypto=require('node:crypto');
const filename=path.resolve('src/lib/question-schema.ts');const m=new Module(filename);m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
const root='tools/yct-import/';const payload=JSON.parse(fs.readFileSync('supabase/library/yct-workbooks.json'));const inv=JSON.parse(fs.readFileSync(root+'inventory.json'));const manifest=JSON.parse(fs.readFileSync(root+'manifest.json'));const assets=JSON.parse(fs.readFileSync(root+'assets.json'));const pending=JSON.parse(fs.readFileSync(root+'pending.json'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('supabase/library/yct-workbooks.json')).digest('hex'),manifest.payload_sha256);
assert.equal(payload.lessons.length,23);assert.deepEqual(payload.lessons.map(l=>l.level+':'+l.unit).sort(),[...Array.from({length:11},(_,i)=>'YCT1:'+(i+1)),...Array.from({length:12},(_,i)=>'YCT2:'+(i+1))].sort());
const assetURLs=new Set(assets.map(a=>'/workbook-images/'+a.path));const coverage=new Set();let count=0;const itemIDs=new Set();
function source(s){const orig=inv.sections.find(x=>x.id===s.section);assert(orig,s.section);for(const key of ['file','sha256','page','unit'])assert.equal(s[key],orig[key]);assert(s.numbers.length);for(const n of s.numbers){const id=s.section+':'+n;assert(!itemIDs.has(id),id);itemIDs.add(id);}coverage.add(s.section);return orig;}
function images(c){return [c.image,...(c.option_images||[]),...(c.left_images||[]),...(c.right_images||[]),...(c.columns||[]).flatMap(x=>x.images||[]),...(c.items||[]).map(x=>x.image)].filter(Boolean);}
for(const l of payload.lessons)for(const q of l.questions){
 m.exports.validateQuestionDefinition(q);const s=source(q.content.source);assert.equal('YCT'+s.level,l.level);assert.equal(s.unit,l.unit);
 assert(!('answer' in q.content));
 for(const image of images(q.content)){assert(assetURLs.has(new URL(image.url).pathname.slice(new URL(image.url).pathname.indexOf('/workbook-images/'))));assert(!/[\u4e00-\u9fff]/.test(image.alt),'Picture alt must not give the solution');}
 if(['pinyin_choice','hanzi_pinyin'].includes(q.type)||q.content.left_tts||q.type==='multi_matching'&&q.content.columns.some(c=>/phiên âm/i.test(c.label)))assert.equal(q.content.pinyin_mode,'hidden');
 if(q.type==='reorder')assert.notDeepEqual(q.content.tokens,q.answer);
 if(q.content.response_mode==='drawing')assert(q.content.image);
 count++;
}
for(const p of pending){source(p.source);assert(p.reason.length>15);}
for(const entry of manifest.sections){if(['reference','heading','continuation'].includes(entry.status))coverage.add(entry.section);}
assert.deepEqual([...coverage].sort(),inv.sections.map(s=>s.id).sort());assert.equal(new Set(manifest.sections.map(s=>s.section)).size,inv.sections.length);
for(const a of assets){const bytes=fs.readFileSync(root+'work/assets/'+path.basename(a.path));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);assert(a.width>20&&a.height>20);assert(a.bytes<2000000);}
console.log(`PASS ${count} native questions, ${payload.lessons.length} lessons, ${inv.sections.length} accounted sections, ${assets.length} traced crops, ${pending.length} pending records`);
