import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Loads the engine, bond, hats and rewards together, with a stand-in for localStorage.
function load(){
  const store = new Map();
  const localStorage = {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v))};
  const ctx = vm.createContext({localStorage});
  for(const f of ['engine', 'bond', 'hats', 'rewards']) vm.runInContext(readFileSync(new URL(`../src/${f}.js`, import.meta.url), 'utf8'), ctx, {filename: f + '.js'});
  return ctx;
}
/* fake creatures: only the fields the rules read */
const mk = (g, domain, rarity = 'common') => ({g, t: {gtin: g, domain, rarity}});
const JUNE = new Date(2026, 5, 10, 12).getTime(), DAY = 864e5;   // outside every season

test('every reward unlocks a real hat, and no hat is given twice', () => {
  const {CMRewards: R, CMHats: H} = load();
  const hats = R.REWARDS.map(r => r.hat);
  for(const h of hats) assert.ok(H.HATS[h], h);
  assert.equal(new Set(hats).size, hats.length);
});

test('catching your first bird unlocks the propeller cap, once', () => {
  const {CMRewards: R} = load();
  let list = [];
  R.setSource(() => list);
  assert.deepEqual([...R.check(JUNE)], []);
  list = [mk('a', 'bird')];
  assert.deepEqual([...R.check(JUNE).map(r => r.hat)].sort(), ['party', 'propeller']);
  assert.ok(R.owns('propeller'));
  list.push(mk('b', 'bird'));
  assert.equal(R.check(JUNE).length, 0, 'nothing new for a second bird');
  assert.deepEqual([...R.takeFresh()].sort(), ['party', 'propeller']);
  assert.equal(R.takeFresh().length, 0);
});

test('milestones, rare finds and friendship', () => {
  const {CMRewards: R, CMBond: B} = load();
  const list = Array.from({length: 25}, (_, i) => mk('g' + i, 'mammal', i === 3 ? 'epic' : 'common'));
  R.setSource(() => list);
  const got = R.check(JUNE).map(r => r.id);
  for(const id of ['first', 'mammal', 'ten', 'twentyfive', 'epic']) assert.ok(got.includes(id), id);
  assert.ok(!got.includes('fifty') && !got.includes('friend'));
  const day = 864e5, t0 = new Date(2026, 9, 29, 12).getTime();
  for(let d = 0; d < 4; d++){   // four days of pets, treats and play: past 3 hearts
    for(let i = 0; i < 4; i++) B.add('g0', 'pet', t0 + d * day + i * 21e3);
    for(const s of ['treat', 'treat', 'play', 'play', 'play']) B.add('g0', s, t0 + d * day);
  }
  assert.ok(B.hearts('g0') >= 3);
  assert.ok(R.check(JUNE).some(r => r.hat === 'bow'));
});

test('visit streaks count days in a row', () => {
  const {CMRewards: R} = load();
  R.setSource(() => []);
  R.visit(JUNE); R.visit(JUNE + 3e3); R.visit(JUNE + DAY);
  assert.equal(R.visit(JUNE + 2 * DAY).streak, 3);
  assert.deepEqual([...R.check(JUNE + 2 * DAY).map(r => r.hat)], ['sunhat']);
  assert.equal(R.visit(JUNE + 4 * DAY).streak, 1, 'a missed day starts again');
  for(let d = 5; d < 11; d++) R.visit(JUNE + d * DAY);
  assert.ok(R.check(JUNE + 10 * DAY).some(r => r.hat === 'grad'));
  const row = R.list(JUNE + 10 * DAY).find(r => r.id === 'streak7');
  assert.ok(row.got && row.have === 7 && row.goal === 7);
});

test('the pumpkin is only earned in season, and kept after', () => {
  const {CMRewards: R} = load();
  R.setSource(() => []);
  assert.equal(R.check(JUNE).length, 0);
  assert.equal(R.list(JUNE).find(r => r.id === 'spooky').open, false);
  assert.deepEqual([...R.check(new Date(2026, 9, 31, 20).getTime()).map(r => r.hat)], ['pumpkin']);
  assert.ok(R.owns('pumpkin'));
  assert.ok(!R.check(new Date(2026, 10, 11).getTime()).length && R.owns('pumpkin'));
});

test('a creature can only wear a hat you own', () => {
  const {CMRewards: R} = load();
  const list = [mk('a', 'reptile')];
  R.setSource(() => list); R.check(JUNE);
  R.wear('a', 'top');
  assert.equal(R.worn('a'), null);
  R.wear('a', 'cowboy');
  assert.equal(R.worn('a'), 'cowboy');
  R.wear('a', null);
  assert.equal(R.worn('a'), null);
});

test('hats fit every head and stay inside their grid', () => {
  const {CM, CMHats: H} = load();
  const r = CM.mulberry(7);
  for(let i = 0; i < 400; i++){
    const t = CM.roll(CM.normalize(CM.randomUPC(r)).gtin, {families: true}), f = H.fit(t);
    assert.ok(f.s >= 2 && f.s <= 7 && f.top >= 0 && f.top < CM.F, JSON.stringify(f));
  }
  for(const id of Object.keys(H.HATS)) for(let s = 2; s <= 7; s++) for(let fr = 0; fr < (H.HATS[id].frames || 1); fr++){
    const g = H.grid(id, s, fr), W = 26, Hh = 26;
    assert.ok(g.some(Boolean), `${id} ${s} draws something`);
    for(let y = 0; y < Hh; y++) for(const x of [0, W - 1]) assert.ok(!g[y * W + x], `${id} at size ${s} touches the side`);
    for(let x = 0; x < W; x++) assert.ok(!g[x], `${id} at size ${s} touches the top`);
  }
});

test('toppers that get in the way block some hats', () => {
  const {CMHats: H} = load();
  assert.ok(!H.allowed({topper: 'mushroom'}, 'top'));
  assert.ok(H.allowed({topper: 'mushroom'}, 'bow'));
  assert.ok(!H.allowed({topper: 'halo'}, 'wizard'));
  assert.ok(H.allowed({topper: 'halo'}, 'beanie'));
  assert.ok(H.allowed({topper: 'antlers'}, 'top'));
});
