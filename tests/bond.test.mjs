import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Loads bond.js with a stand-in for the browser's localStorage.
function loadBond(){
  const store = new Map();
  const localStorage = {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v))};
  const ctx = vm.createContext({localStorage});
  vm.runInContext(readFileSync(new URL('../src/bond.js', import.meta.url), 'utf8'), ctx, {filename: 'bond.js'});
  return {B: ctx.CMBond, store};
}
const DAY = 864e5, T0 = new Date(2026, 9, 29, 12).getTime();

test('a new creature has no hearts', () => {
  const {B} = loadBond();
  assert.equal(B.hearts('x'), 0);
  assert.equal(B.heartText(0), '♡♡♡♡♡');
});

test('pets have a cooldown and a daily cap', () => {
  const {B} = loadBond();
  assert.equal(B.add('x', 'pet', T0).gained, 2);
  assert.ok(B.add('x', 'pet', T0 + 5e3).cooling);
  let got = 2;
  for(let i = 1; i < 10; i++) got += B.add('x', 'pet', T0 + i * 21e3).gained;
  assert.equal(got, B.SOURCES.pet.cap);
  assert.equal(B.add('x', 'pet', T0 + DAY).gained, 2, 'the cap resets the next day');
});

test('hearts follow the level table and never drain', () => {
  const {B} = loadBond();
  let now = T0;
  for(let d = 0; d < 40; d++, now += DAY) for(const s of ['scan', 'watch', 'watch', 'watch', 'watch', 'watch']) B.add('x', s, now);
  assert.equal(B.hearts('x'), 5);
  assert.equal(B.hearts('x'), 5, 'still five after time passes with no visits');
});

test('a first heart takes a couple of short visits', () => {
  const {B} = loadBond();
  for(let i = 0; i < 4; i++) B.add('x', 'pet', T0 + i * 21e3);
  B.add('x', 'came', T0);
  assert.equal(B.hearts('x'), 1);
});

test('progress is saved in its own key, apart from the collection', () => {
  const {B, store} = loadBond();
  B.add('x', 'scan', T0);
  assert.deepEqual([...store.keys()], ['consumonsters.pasture.v1']);
  assert.equal(JSON.parse(store.get('consumonsters.pasture.v1')).bond.x.pts, 5);
});
