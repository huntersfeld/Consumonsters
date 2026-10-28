// Loads src/engine.js the same way the browser does and returns its CM namespace.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

export function loadEngine(){
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8'), ctx, {filename: 'engine.js'});
  return ctx.CM;
}

// Everything that decides how a creature looks, plus a hash of its finished sprite grid.
export function fingerprint(CM, upc){
  const t = CM.roll(CM.normalize(upc).gtin, {families: true});
  const pick = ['rarity','size','domain','element','plan','body','head','topper','sides','feet','tail','eyes','mouth','pattern','back','cheeks','donor','shiny','name'];
  const out = {};
  for(const k of pick) out[k] = t[k] ?? null;
  out.donated = [...t.donated];
  out.palette = t.pal.prismName;
  out.sprite = CM.hash32(Array.from(CM.build(t)).join(',')).toString(16);
  return out;
}

export const GOLDEN_CODES = [
  '036000291452', '012345678905', '4006381333931', '96385074',
  '117619964262', '094911034681', '484521637905', '868926410774',
  '023029591151', '694887001566', '199048247376', '636025011815',
  '07800000110', '00000000000017'
];

// One hash over every frozen table, so any edit to weights, options or palettes is caught.
export function tablesHash(CM){
  return CM.hash32(JSON.stringify([CM.GEN, CM.SIZES, CM.RARITY, CM.DOMAINS, CM.LABELS])).toString(16);
}

// One hash over 1,000 random barcodes' fingerprints, to catch changes the named codes miss.
export function sampleHash(CM){
  const r = CM.mulberry(2026), parts = [];
  for(let i = 0; i < 1000; i++) parts.push(JSON.stringify(fingerprint(CM, CM.randomUPC(r))));
  return CM.hash32(parts.join('|')).toString(16);
}
