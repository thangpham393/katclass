// Run with: node tools/hsk1-import/test-migrations.mjs /path/to/pglite/dist/index.js
// Exercises actual PostgreSQL, in memory. Never connects to Supabase.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
process.on('uncaughtException', error => { console.error(error.message); process.exit(1); });
const json = value => value === null ? null : JSON.stringify(value);

const { PGlite } = await import(pathToFileURL(path.resolve(process.argv[2])));
const db = new PGlite();
const migration = fs.readFileSync('supabase/migrations/0049_written_exercise_types.sql', 'utf8');
const upgrade = fs.readFileSync('supabase/migrations/0050_hsk1_native_exercises.sql', 'utf8');
const [changes, obsolete, unchanged] = [...upgrade.matchAll(/\$hsk_upgrade\$([\s\S]*?)\$hsk_upgrade\$/g)].map(m => JSON.parse(m[1]));
const payload = JSON.parse(fs.readFileSync('supabase/library/hsk1-new30-baitap.json', 'utf8'));
const student = '00000000-0000-0000-0000-000000000001';
const cls = '00000000-0000-0000-0000-000000000002';
const hw = '00000000-0000-0000-0000-000000000003';
const textbook = '00000000-0000-0000-0000-000000000004';
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ?
  Object.fromEntries(Object.keys(value).sort().map(k => [k, ordered(value[k])])) : value;
function questionId(lessonId, question) {
  const namespace = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
  const fingerprint = lessonId + '|' + question.type + '|' + JSON.stringify(ordered(question.content));
  const bytes = createHash('sha1').update(namespace).update('classhub-hsk1-pdf|' + fingerprint).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
await db.exec(`
create role anon; create role authenticated;
create table public.textbooks(id uuid primary key,code text);
create table public.lessons(id uuid primary key,textbook_id uuid references textbooks(id),unit int);
create table public.questions(id uuid primary key default gen_random_uuid(),type text not null
  constraint questions_type_check check(type in('multiple_choice','fill_blank','matching','reorder','listening','pinyin_choice','reading')),
  content jsonb not null,level text,tags text[] not null default '{}',lesson_id uuid references lessons(id),created_by uuid,
  is_test_snapshot boolean not null default false);
create table public.question_answers(question_id uuid primary key references questions(id),answer jsonb not null);
create table public.homeworks(id uuid primary key,class_id uuid,title text,kind text,time_limit_minutes int);
create table public.class_students(class_id uuid,student_id uuid);
create table public.test_attempts(homework_id uuid,student_id uuid,started_at timestamptz);
create table public.homework_questions(homework_id uuid references homeworks(id),question_id uuid references questions(id),sort int);
create table public.test_templates(id uuid primary key,question_ids uuid[] not null);
create table public.submissions(id uuid primary key default gen_random_uuid(),homework_id uuid references homeworks(id),student_id uuid,
  answers jsonb,auto_score numeric,score numeric,status text,submitted_at timestamptz default now(),unique(homework_id,student_id));
create function public.my_profile_id() returns uuid language sql as $$ select nullif(current_setting('app.student_id',true),'')::uuid $$;
create function public.submit_homework(hw_id uuid,my_answers jsonb) returns public.submissions language plpgsql as $$ begin return null; end $$;
revoke all on function public.submit_homework(uuid,jsonb) from public,anon;
grant execute on function public.submit_homework(uuid,jsonb) to authenticated;
`);
await db.query('insert into textbooks values($1,$2)', [textbook, 'hsk1-new30']);
const lessonIds = new Map(changes.map(q => [q.new_content.source.unit, q.lesson_id]));
for (const [unit, id] of lessonIds) await db.query('insert into lessons values($1,$2,$3)', [id, textbook, unit]);
const baseline = [...changes.map(q => ({ id: q.old_id, type: q.old_type, content: q.old_content, answer: q.old_answer, lesson_id: q.lesson_id })),
  ...obsolete.map(q => ({ ...q, lesson_id: lessonIds.get(q.content.source.unit) }))];
for (const lesson of payload.lessons) for (const q of lesson.questions) {
  const id = questionId(lessonIds.get(lesson.unit), q);
  if (unchanged.includes(id)) baseline.push({ ...q, id, lesson_id: lessonIds.get(lesson.unit) });
}
assert.equal(baseline.length, 584, 'baseline reconstructed from actual legacy SQL and payload');
for (const q of baseline) {
  await db.query('insert into questions(id,type,content,level,tags,lesson_id,created_by) values($1,$2,$3,$4,$5,$6,$7)',
    [q.id, q.type, json(q.content), 'HSK1', ['hsk1-new30','hsk1-pdf-worksheets'], q.lesson_id, student]);
  await db.query('insert into question_answers values($1,$2)', [q.id, json(q.answer)]);
}
const referenced = changes.find(q => q.new_type === 'translation');
await db.query('insert into homeworks values($1,$2,$3,$4,$5)', [hw, cls, 'Existing assignment', 'homework', null]);
await db.query('insert into class_students values($1,$2)', [cls,student]);
await db.query('insert into homework_questions values($1,$2,0)', [hw,referenced.old_id]);
await db.query('insert into test_templates values(gen_random_uuid(),$1)', [[obsolete[0].id]]);
await db.exec(migration);
console.log('PASS: migration 0049 executes on PostgreSQL with legacy schema');

async function grade(type, content, expected, actual, total, correct) {
  const { rows } = await db.query('select * from grade_question_answer($1,$2,$3,$4)', [type,json(content),json(expected),json(actual)]);
  assert.deepEqual(rows[0], { total,correct }, `${type}: ${JSON.stringify(actual)}`);
}
await grade('translation', {}, ['没关系。','没事。'], ' 没 事！ ', 1,1);
await grade('translation', {}, ['没关系。'], '谢谢', 1,0);
await grade('translation', {}, ['你好'], ['你好'], 1,0);
await grade('translation', {}, ['你好'], null, 1,0);
await grade('translation', {}, ['你好'], '！！', 1,0);
await grade('hanzi_pinyin', {}, { hanzi:'你好！',pinyin:'Nǐ hǎo!' }, { hanzi:'你 好',pinyin:'nǐhǎo' }, 2,2);
await grade('hanzi_pinyin', {}, { hanzi:'你好',pinyin:'Nǐ hǎo' }, { hanzi:'你好',pinyin:'Ni hao' }, 2,1);
await grade('hanzi_pinyin', {}, { hanzi:'你好',pinyin:'Nǐ hǎo' }, { hanzi:'你好',pinyin:'Nǐ hǎo'.normalize('NFD') }, 2,2);
await grade('hanzi_pinyin', {}, { hanzi:'女',pinyin:'nǚ' }, { hanzi:'女',pinyin:'nǔ' }, 2,1);
await grade('reorder', { require_pinyin:true }, { hanzi:'你们好！',pinyin:'Nǐmen hǎo!' }, { hanzi:'你们好',pinyin:'' }, 2,1);
await grade('matching', {}, { '0':'a','1':'j','2':'b' }, { '0':'a','1':'a','2':'b','999':'b' }, 3,2);
await grade('multi_matching', {}, { '0:0':'a','0:1':'b','1:0':'b','1:1':'a' }, { '0:0':'a','0:1':'b' }, 4,2);
await grade('reading', {}, { '0':'A','1':'C' }, { '0':'A','1':'B' }, 2,1);
await grade('fill_blank', {}, ['的'], ['的'], 1,1);
await grade('fill_blank', {}, ['的'], [' 的 '], 1,0);
await grade('reorder', {}, ['你','好'], ['好','你'], 1,0);
for (const type of ['multiple_choice','pinyin_choice','listening']) await grade(type, {}, 'B','B',1,1);
console.log('PASS: variants, Unicode normalization, tone distinctions, partial credit and legacy grading');

await db.exec('set role authenticated');
await assert.rejects(() => db.query('select * from grade_question_answer($1,$2,$3,$4)', ['translation',json({}),json(['你好']),json('你好')]), /permission denied/);
await db.exec('reset role');
await db.query("select set_config('app.student_id',$1,false)", [student]);
await assert.rejects(() => db.query('select submit_homework($1,$2)', [hw,json([])]), /danh sách câu trả lời/);
await db.query("select set_config('app.student_id',$1,false)", ['00000000-0000-0000-0000-000000000999']);
await assert.rejects(() => db.query('select submit_homework($1,$2)', [hw,json({})]), /không có quyền/);
await db.query("select set_config('app.student_id',$1,false)", [student]);
const previousAnswers = { [referenced.old_id]: referenced.old_answer };
await db.query('select submit_homework($1,$2)', [hw,json(previousAnswers)]);
const beforeSubmission = (await db.query('select * from submissions')).rows;

await db.exec(upgrade);
const active = (await db.query('select q.*,a.answer from questions q join question_answers a on a.question_id=q.id where not is_test_snapshot')).rows;
assert.equal(active.length,565);
const actualByIdentity = new Map(active.map(q => [JSON.stringify([q.content.source.unit,q.content.source.section,q.content.source.numbers]),q]));
for (const lesson of payload.lessons) for (const q of lesson.questions) {
  const stored = actualByIdentity.get(JSON.stringify([lesson.unit,q.content.source.section,q.content.source.numbers]));
  assert.equal(stored.type,q.type);
  assert.deepEqual(stored.content,q.content);
  assert.deepEqual(stored.answer,q.answer);
}
const snapshot = (await db.query('select q.*,a.answer from questions q join question_answers a on a.question_id=q.id where q.id=$1', [referenced.old_id])).rows[0];
assert.equal(snapshot.is_test_snapshot,true);
assert.deepEqual(snapshot.content,referenced.old_content);
assert.deepEqual(snapshot.answer,referenced.old_answer);
assert.equal((await db.query('select question_id from homework_questions')).rows[0].question_id,referenced.old_id);
assert.deepEqual((await db.query('select * from submissions')).rows,beforeSubmission);
assert.deepEqual((await db.query('select question_ids from test_templates')).rows[0].question_ids,[obsolete[0].id]);
console.log('PASS: 0050 upgrades all 565 records; previous assignment, submission and test template remain intact');
await db.exec(upgrade);
assert.equal((await db.query('select count(*)::int as n from questions where not is_test_snapshot')).rows[0].n,565);
console.log('PASS: re-running 0050 creates no duplicates');

// Exercise the real submission RPC with all native question/answer formats.
const nativeHw = '00000000-0000-0000-0000-000000000006';
await db.query('insert into homeworks values($1,$2,$3,$4,$5)', [nativeHw,cls,'All native exercises','homework',null]);
const nativeAnswers = {};
let expectedPoints = 0;
for (const [i,q] of active.entries()) {
  await db.query('insert into homework_questions values($1,$2,$3)', [nativeHw,q.id,i]);
  nativeAnswers[q.id] = q.type === 'translation' ? q.answer[0] : q.answer;
  const grading = (await db.query('select * from grade_question_answer($1,$2,$3,$4)',
    [q.type,json(q.content),json(q.answer),json(nativeAnswers[q.id])])).rows[0];
  assert.equal(grading.correct,grading.total,`Model answer must score fully: ${q.id}`);
  expectedPoints += grading.total;
}
await db.query('select submit_homework($1,$2)',[nativeHw,json(nativeAnswers)]);
assert.equal(Number((await db.query('select auto_score from submissions where homework_id=$1',[nativeHw])).rows[0].auto_score),10);
const missing = active.find(q => q.type === 'multi_matching');
delete nativeAnswers[missing.id];
await db.query('select submit_homework($1,$2)',[nativeHw,json(nativeAnswers)]);
assert.equal(Number((await db.query('select auto_score from submissions where homework_id=$1',[nativeHw])).rows[0].auto_score),
  Math.round((expectedPoints-Object.keys(missing.answer).length)*100/expectedPoints)/10);
console.log(`PASS: submit_homework grades all 565 model answers and weighs ${expectedPoints} individual answer units`);

// Editing a native answer makes the migration reject and roll back instead of overwriting it.
const inplace = changes.find(q => q.old_id !== referenced.old_id);
await db.query('update question_answers set answer=$1 where question_id=$2', [json('Teacher edit'),inplace.old_id]);
await assert.rejects(() => db.exec(upgrade), /đã thay đổi/);
await db.exec('rollback');
assert.equal((await db.query('select answer from question_answers where question_id=$1',[inplace.old_id])).rows[0].answer,'Teacher edit');
console.log('PASS: teacher edits cause migration rollback');

// Timed test rules must still apply after replacing the scorer.
const timed = '00000000-0000-0000-0000-000000000005';
await db.query('insert into homeworks values($1,$2,$3,$4,$5)', [timed,cls,'Timed test','test',10]);
await assert.rejects(() => db.query('select submit_homework($1,$2)', [timed,json({})]), /chưa bắt đầu/);
await db.query("insert into test_attempts values($1,$2,now()-interval '12 minutes')", [timed,student]);
await assert.rejects(() => db.query('select submit_homework($1,$2)', [timed,json({})]), /hết giờ/);
await db.query('update test_attempts set started_at=now() where homework_id=$1',[timed]);
await db.query('select submit_homework($1,$2)', [timed,json({})]);
await assert.rejects(() => db.query('select submit_homework($1,$2)', [timed,json({})]), /một lần/);
console.log('PASS: timed tests require a start, enforce the deadline and reject a second submission');
await db.close();
