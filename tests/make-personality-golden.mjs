// Regenerates tests/personality-golden.json. Only run this as part of a deliberate personality change.
import {readFileSync, writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {GOLDEN_CODES} from './load-engine.mjs';
const ctx = vm.createContext({});
for(const f of ['engine.js', 'personality.js']) vm.runInContext(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), ctx, {filename: f});
const {CM, CMTemper} = ctx;
const of = upc => { const g = CM.normalize(upc).gtin; return {...CMTemper.temperament(g, CM.roll(g, {families: true}).domain)}; };
const r = CM.mulberry(2026), parts = [];
for(let i = 0; i < 1000; i++) parts.push(JSON.stringify(of(CM.randomUPC(r))));
const out = {tables: CM.hash32(JSON.stringify([CMTemper.TRAITS, CMTemper.LEANS])).toString(16), sample: CM.hash32(parts.join('|')).toString(16), creatures: Object.fromEntries(GOLDEN_CODES.map(c => [c, of(c)]))};
writeFileSync(new URL('./personality-golden.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
