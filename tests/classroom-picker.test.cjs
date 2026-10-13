const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { eligibleStudents, pickStudent, cropRegion } = require('../src/lib/classroom-picker.ts');
const students = [{id:'a'}, {id:'b'}, {id:'c'}];

test('fair rounds exclude called students across modes and start a new round when exhausted', () => {
  assert.deepEqual(eligibleStudents(students, ['a', 'c'], true), [{id:'b'}]);
  assert.deepEqual(eligibleStudents(students, ['a', 'b', 'c'], true), students);
  assert.deepEqual(eligibleStudents(students, ['a'], false), students);
  assert.deepEqual(eligibleStudents([], ['a'], true), []);
  // A departed student cannot suppress a current class member.
  assert.deepEqual(eligibleStudents(students, ['departed'], true), students);
});
test('each eligible student owns an equal random interval; empty pools cannot pick', () => {
  const counts = {a:0,b:0,c:0};
  for (let i=0; i<300; i++) counts[pickStudent(students, () => (i+.5)/300).id]++;
  assert.deepEqual(counts, {a:100,b:100,c:100});
  assert.equal(pickStudent([], () => 0), undefined);
});
test('face crops stay square and inside the original at every edge and zoom coordinate', () => {
  for (const [x,y] of [[0,0],[1000,600],[500,300],[-30,800]]) {
    const r = cropRegion(1000,600,x,y,184);
    assert.equal(r.size,184); assert(r.x>=0 && r.y>=0); assert(r.x+r.size<=1000 && r.y+r.size<=600);
  }
  assert.deepEqual(cropRegion(100,60,80,40,184),{x:40,y:0,size:60});
  // Display coordinates from a translated, 2x-zoomed source resolve to its pixels.
  assert.deepEqual(cropRegion(1000,600,(420-20)/2,(340-40)/2,100),{x:150,y:100,size:100});
});
