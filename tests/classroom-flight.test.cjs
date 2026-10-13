const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { FLIGHT_PATTERNS, FLIGHT_PALETTES, flightPattern, flightPoint, portraitFlightPoint } = require('../src/lib/classroom-flight.ts');
test('every motion stays inside the visible area across time, seeds and lanes', () => {
  for (const pattern of FLIGHT_PATTERNS) for (let i=0;i<600;i++) {
    const point=portraitFlightPoint(pattern,i/20,(i%100)/100,i%9);
    assert(Number.isFinite(point.x)&&Number.isFinite(point.y));
    assert(point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1,`${pattern}: ${JSON.stringify(point)}`);
  }
});
test('figure eight crosses its center, spiral grows outward, waves have separate lanes', () => {
  assert(Math.abs(flightPoint('eight',0).x-.5)<1e-10);
  assert(Math.abs(flightPoint('eight',.5).y-.5)<1e-10);
  const radius=u=>Math.hypot(flightPoint('spiral',u).x-.5,flightPoint('spiral',u).y-.5);
  assert(radius(.9)>radius(.2)*2);
  assert(flightPoint('wave',.2,2).y>flightPoint('wave',.2,0).y);
});
test('combined mode visits all seven patterns, each fixed style keeps its own palette and geometry', () => {
  assert.deepEqual(FLIGHT_PATTERNS.map((_,i)=>flightPattern('mix',i*3.5)),FLIGHT_PATTERNS);
  const paths=FLIGHT_PATTERNS.map(p=>JSON.stringify(Array.from({length:10},(_,i)=>flightPoint(p,i/10))));
  assert.equal(new Set(paths).size,7);
  for (const p of FLIGHT_PATTERNS) {
    const a=portraitFlightPoint(p,0,.23,1),b=portraitFlightPoint(p,1.5,.23,1);
    assert(Math.hypot(a.x-b.x,a.y-b.y)>.01,`${p} moves over time`);
  }
  assert.equal(new Set(FLIGHT_PATTERNS.map(p=>FLIGHT_PALETTES[p].join())).size,7);
  for(const p of FLIGHT_PATTERNS) assert.equal(flightPattern(p,25),p);
});
