/* The cliffs: the birds' place. Windy clifftop turf high above the sea, split by a deep gorge, with a cove at the
   front and a sea stack standing in it. Nests sit among the boulders and on top of the stack. Walkers keep to their
   own side of the gorge, and winged ones flap across it and out to the stack. */
(() => {
'use strict';
const K = window.PastureScene;
const {W, H, HZ, rgb, css, hi, lo, shift, bayer, h2, wind, layer, blade, hash32, mulberry} = K;
const SEA = [208, 52, 44], DEEPSEA = [210, 55, 26], HEAD = [200, 14, 54];
const TURF = [84, 40], ROCK = [34, 12, 60], OUT = [220, 14, 26], LICHEN = [44, 70, 60];
const TWIG = [30, 38, 36], EGG = [190, 40, 86];

/* the gorge: a crack that winds from the back edge to the front and widens toward the viewer */
const gCx = y => 300 + (y - HZ) * .3 + 12 * Math.sin((y - HZ) * .05);
const gW = y => 20 + (y - HZ) * .24;
const gL = y => gCx(y) - gW(y) / 2, gR = y => gCx(y) + gW(y) / 2;
/* the back edge of the clifftop, with the open sea beyond it */
const SEAY = HZ - 10;
const backEdge = x => HZ + 6 + 2 * Math.sin(x * .05) + 1.5 * Math.sin(x * .13 + 1);
/* the cove at the front left: a bite out of the cliff, with the sea far below; the stack stands in it */
const inCove = (x, y) => { const a = Math.atan2(y - 216, x - 104); return ((x - 104) / 150) ** 2 + ((y - 216) / 60) ** 2 <= (1 + .05 * Math.sin(5 * a)) ** 2; };
const STACK = {x: 66, y: 177, rx: 30, ry: 9};
const onStack = (x, y) => ((x + .5 - STACK.x) / STACK.rx) ** 2 + ((y + .5 - STACK.y) / STACK.ry) ** 2 <= 1;
const FACE = 26;   // how far the cliff face drops before the sea, in pixels on screen
const NESTS = [{x: STACK.x + 6, y: STACK.y}, {x: 170, y: HZ + 44}, {x: 478, y: HZ + 36}, {x: 566, y: 158}];
const BOULDERS = [[156, HZ + 34, 9], [178, HZ + 39, 6], [464, HZ + 25, 10], [486, HZ + 30, 6], [552, 146, 8], [576, 152, 6], [236, 140, 4], [410, HZ + 74, 5], [96, HZ + 60, 4], [620, HZ + 50, 5]];
/* flat slabs of bare rock showing through the thin turf */
const SLABS = [[60, HZ + 30, 16, 4], [226, HZ + 78, 12, 3], [380, HZ + 36, 10, 3], [520, HZ + 96, 18, 5], [430, 170, 12, 4]];

K.define('cliffs', P => {
  const {isWater, PROPS} = P, rnd = mulberry(hash32('cliffs-v1'));
  const gap = P.isGap = new Uint8Array(W * H), ground = new Float32Array(H);
  P.name = 'The cliffs';
  P.NAPS = NESTS.map(({x, y}) => ({x, y: y - 4}));
  P.flow = () => [0, 0];
  P.petals = [[330, 60, 84], [0, 0, 97], [330, 45, 72]];
  P.butterflyPaths = [[0, 90, 70, [0, 0, 97]], [2.4, 210, 110, [330, 60, 80]], [4.1, 420, 60, [50, 92, 72]], [1.2, 520, 120, [0, 0, 97]], [3.3, 600, 80, [330, 60, 80]]];

  const LAND = P.LAND = layer();
  const ctx = LAND.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const set = (x, y, c, a = 255) => {if(x < 0 || y < 0 || x >= W || y >= H) return; const [r, g, b] = rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;};
  /* a rock face seen from the front: warm grey with darker bands, lit at the top */
  const face = (x, y, e, dark) => {
    let c = shift(ROCK, -e * 1.1 - (dark ? 16 : 0));
    if((y + Math.round(2.5 * Math.sin(x * .13) + x * .1)) % 6 === 0) c = shift(c, -8);   // ledges in the rock
    else if(h2(x >> 1, y >> 3) < .12 && h2(x, 3) < .5) c = shift(c, -10);   // cracks running down it
    else if(bayer(x, y) > .85) c = shift(c, 5);
    if(e < 1) c = hi(ROCK);
    return c;
  };

  // the open sea out to the horizon, with a far headland
  for(let y = SEAY; y < HZ + 12; y++) for(let x = 0; x < W; x++){
    set(x, y, y === SEAY ? [205, 40, 80] : shift(SEA, (1 - (y - SEAY) / 22) * 10 + (bayer(x, y) > .6 ? -2 : 0)));
    if(y > SEAY) isWater[y * W + x] = 1;
  }
  const head = x => SEAY - 7 * Math.max(0, 1 - ((x - 80) / 70) ** 2) - 3 * Math.max(0, 1 - ((x - 40) / 30) ** 2);
  for(let x = 0; x < 160; x++) for(let y = Math.ceil(head(x)); y <= SEAY; y++) set(x, y, y === Math.ceil(head(x)) ? hi(HEAD) : y > head(x) + 3 && x > 100 ? lo(HEAD) : HEAD);

  // the turf: lighter toward the back, with darker clumps where it's sheltered
  for(let y = HZ; y < H; y++){
    const dpt = (y - HZ) / (H - HZ), L = 58 - 14 * dpt; ground[y] = L;
    for(let x = 0; x < W; x++){
      if(y < backEdge(x)) continue;
      isWater[y * W + x] = 0;
      const q = L / 3, i = Math.floor(q), Lb = (i + (q - i > bayer(x, y) ? 1 : 0)) * 3;
      let c = [TURF[0] - 4 + 10 * dpt, TURF[1] - 4 + 6 * dpt, Lb];
      const v = Math.sin(x * .09 + y * .11) * Math.sin(y * .23 - x * .04 + 1) + .15 * Math.sin(x * .6 + y * .2);
      if(v > .45 + (bayer(x, y) - .5) * .2) c = shift(c, -6, 6);
      const n = rnd();
      if(n < .05) c = shift(c, 10, -10); else if(n < .09) c = shift(c, -6, 10);
      set(x, y, c);
    }
  }
  // the clifftop lip along the back
  for(let x = 0; x < W; x++){ const y = Math.ceil(backEdge(x)); set(x, y, hi(ROCK)); set(x, y + 1, shift([TURF[0], TURF[1], ground[y + 1]], 0, 6)); }

  // the gorge: the lit left wall, the shaded right wall, and the sea far down at the bottom
  for(let y = Math.floor(HZ + 4); y < H; y++){
    const l = gL(y), r = gR(y), w = r - l;
    for(let x = Math.ceil(l); x <= Math.floor(r); x++){
      if(y < backEdge(x) - 1) continue;
      const u = (x - l) / w, i = y * W + x;
      gap[i] = 1; isWater[i] = 0;
      if(u < .46) set(x, y, face(x, y, u * 40, false));
      else if(u > .64) set(x, y, face(x, y, (1 - u) * 30 + 6, true));
      else set(x, y, shift(DEEPSEA, bayer(x, y) > .8 ? 3 : 0));
    }
    set(Math.ceil(l) - 1, y, shift([TURF[0], TURF[1], ground[y]], -6, -10));
    set(Math.floor(r) + 1, y, [36, 14, 34]);
  }

  // the cove: the cliff face under its edge, the sea at its foot, and the stack standing in it
  const coveTop = new Int16Array(W).fill(H);
  for(let x = 0; x < W; x++) for(let y = HZ + 20; y < H; y++) if(inCove(x, y)){ coveTop[x] = y; break; }
  for(let x = 0; x < W; x++){
    const top = coveTop[x]; if(top >= H) continue;
    for(let y = top; y < H; y++){
      const i = y * W + x, e = y - top;
      gap[i] = 1; isWater[i] = 0;
      if(e < FACE + 2 * Math.sin(x * .3)) set(x, y, face(x, y, e, false));
      else set(x, y, shift(SEA, -6 + (bayer(x, y) > .75 ? 4 : 0)));
    }
    set(x, top - 1, shift([TURF[0], TURF[1], ground[top - 1]], -6, -10));
  }
  // the stack: a grassy top, and its own face dropping to the sea below it
  const stTop = new Int16Array(W).fill(-1);
  for(let y = STACK.y - STACK.ry - 1; y <= STACK.y + STACK.ry + 1; y++) for(let x = STACK.x - STACK.rx - 1; x <= STACK.x + STACK.rx + 1; x++){
    if(!onStack(x, y)) continue;
    gap[y * W + x] = 0;
    const edge = !onStack(x, y - 1) || !onStack(x - 1, y) || !onStack(x + 1, y);
    set(x, y, edge ? hi(ROCK) : shift([TURF[0] + 6, TURF[1], ground[y] + 4], bayer(x, y) > .8 ? -5 : 0));
    stTop[x] = y;
  }
  for(let x = 0; x < W; x++) if(stTop[x] >= 0) for(let y = stTop[x] + 1; y < H; y++) set(x, y, face(x, y, (y - stTop[x]) * 1.6, x > STACK.x + 12));

  // slabs of bare rock in the turf, with a darker crack or two
  for(const [sx, sy, rx, ry] of SLABS){
    const inS = (x, y) => { const a = Math.atan2(y - sy, x - sx); return ((x + .5 - sx) / rx) ** 2 + ((y + .5 - sy) / ry) ** 2 <= (1 + .15 * Math.sin(3 * a + sx)) ** 2; };
    for(let y = sy - ry - 2; y <= sy + ry + 2; y++) for(let x = sx - rx - 3; x <= sx + rx + 3; x++){
      if(!inS(x, y)) continue;
      const top = !inS(x, y - 1), bottom = !inS(x, y + 1);
      set(x, y, bottom ? lo(lo(ROCK)) : top ? hi(ROCK) : (x + y * 3) % 11 === 0 ? lo(ROCK) : h2(x, y) < .1 ? LICHEN : shift(ROCK, 4));
    }
  }
  // boulders, spotted with lichen
  for(const [bx, by, r] of BOULDERS){
    const rx = r + .5, ry = r * .7 + .3, inB = (x, y) => ((x + .5 - bx) / rx) ** 2 + ((y + .5 - by) / ry) ** 2 <= 1;
    for(let y = Math.floor(by - ry - 1); y <= by + ry + 1; y++) for(let x = Math.floor(bx - rx - 1); x <= bx + rx + 1; x++){
      if(!inB(x, y)) continue;
      const edge = !inB(x - 1, y) || !inB(x + 1, y) || !inB(x, y - 1) || !inB(x, y + 1);
      set(x, y, edge ? OUT : y + .5 < by - ry * .2 ? hi(ROCK) : y + .5 > by + ry * .3 ? lo(ROCK) : ROCK);
      if(!edge && r > 3 && h2(x, y) < .12) set(x, y, LICHEN);
    }
  }
  // the nests: a ring of twigs with a clutch of speckled eggs
  for(const {x: nx, y: ny} of NESTS){
    for(let y = -3; y <= 2; y++) for(let x = -6; x <= 6; x++){
      const k = (x / 6.5) ** 2 + (y / 2.6) ** 2;
      if(k > 1) continue;
      if(k > .45) set(nx + x, ny + y, h2(nx + x, ny + y) < .5 ? TWIG : (y < 0 ? hi(TWIG) : lo(TWIG)));
      else set(nx + x, ny + y, lo(lo(TWIG)));
    }
    for(const [ex, ey] of [[-2, -1], [1, -1], [0, 0]]){ set(nx + ex, ny + ey, hi(EGG)); set(nx + ex + 1, ny + ey, EGG); if(h2(nx + ex, ny) < .5) set(nx + ex + 1, ny + ey, [200, 20, 60]); }
  }
  ctx.putImageData(img, 0, 0);

  /* animated props: wind-combed grass, sea pinks and campion along the edges */
  const ok = (x, y, pad = 2) => {
    if(x < 1 || x >= W - 1 || y >= H || y < backEdge(x) + 2) return false;
    for(let dy = -pad; dy <= pad; dy++) for(let dx = -pad; dx <= pad; dx++){ const xx = x + dx, yy = y + dy; if(xx >= 0 && xx < W && yy >= 0 && yy < H && gap[yy * W + xx]) return false; }
    return !(gap[y * W + x]) && (!inCove(x, y + 3) || onStack(x, y));
  };
  const grassCols = (y, dry) => { const g = [dry ? 66 : TURF[0] + 4, dry ? 46 : TURF[1] + 6, ground[y]]; return [css(shift(g, -11, 14, 4)), css(shift(g, 5, -6, 6)), css(hi(shift(g, 8, -4)))]; };
  for(let n = 0; n < 700; n++){
    const x = Math.floor(rnd() * W), y = HZ + 8 + Math.floor(rnd() ** .8 * (H - HZ - 8));
    if(!ok(x, y)) continue;
    const dd = (y - HZ) / (H - HZ), k = 2 + Math.floor(rnd() * (2 + dd * 3));
    const blades = Array.from({length: k}, () => ({dx: Math.round((rnd() - .5) * 4), h: Math.max(2, Math.round((3 + rnd() * 4) * (.5 + .5 * dd))), lean: .4 + rnd() * .8}));
    const cols = grassCols(y, rnd() < .3);
    PROPS.push({x, y, draw(ctx, t){ for(const b of blades) blade(ctx, x + b.dx, y, b.h, b.lean + wind(x, t) * b.h * .45, cols); }});
  }
  const pink = {p: css([330, 62, 80]), s: css([330, 50, 64])}, white = {p: css([0, 0, 97]), s: css([300, 20, 80])}, stem = [css([110, 40, 30]), css([104, 42, 38]), css([104, 42, 38])];
  for(let n = 0; n < 420; n++){
    // most flowers grow near an edge, where the turf is thin
    const x = Math.floor(rnd() * W), y = HZ + 10 + Math.floor(rnd() * (H - HZ - 12));
    if(!ok(x, y, 2)) continue;
    const nearEdge = !ok(x, y, 7) || y < backEdge(x) + 9;
    if(!nearEdge && rnd() < .85) continue;
    const dd = (y - HZ) / (H - HZ), c = rnd() < .7 ? pink : white, h = Math.max(2, Math.round((2 + rnd() * 3) * (.55 + .45 * dd))), ph = rnd() * 6;
    PROPS.push({x, y, draw(ctx, t){
      const [hx, hy] = blade(ctx, x, y, h, .3 + wind(x, t + ph * .02) * h * .25, stem);
      ctx.fillStyle = c.p; ctx.fillRect(hx - 1, hy - 1, 2, 1); ctx.fillRect(hx, hy - 2, 1, 1);
      ctx.fillStyle = c.s; ctx.fillRect(hx, hy, 1, 1);
    }});
  }

  /* moving water and the birds over it: glints on the open sea, surf at the foot of the cliffs, gulls gliding */
  const glints = [], surf = [], deep = [];
  for(let n = 0; n < 500; n++){ const x = Math.floor(rnd() * W), y = SEAY + 2 + Math.floor(rnd() * 20); if(isWater[y * W + x]) glints.push({x, y, ph: rnd() * 6, sp: .5 + rnd()}); }
  for(let x = 0; x < W; x++){
    const top = coveTop[x]; if(top >= H) continue;
    const foot = Math.ceil(top + FACE + 2 * Math.sin(x * .3));
    if(foot < H && !onStack(x, foot) && (stTop[x] < 0 || foot < stTop[x])) surf.push([x, foot]);
  }
  for(let y = HZ + 4; y < H; y++) for(let x = Math.ceil(gL(y)); x <= Math.floor(gR(y)); x++){ const u = (x - gL(y)) / gW(y); if(u >= .46 && u <= .64 && y >= backEdge(x)) deep.push(y * W + x); }
  const gulls = Array.from({length: 4}, (_, i) => ({ph: rnd() * 6, y: SEAY - 18 + i * 5 + rnd() * 6, v: 6 + rnd() * 5, x: rnd() * W}));
  const GL = css([200, 50, 82]), FO = css([190, 30, 94]), GU = css([0, 0, 98]), GS = css([220, 10, 60]);
  P.drawWater = (ctx, t, x0, x1) => {
    ctx.fillStyle = GL;
    for(const g of glints){ const x = Math.round(g.x + t * 2 * g.sp) % W; if(x < x0 || x > x1 || !isWater[g.y * W + x]) continue; if(Math.sin(t * 2 * g.sp + g.ph) > .75) ctx.fillRect(x, g.y, 1, 1); }
    ctx.fillStyle = FO;
    const k = Math.floor(t * 3);
    for(const [x, y] of surf){ if(x < x0 || x > x1) continue; if(h2(x >> 1, k) < .55) ctx.fillRect(x, y, 1, 1); if(h2(x >> 2, k + 7) < .25) ctx.fillRect(x, y + 1, 1, 1); }
    for(const i of deep){ const x = i % W; if(x < x0 || x > x1) continue; if(h2(x, (i / W | 0) * 3 + k) < .025) ctx.fillRect(x, (i / W) | 0, 1, 1); }
    // gulls: a white V gliding slowly over the sea, flapping now and then
    for(const g of gulls){
      const span = W + 40, x = Math.round(((g.x + t * g.v) % span + span) % span - 20), y = Math.round(g.y + 2 * Math.sin(t * .5 + g.ph));
      if(x < x0 - 4 || x > x1 + 4) continue;
      const up = Math.sin(t * 4 + g.ph) > .6 ? -1 : 0;
      ctx.fillStyle = GU; ctx.fillRect(x - 2, y + up, 1, 1); ctx.fillRect(x - 1, y + 1 + up, 1, 1); ctx.fillRect(x, y + 1, 1, 1); ctx.fillRect(x + 1, y + 1 + up, 1, 1); ctx.fillRect(x + 2, y + up, 1, 1);
      ctx.fillStyle = GS; ctx.fillRect(x, y + 2, 1, 1);
    }
  };
});
})();
