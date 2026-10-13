const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { TiltGesture, eyeRoll } = require('../src/lib/head-tilt.ts');

function arm(gesture, now = 0) {
  gesture.update(0, now, false);
  assert.equal(gesture.update(0, now + 350, false).ready, true);
}

test('Mirrored eye roll uses pixel aspect ratio and maps to the screen direction', () => {
  assert.equal(eyeRoll({ x: .3, y: .4 }, { x: .7, y: .4 }, 640, 480), 0);
  const left = eyeRoll({ x: .3, y: .3 }, { x: .7, y: .5 }, 640, 480);
  assert.ok(Math.abs(left - 20.556) < .01);
  assert.equal(eyeRoll({ x: .3, y: .5 }, { x: .7, y: .3 }, 640, 480), -left);
});

test('Requires neutral pose and a continuous 900ms hold; selects once', () => {
  const g = new TiltGesture();
  assert.equal(g.update(25, 0, false).choose, undefined);
  assert.equal(g.update(25, 1000, false).choose, undefined);
  arm(g, 1100);
  assert.equal(g.update(20, 1500, false).progress, 0);
  assert.equal(g.update(20, 2300, false).choose, undefined);
  assert.equal(g.update(20, 2400, false).choose, 'left');
  assert.equal(g.update(20, 3500, false).choose, undefined);
  arm(g, 3600);
  g.update(-20, 4000, false);
  assert.equal(g.update(-20, 4900, false).choose, 'right');
});

test('Switching direction or dropping below threshold restarts the hold', () => {
  const g = new TiltGesture();
  arm(g);
  g.update(20, 400, false);
  assert.equal(g.update(-20, 1100, false).progress, 0);
  assert.equal(g.update(-20, 1900, false).choose, undefined);
  g.update(-10, 1950, false);
  assert.equal(g.update(-20, 2000, false).progress, 0);
  assert.equal(g.update(-20, 2900, false).choose, 'right');
});

test('Missing/multiple faces, answered rounds and a new round all require neutral again', () => {
  for (const interrupt of [(g) => g.update(null, 1000, false), (g) => g.update(20, 1000, true), (g) => g.reset()]) {
    const g = new TiltGesture();
    arm(g);
    g.update(20, 400, false);
    interrupt(g);
    assert.equal(g.update(20, 2000, false).choose, undefined);
    arm(g, 2100);
    g.update(20, 2500, false);
    assert.equal(g.update(20, 3400, false).choose, 'left');
  }
});
