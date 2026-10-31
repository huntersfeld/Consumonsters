import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Loads places on its own, with a stand-in for localStorage.
function load(store = new Map()){
  const localStorage = {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v))};
  const ctx = vm.createContext({localStorage});
  vm.runInContext(readFileSync(new URL('../src/places.js', import.meta.url), 'utf8'), ctx, {filename: 'places.js'});
  return {P: ctx.CMPlaces, store};
}
/* fake creatures: only the fields places read */
const mk = (g, domain) => ({g, t: {gtin: g, domain}});

test('the meadow is always open, and the lagoon opens at three aquatic creatures', () => {
  const {P} = load();
  let list = [mk('m', 'mammal'), mk('a1', 'aquatic'), mk('a2', 'aquatic')];
  P.setSource(() => list);
  assert.ok(P.isOpen('meadow'));
  assert.ok(!P.isOpen('lagoon'));
  assert.equal(P.check().length, 0);
  const lag = P.list().find(p => p.id === 'lagoon');
  assert.equal(lag.have, 2); assert.equal(lag.need, 3); assert.ok(!lag.open);
  list.push(mk('a3', 'aquatic'));
  assert.deepEqual([...P.check().map(p => p.id)], ['lagoon']);
  assert.equal(P.check().length, 0, 'announced once');
});

test('creatures live in their own domain\'s place once it opens, else the meadow', () => {
  const {P} = load();
  const list = [mk('m', 'mammal'), mk('b', 'bird'), mk('a1', 'aquatic'), mk('a2', 'aquatic')];
  P.setSource(() => list);
  assert.equal(P.homeOf('a1', list[2].t), 'meadow');
  list.push(mk('a3', 'aquatic'));
  assert.equal(P.homeOf('a1', list[2].t), 'lagoon');
  assert.equal(P.homeOf('b', list[1].t), 'meadow', 'one bird is not enough to open the cliffs');
  const res = Object.fromEntries(P.list().map(p => [p.id, p.residents]));
  assert.deepEqual({...res}, {meadow: 2, lagoon: 3, cliffs: 0, rocks: 0, garden: 0, glade: 0, cave: 0, wilds: 0, sky: 0});
});

test('moving a creature sticks, and is saved', () => {
  const {P, store} = load();
  const list = [mk('m', 'mammal'), mk('a1', 'aquatic'), mk('a2', 'aquatic'), mk('a3', 'aquatic')];
  P.setSource(() => list);
  P.move('a1', 'meadow'); P.move('m', 'lagoon');
  assert.equal(P.homeOf('a1', list[1].t), 'meadow');
  assert.equal(P.homeOf('m', list[0].t), 'lagoon');
  P.move('m', 'nowhere');
  assert.equal(P.homeOf('m', list[0].t), 'lagoon', 'unknown places are ignored');
  const {P: again} = load(store);
  again.setSource(() => list);
  assert.equal(again.homeOf('m', list[0].t), 'lagoon');
});

test('a moved creature goes back to the meadow if its place closes', () => {
  const {P} = load();
  let list = [mk('m', 'mammal'), mk('a1', 'aquatic'), mk('a2', 'aquatic'), mk('a3', 'aquatic')];
  P.setSource(() => list);
  P.move('m', 'lagoon');
  list = list.slice(0, 3);
  assert.equal(P.homeOf('m', list[0].t), 'meadow');
});

test('the place on screen is remembered, and only open places can be visited', () => {
  const {P} = load();
  const list = [mk('a1', 'aquatic'), mk('a2', 'aquatic')];
  P.setSource(() => list);
  assert.equal(P.current(), 'meadow');
  P.go('lagoon');
  assert.equal(P.current(), 'meadow');
  list.push(mk('a3', 'aquatic'));
  P.go('lagoon');
  assert.equal(P.current(), 'lagoon');
});

test('the cliffs open at three birds, for the birds', () => {
  const {P} = load();
  const list = [mk('b1', 'bird'), mk('b2', 'bird'), mk('m', 'mammal')];
  P.setSource(() => list);
  assert.equal(P.homeOf('b1', list[0].t), 'meadow');
  list.push(mk('b3', 'bird'));
  assert.deepEqual([...P.check().map(p => p.id)], ['cliffs']);
  assert.equal(P.homeOf('b1', list[0].t), 'cliffs');
  assert.equal(P.homeOf('m', list[2].t), 'meadow');
});

test('the red rocks open at three reptiles', () => {
  const {P} = load();
  const list = [mk('r1', 'reptile'), mk('r2', 'reptile')];
  P.setSource(() => list);
  assert.ok(!P.isOpen('rocks'));
  list.push(mk('r3', 'reptile'));
  assert.deepEqual([...P.check().map(p => p.id)], ['rocks']);
  assert.equal(P.homeOf('r1', list[0].t), 'rocks');
});

test('the undergrowth opens at three insects', () => {
  const {P} = load();
  const list = [mk('i1', 'insect'), mk('i2', 'insect'), mk('i3', 'insect')];
  P.setSource(() => list);
  assert.deepEqual([...P.check().map(p => p.id)], ['garden']);
  assert.equal(P.homeOf('i2', list[1].t), 'garden');
});

test('the glade opens at three flora creatures', () => {
  const {P} = load();
  const list = [mk('f1', 'flora'), mk('f2', 'flora'), mk('f3', 'flora')];
  P.setSource(() => list);
  assert.deepEqual([...P.check().map(p => p.id)], ['glade']);
  assert.equal(P.homeOf('f3', list[2].t), 'glade');
});

test('the crystal cave opens at three minerals', () => {
  const {P} = load();
  const list = [mk('c1', 'mineral'), mk('c2', 'mineral'), mk('c3', 'mineral')];
  P.setSource(() => list);
  assert.deepEqual([...P.check().map(p => p.id)], ['cave']);
  assert.equal(P.homeOf('c1', list[0].t), 'cave');
});

test('the crossroads open at three elementals', () => {
  const {P} = load();
  const list = [mk('e1', 'elemental'), mk('e2', 'elemental'), mk('e3', 'elemental')];
  P.setSource(() => list);
  assert.deepEqual([...P.check().map(p => p.id)], ['wilds']);
  assert.equal(P.homeOf('e1', list[0].t), 'wilds');
});

test('the sky island opens at three mythics, and creatures live on it', () => {
  const {P} = load();
  const list = [mk('y1', 'mythic'), mk('y2', 'mythic'), mk('y3', 'mythic')];
  P.setSource(() => list);
  assert.deepEqual([...P.check().map(p => p.id)], ['sky']);
  assert.equal(P.homeOf('y1', list[0].t), 'sky');
  assert.equal(P.byId.sky.at, 'on');
});

test('every domain has a place of its own', () => {
  const {P} = load();
  assert.deepEqual([...P.PLACES.map(p => p.domain)].sort(), ['aquatic', 'bird', 'elemental', 'flora', 'insect', 'mammal', 'mineral', 'mythic', 'reptile']);
});
