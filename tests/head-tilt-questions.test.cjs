const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { makeTiltQuestions } = require('../src/lib/head-tilt-questions.ts');
const vocab = [['冷','lěng','Lạnh'],['热','rè','Nóng'],['天气','tiānqì','Thời tiết']]
  .map(([hanzi,pinyin,meaning],i)=>({id:String(i),hanzi,pinyin,meaning}));

test('Every word has both translation directions and a correctly graded true/false question', () => {
  for (const random of [() => .1, () => .9, Math.random]) {
    const questions = makeTiltQuestions(vocab,random);
    assert.equal(questions.length,9);
    for (const word of vocab) {
      const rounds=questions.filter(q=>q.word.id===word.id);
      assert.deepEqual(rounds.map(q=>q.kind).sort(),['true_false','vi_zh','zh_vi']);
      for(const q of rounds) {
        const answer=q.options[q.correctIndex], wrong=q.options[1-q.correctIndex];
        assert.notEqual(answer.text,wrong.text);
        if(q.kind==='vi_zh') assert.equal(answer.text,word.hanzi);
        if(q.kind==='zh_vi') {
          assert.equal(answer.text,word.meaning);
          assert.equal(answer.pinyin,undefined,'Vietnamese options must not expose the Chinese answer');
        }
        if(q.kind==='true_false') assert.equal(answer.text,q.statementMeaning===word.meaning?'Đúng':'Sai');
        assert.match(q.explanation,new RegExp(word.hanzi));
        assert.ok(q.explanation.includes(word.meaning));
      }
    }
    assert.deepEqual(new Set(questions.filter(q=>q.kind==='true_false').map(q=>q.options[q.correctIndex].text)),new Set(['Đúng','Sai']));
  }
});

test('Duplicate hanzi, blank entries and identical meanings do not create ambiguous choices', () => {
  const words=[...vocab,{...vocab[0],id:'duplicate'}, {id:'blank',hanzi:' ',meaning:''}, {id:'cold',hanzi:'凉',pinyin:'liáng',meaning:'  lạnh  '}];
  const questions=makeTiltQuestions(words);
  assert.equal(questions.length,12);
  for(const q of questions.filter(q=>q.kind==='vi_zh')) {
    const wrong=q.options[1-q.correctIndex];
    assert.notEqual(wrong.reveal.trim().toLowerCase(),q.word.meaning.trim().toLowerCase());
  }
  assert.deepEqual(makeTiltQuestions([vocab[0]]),[]);
  assert.deepEqual(makeTiltQuestions([vocab[0],{...vocab[0],id:'cold',hanzi:'凉',meaning:' lạnh '}]),[]);
  assert.deepEqual(makeTiltQuestions([]),[]);
});
