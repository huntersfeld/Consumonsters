// Regenerates tests/golden.json. Only run this for a deliberate new seed version, never to make a failing test pass.
import {writeFileSync} from 'node:fs';
import {loadEngine, fingerprint, tablesHash, sampleHash, GOLDEN_CODES} from './load-engine.mjs';
const CM = loadEngine();
const golden = {gen: CM.GEN, tables: tablesHash(CM), sample: sampleHash(CM), creatures: Object.fromEntries(GOLDEN_CODES.map(c => [c, fingerprint(CM, c)]))};
writeFileSync(new URL('./golden.json', import.meta.url), JSON.stringify(golden, null, 2) + '\n');
console.log(`Wrote ${GOLDEN_CODES.length} creatures for ${CM.GEN}`);
