import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadEngine, fingerprint, tablesHash, sampleHash} from './load-engine.mjs';

const CM = loadEngine();
const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));

test('seed version has not changed', () => {
  assert.equal(CM.GEN, golden.gen);
});

test('frozen part tables are unchanged', () => {
  assert.equal(tablesHash(CM), golden.tables, 'A weight, option or palette in engine.js changed. Shipped creatures must not change; add new content under a new seed version instead.');
});

test('1,000 random barcodes still hatch the same creatures', () => {
  assert.equal(sampleHash(CM), golden.sample);
});

for(const [code, want] of Object.entries(golden.creatures)){
  test(`barcode ${code} still hatches the same creature`, () => {
    assert.deepEqual(fingerprint(CM, code), want);
  });
}

test('UPC-A and its 13-digit EAN form are the same creature', () => {
  assert.equal(CM.normalize('036000291452').gtin, CM.normalize('0036000291452').gtin);
});

test('11 digits get their check digit added', () => {
  assert.equal(CM.normalize('03600029145').gtin, '00036000291452');
});

test('bad check digits and wrong lengths are rejected', () => {
  assert.match(CM.normalize('036000291453').error, /last digit should be 2/);
  assert.match(CM.normalize('12345').error, /12 digits/);
  assert.ok(CM.normalize('').error);
});

test('Elemental is exactly as rare as Mythic', () => {
  assert.equal(CM.DOMAINS.elemental.w, CM.DOMAINS.mythic.w);
});

test('rarity odds land near their weights over 20,000 codes', () => {
  const r = CM.mulberry(12345), n = 20000, seen = {};
  for(let i = 0; i < n; i++){
    const t = CM.roll(CM.randomUPC(r).padStart(14, '0'), {families: true});
    seen[t.rarity] = (seen[t.rarity] || 0) + 1;
  }
  const total = Object.values(CM.RARITY).reduce((a, v) => a + v.w, 0);
  for(const [k, v] of Object.entries(CM.RARITY)){
    const expected = v.w / total * n, got = seen[k] || 0;
    assert.ok(Math.abs(got - expected) < Math.max(25, expected * 0.1), `${k}: expected about ${expected.toFixed(0)}, got ${got}`);
  }
});
