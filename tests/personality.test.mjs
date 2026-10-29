import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GOLDEN_CODES} from './load-engine.mjs';

// Loads engine.js and personality.js the way the browser does.
const ctx = vm.createContext({});
for(const f of ['engine.js', 'personality.js']) vm.runInContext(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), ctx, {filename: f});
const {CM, CMTemper} = ctx;
const of = upc => { const g = CM.normalize(upc).gtin; return CMTemper.temperament(g, CM.roll(g, {families: true}).domain); };

// Players get to know their creature as shy or zippy, so personalities are frozen like looks are.
const golden = JSON.parse(readFileSync(new URL('./personality-golden.json', import.meta.url), 'utf8'));

test('personality tables are unchanged', () => {
  assert.equal(CM.hash32(JSON.stringify([CMTemper.TRAITS, CMTemper.LEANS])).toString(16), golden.tables);
});

test('1,000 random barcodes keep their personalities', () => {
  const r = CM.mulberry(2026), parts = [];
  for(let i = 0; i < 1000; i++) parts.push(JSON.stringify(of(CM.randomUPC(r))));
  assert.equal(CM.hash32(parts.join('|')).toString(16), golden.sample);
});

for(const code of GOLDEN_CODES){
  test(`barcode ${code} keeps its personality`, () => {
    assert.deepEqual({...of(code)}, golden.creatures[code]);
  });
}
