const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { TiltGesture, eyeRoll } = require('../src/lib/head-tilt.ts');

function arm(gesture) {
  assert.equal(gesture.update(0, false).ready, true);
}

test('Mirrored eye roll uses pixel aspect ratio and maps to the screen direction', () => {
  assert.equal(eyeRoll({ x: .3, y: .4 }, { x: .7, y: .4 }, 640, 480), 0);
  const left = eyeRoll({ x: .3, y: .3 }, { x: .7, y: .5 }, 640, 480);
  assert.ok(Math.abs(left - 20.556) < .01);
  assert.equal(eyeRoll({ x: .3, y: .5 }, { x: .7, y: .3 }, 640, 480), -left);
});

test('Selects immediately on the first tilted frame, once per neutral pose', () => {
  const g = new TiltGesture();
  assert.equal(g.update(25, false).choose, undefined);
  arm(g);
  assert.equal(g.update(14, false).choose, 'left');
  assert.equal(g.update(20, false).choose, undefined);
  assert.equal(g.update(-20, false).choose, undefined);
  arm(g);
  assert.equal(g.update(-14, false).choose, 'right');
});

test('Small movements do not select an answer', () => {
  const g = new TiltGesture();
  arm(g);
  for (const angle of [5, -5, 10, -10, 13.9, -13.9]) assert.equal(g.update(angle, false).choose, undefined);
  assert.equal(g.update(15, false).choose, 'left');
});

test('Missing/multiple faces, answered rounds and a new round all require neutral again', () => {
  for (const interrupt of [(g) => g.update(null, false), (g) => g.update(20, true), (g) => g.update(NaN, false), (g) => g.reset()]) {
    const g = new TiltGesture();
    arm(g);
    interrupt(g);
    assert.equal(g.update(20, false).choose, undefined);
    arm(g);
    assert.equal(g.update(20, false).choose, 'left');
  }
});
