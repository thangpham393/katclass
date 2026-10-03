const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve('src/lib/question-schema.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const schema = new Module(filename);
schema._compile(compiled, filename);
const { validateQuestionDefinition, questionIsAnswered, questionAnswerPreview, readTokenOrder } = schema.exports;

test('all 565 native worksheet questions validate; original source numbers remain complete', () => {
  const payload = JSON.parse(fs.readFileSync('supabase/library/hsk1-new30-baitap.json', 'utf8'));
  let count = 0, sourceCount = 0;
  for (const lesson of payload.lessons) {
    const covered = new Set();
    for (const q of lesson.questions) {
      validateQuestionDefinition(q);
      q.content.source.numbers.forEach(n => covered.add(n));
      count++;
    }
    const expected = lesson.unit === 1 ? 25 : [2, 3].includes(lesson.unit) ? 50 : 60;
    assert.deepEqual([...covered].sort((a, b) => a-b), Array.from({ length: expected }, (_, i) => i+1));
    sourceCount += covered.size;
  }
  assert.equal(count, 565);
  assert.equal(sourceCount, 785);
  assert.equal(payload.lessons.some(l => l.unit === 7), false);
});

test('all existing textbook JSON question formats remain valid', () => {
  for (const file of fs.readdirSync('supabase/library')) {
    const payload = JSON.parse(fs.readFileSync(path.join('supabase/library', file), 'utf8'));
    for (const lesson of payload.lessons ?? []) for (const q of lesson.questions ?? []) {
      assert.doesNotThrow(() => validateQuestionDefinition(q), `${file}, unit ${lesson.unit}`);
    }
  }
});

test('ten-item matching accepts J; a missing/invalid item remains unanswered', () => {
  const content = { left: Array.from({ length: 10 }, (_, i) => `字${i}`), right: Array.from({ length: 10 }, (_, i) => `meaning ${i}`) };
  const answer = Object.fromEntries(content.left.map((_, i) => [String(i), String.fromCharCode(97+i)]));
  const q = { type: 'matching', content, answer };
  assert.doesNotThrow(() => validateQuestionDefinition(q));
  assert.equal(questionIsAnswered(q, answer), true);
  assert.equal(questionIsAnswered(q, { ...answer, 9: '' }), false);
  assert.throws(() => validateQuestionDefinition({ ...q, answer: { ...answer, 9: 'z' } }));
});

test('three-column matching requires both links on each row and previews column labels', () => {
  const q = { type: 'multi_matching', content: { left: ['你', '好'], columns: [
    { label: 'Pinyin', options: ['nǐ', 'hǎo'] }, { label: 'Nghĩa', options: ['Tốt', 'Bạn'] },
  ] }, answer: { '0:0': 'a', '0:1': 'b', '1:0': 'b', '1:1': 'a' } };
  validateQuestionDefinition(q);
  assert.equal(questionIsAnswered(q, q.answer), true);
  assert.equal(questionIsAnswered(q, { '0:0': 'a', '1:0': 'b' }), false);
  assert.match(questionAnswerPreview(q, q.answer), /Nghĩa/);
});

test('written pair and reorder with Pinyin remain incomplete with just one component', () => {
  const pair = { type: 'hanzi_pinyin', content: { prompt: 'Viết chữ và Pinyin.' }, answer: { hanzi: '你好', pinyin: 'Nǐ hǎo' } };
  validateQuestionDefinition(pair);
  assert.equal(questionIsAnswered(pair, { hanzi: '你好' }), false);
  assert.equal(questionIsAnswered(pair, pair.answer), true);
  const reorder = { type: 'reorder', content: { tokens: ['好', '你'], require_pinyin: true },
    answer: { hanzi: '你好', pinyin: 'Nǐ hǎo', order: '["你","好"]' } };
  validateQuestionDefinition(reorder);
  assert.equal(questionIsAnswered(reorder, { ...reorder.answer, order: '["你"]' }), false);
  assert.equal(questionIsAnswered(reorder, { ...reorder.answer, pinyin: '' }), false);
  assert.equal(questionIsAnswered(reorder, reorder.answer), true);
  assert.deepEqual(readTokenOrder('malformed'), []);
  assert.deepEqual(readTokenOrder('[1]'), []);
});

test('translation variants stay in private answers and display as accepted sentences', () => {
  const q = { type: 'translation', content: { prompt: 'Không sao đâu.' }, answer: ['没事。', '没关系。'] };
  validateQuestionDefinition(q);
  assert.equal(questionIsAnswered(q, '   '), false);
  assert.equal(questionIsAnswered(q, '没事'), true);
  assert.equal(questionAnswerPreview(q, q.answer), '没事。 / 没关系。');
  assert.throws(() => validateQuestionDefinition({ ...q, answer: [] }));
  assert.throws(() => validateQuestionDefinition({ ...q, answer: '没事。' }));
});
