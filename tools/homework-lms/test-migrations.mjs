// PostgreSQL integration tests, in memory; never contacts the live database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(path.resolve(process.argv[2])));
const db = new PGlite();
const j = value => value == null ? null : JSON.stringify(value);
const student = '00000000-0000-0000-0000-000000000001';
const cls = '00000000-0000-0000-0000-000000000002';
const teacher = '00000000-0000-0000-0000-000000000003';
const hw = '00000000-0000-0000-0000-000000000004';
const essayId = '00000000-0000-0000-0000-000000000005';
const choiceId = '00000000-0000-0000-0000-000000000006';
await db.exec(`
create role anon; create role authenticated;
create table questions(id uuid primary key,type text constraint questions_type_check check(type in('multiple_choice','translation')),content jsonb);
create table question_answers(question_id uuid primary key references questions(id),answer jsonb);
create table classes(id uuid primary key,teacher_id uuid);
create table class_students(class_id uuid,student_id uuid);
create table homeworks(id uuid primary key,class_id uuid,kind text,time_limit_minutes int,manual_tasks text[] default '{}',teacher_note text default '');
create table homework_questions(homework_id uuid,question_id uuid references questions(id),sort int default 0);
create table test_attempts(homework_id uuid,student_id uuid,started_at timestamptz);
create table submissions(id uuid default gen_random_uuid(),homework_id uuid,student_id uuid,answers jsonb,auto_score numeric,score numeric,status text,submitted_at timestamptz default now(),graded_at timestamptz,graded_by uuid,unique(homework_id,student_id));
create function my_profile_id() returns uuid language sql as $$ select nullif(current_setting('app.profile',true),'')::uuid $$;
create function has_perm(perm text) returns boolean language sql as $$ select false $$;
create function submit_homework(hw_id uuid,my_answers jsonb) returns submissions language plpgsql as $$ begin return null; end $$;
`);
await db.exec(fs.readFileSync('supabase/migrations/0049_written_exercise_types.sql','utf8'));
const migration = fs.readFileSync('supabase/migrations/0051_hsk2_written_and_manual_exercises.sql','utf8');
await db.exec(migration);
await db.exec(migration);
const reviewMigration = fs.readFileSync('supabase/migrations/0052_homework_review_and_pinyin.sql','utf8');
await db.exec(reviewMigration);
await db.exec(reviewMigration);
console.log('PASS: migrations 0051 and 0052 apply twice');
async function grade(q, actual, total, correct) {
  const {rows} = await db.query('select * from grade_question_answer($1,$2,$3,$4)',[q.type,j(q.content),j(q.answer),j(actual)]);
  assert.deepEqual(rows[0], {total,correct},j(q.content.source));
}
const payload = JSON.parse(fs.readFileSync('supabase/library/hsk2-new30-baitap.json','utf8'));
let count=0;
for (const lesson of payload.lessons) for (const q of lesson.questions) {
  const actual = ['translation','sentence_correction','essay'].includes(q.type) ? q.answer[0] : q.answer;
  const total = q.type === 'essay' ? 0 : q.type === 'hanzi_pinyin' ? 2 : 1;
  await grade(q,actual,total,total);
  count++;
}
await grade({type:'essay',content:{},answer:['Mẫu']},'Bài hoàn toàn khác',0,0);
await grade({type:'sentence_correction',content:{},answer:['我没去过中国。']},'我 没 去 过 中 国!',1,1);
await grade({type:'sentence_correction',content:{},answer:['我没去过中国。']},'我不去过中国',1,0);
await grade({type:'hanzi_pinyin',content:{},answer:{hanzi:'快乐',pinyin:'kuàilè'}},{hanzi:'快乐',pinyin:'kuaile'},2,2);
console.log(`PASS: all ${count} source answers grade, essay samples excluded; wrong and partial answers checked`);
await db.query('insert into classes values($1,$2)',[cls,teacher]);
await db.query('insert into class_students values($1,$2)',[cls,student]);
await db.query("insert into homeworks(id,class_id,kind,time_limit_minutes) values($1,$2,'homework',30)",[hw,cls]);
await db.query("insert into questions values($1,'essay',$2),($3,'multiple_choice',$4)",[essayId,j({prompt:'Viết tự do'}),choiceId,j({options:['A','B']})]);
await db.query('insert into question_answers values($1,$2),($3,$4)',[essayId,j(['Mẫu']),choiceId,j('A')]);
await db.query('insert into homework_questions values($1,$2),($1,$3)',[hw,essayId,choiceId]);
await db.query("select set_config('app.profile',$1,false)",[teacher]);
await assert.rejects(()=>db.query('select grade_manual_homework($1,$2,8)',[hw,student]),/chưa nộp/);
await db.query("select set_config('app.profile',$1,false)",[student]);
const answers={[essayId]:'Bài viết riêng của học viên',[choiceId]:'A'};
let sub=(await db.query('select (submit_homework($1,$2)).*',[hw,j(answers)])).rows[0];
assert.equal(Number(sub.auto_score),10);assert.equal(sub.score,null);assert.equal(sub.status,'submitted');
await assert.rejects(()=>db.query('select grade_manual_homework($1,$2,8)',[hw,student]),/quyền/);
await db.query("select set_config('app.profile',$1,false)",[teacher]);
for (const score of [-1,11,null]) await assert.rejects(()=>db.query('select grade_manual_homework($1,$2,$3)',[hw,student,score]),/0 đến 10/);
await assert.rejects(()=>db.query('select grade_manual_homework($1,$2,8)',[hw,teacher]),/không thuộc lớp/);
sub=(await db.query('select (grade_manual_homework($1,$2,8)).*',[hw,student])).rows[0];
assert.equal(Number(sub.score),8);assert.equal(Number(sub.auto_score),10);assert.equal(sub.status,'graded');assert.deepEqual(sub.answers,answers);assert.equal(sub.graded_by,teacher);
await db.query("select set_config('app.profile',$1,false)",[student]);
sub=(await db.query('select (submit_homework($1,$2)).*',[hw,j({...answers,[choiceId]:'B'})])).rows[0];
assert.equal(sub.status,'submitted');assert.equal(sub.score,null);assert.equal(sub.graded_by,null);assert.equal(Number(sub.auto_score),0);
await db.query('delete from homework_questions where question_id=$1',[choiceId]);
sub=(await db.query('select (submit_homework($1,$2)).*',[hw,j(answers)])).rows[0];
assert.equal(sub.auto_score,null);assert.equal(sub.score,null);assert.equal(sub.status,'submitted');
console.log('PASS: mixed and essay-only submissions, teacher-only final grading, preserved answers/auto score, resubmission resets review');
await db.query("update homeworks set kind='test' where id=$1",[hw]);
await assert.rejects(()=>db.query('select submit_homework($1,$2)',[hw,j(answers)]),/chưa bắt đầu/);
await db.query('delete from submissions');
await db.query('insert into test_attempts values($1,$2,now()-interval \'40 minutes\')',[hw,student]);
await assert.rejects(()=>db.query('select submit_homework($1,$2)',[hw,j(answers)]),/hết giờ/);
await db.query('update test_attempts set started_at=now()');
await db.query('select submit_homework($1,$2)',[hw,j(answers)]);
await assert.rejects(()=>db.query('select submit_homework($1,$2)',[hw,j(answers)]),/một lần/);
await db.query("select set_config('app.profile',$1,false)",[teacher]);
await assert.rejects(()=>db.query('select submit_homework($1,$2)',[hw,j(answers)]),/quyền nộp/);
await db.exec('set role authenticated');
await assert.rejects(()=>db.query('select * from grade_question_answer($1,$2,$3,$4)',['essay',j({}),j(['Mẫu']),j('Mẫu')]),/permission denied/);
console.log('PASS: test clock, membership, one submission, private grading helpers');

await db.exec('reset role');
for (const [expected, variants] of [
  ['Nǐ hǎo!', ['ni hao', 'NIHAO', 'ni3 hao3', 'nǐ hao', 'ni hǎo', 'ni3hǎo']],
  ['nǚ lǜ', ['nu: lu:', 'nv lv', 'nü lü', 'nu:3 lv4', 'nü lǜ', 'nu\u0308 lu\u0308']],
  ['xīān', ["xi an", "xi'an", 'xi1an1']],
]) {
  for (const actual of variants) {
    const result = (await db.query('select pinyin_answer_matches($1,$2) as ok',[j(expected),j(actual)])).rows[0];
    assert.equal(result.ok,true,`${expected} / ${actual}`);
  }
}
for (const actual of ['', 'ni hai', 'nu lu', 'ni6 hao', {pinyin:'ni hao'}, null]) {
  assert.equal((await db.query('select pinyin_answer_matches($1,$2) as ok',[j('Nǐ hǎo'),j(actual)])).rows[0].ok,false);
}
await grade({type:'pinyin_choice',content:{options:['nǐ','ní']},answer:'A'},'B',1,0);
await grade({type:'hanzi_pinyin',content:{},answer:{hanzi:'女',pinyin:'nǚ'}},{hanzi:'女',pinyin:'nu'},2,1);
await grade({type:'reorder',content:{require_pinyin:true},answer:{hanzi:'你好',pinyin:'nǐ hǎo'}},{hanzi:'你好',pinyin:'ni3 hao3'},2,2);
console.log('PASS: optional/partial tones, numbered tones, joined Pinyin, umlaut equivalence; wrong phonemes and Pinyin choices stay wrong');

await db.query("update homeworks set kind='homework' where id=$1",[hw]);
await db.query('insert into homework_questions values($1,$2,1)',[hw,choiceId]);
await db.query("select set_config('app.profile',$1,false)",[student]);
sub = (await db.query('select (submit_homework($1,$2)).*',[hw,j({[choiceId]:'B'})])).rows[0];
assert.equal(Number(sub.auto_score),0);assert.equal(sub.status,'submitted');
assert.equal(sub.review.length,2);
let detail = (await db.query('select get_homework_review($1) as r',[hw])).rows[0].r;
assert.equal(detail.legacy,false);
assert.equal(detail.questions.find(q=>q.type==='essay').parts[0].expected,null);
assert.equal(detail.questions.find(q=>q.type==='multiple_choice').parts[0].expected,'A');
assert.equal(detail.questions.find(q=>q.type==='multiple_choice').parts[0].actual,'B');
assert.equal(detail.questions.find(q=>q.type==='multiple_choice').parts[0].correct,false);
const originalReview = detail;
await db.query('update question_answers set answer=$2 where question_id=$1',[choiceId,j('B')]);
detail = (await db.query('select get_homework_review($1) as r',[hw])).rows[0].r;
assert.deepEqual(detail,originalReview,'Review must be immutable when teacher edits later');
await db.query("select set_config('app.profile',$1,false)",[teacher]);
await assert.rejects(()=>db.query('select get_homework_review($1)',[hw]),/nộp bài trước/);
await db.query("select set_config('app.profile','',false)");
await assert.rejects(()=>db.query('select get_homework_review($1)',[hw]),/nộp bài trước/);
await db.query("select set_config('app.profile',$1,false)",[student]);
sub = (await db.query('select (submit_homework($1,$2)).*',[hw,j({})])).rows[0];
assert.equal(Number(sub.auto_score),0,'Empty submission is allowed and receives zero automatic points');
assert.equal(sub.review.find(q=>q.type==='multiple_choice').parts[0].reason,'Bạn bỏ trống phần này nên chưa có điểm.');
await db.query('update submissions set review=null');
detail = (await db.query('select get_homework_review($1) as r',[hw])).rows[0].r;
assert.equal(detail.legacy,true);
assert.equal(Number((await db.query('select auto_score from submissions')).rows[0].auto_score),0);
const legacy = (await db.query('select build_question_review($1,$2,$3,$4,true) as r',['hanzi_pinyin',j({}),j({hanzi:'快乐',pinyin:'kuàilè'}),j({hanzi:'快乐',pinyin:'kuaile'})])).rows[0].r;
assert.equal(legacy.correct,1);
await db.exec('set role authenticated');
await db.query('select get_homework_review($1)',[hw]);
for (const sql of ["select normalize_pinyin_answer('ni')", "select pinyin_answer_matches('\"ni\"','\"ni\"')", "select build_homework_review(null,'{}',false)", "select build_question_review('essay','{}','null','null',false)"])
  await assert.rejects(()=>db.query(sql),/permission denied/);
await db.exec('reset role');
console.log('PASS: incomplete/empty submissions; own review only, immutable answer snapshot, essays excluded, legacy scores unchanged, private helper access');
let all = 0;
for (const filename of fs.readdirSync('supabase/library').filter(f=>f.includes('hsk')&&f.endsWith('.json'))) {
  const payload=JSON.parse(fs.readFileSync(path.join('supabase/library',filename),'utf8'));
  for (const lesson of payload.lessons) for (const q of lesson.questions ?? []) {
    const actual=['translation','sentence_correction','essay'].includes(q.type)?q.answer[0]:q.answer;
    const detail=(await db.query('select build_question_review($1,$2,$3,$4) as r',[q.type,j(q.content),j(q.answer),j(actual)])).rows[0].r;
    assert.equal(detail.correct,detail.total,`${filename}: ${j(q.content)}`);
    assert(detail.parts.length>0,filename);
    all++;
  }
}
console.log(`PASS: grading and detailed review for all ${all} HSK questions in checked-in payloads`);
await db.close();
