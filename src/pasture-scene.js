/* Consumonsters pasture scenery: a wide meadow with a stream, two old trees and grass that blows in the wind.
   The scenery is pixel art at the same scale as the sprites (one scene pixel = one sprite pixel) and uses the
   sprites' shading rule: highlights lean warm, shadows lean cool. pasture.js puts the creatures in it. */
(() => {
'use strict';
const {hash32, mulberry} = window.CM;
const W = 640, H = 200, HZ = 56;           // scene size in pixels, horizon row

/* ---------- colour ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const towards = (h, tg, amt) => {const d = ((tg - h + 540) % 360) - 180; return (h + Math.sign(d) * Math.min(Math.abs(d), amt) + 360) % 360;};
const hi = c => [towards(c[0], 55, 10), c[1] + 4, c[2] + 13];
const lo = c => [towards(c[0], 245, 12), c[1] + 6, c[2] - 14];
const shift = (c, dl, dh = 0, ds = 0) => [c[0] + dh, c[1] + ds, c[2] + dl];
function rgb([h, s, l]){
  s = clamp(s, 0, 100) / 100; l = clamp(l, 2, 98) / 100;
  const a = s * Math.min(l, 1 - l), f = n => {const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));};
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const css = c => {const [r, g, b] = rgb(c); return `rgb(${r},${g},${b})`;};
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

const SKY = [[210, 64, 70], [200, 60, 80], [188, 52, 89]];
const FAR = [150, 22, 64], NEAR = [108, 32, 52];
const GRASS = [96, 44, 46], WOOD = [28, 36, 44], STONE = [32, 8, 60], OUT = [220, 14, 26];
const WATER = {shallow: [186, 52, 62], mid: [198, 56, 52], deep: [206, 58, 44], glint: [185, 60, 82], foam: [190, 40, 94]};
const LEAF = [116, 42, 34], BARK = [24, 34, 32];
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const h2 = (x, y) => {let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;};

/* ---------- the stream: a centre line that winds and widens toward the viewer ---------- */
const sCx = y => 372 + (y - HZ) * 0.25 + 12 * Math.sin((y - HZ) * 0.05);
const sW = y => 4 + (y - HZ) * 0.16;
const sL = y => sCx(y) - sW(y) / 2, sR = y => sCx(y) + sW(y) / 2;

/* wind: a steady breeze to the right, with gusts that roll across the meadow */
function wind(x, t){
  const gust = Math.max(0, Math.sin(t * 0.42 - x * 0.018));
  return 0.35 + 0.32 * Math.sin(t * 1.7 + x * 0.06) + 0.18 * Math.sin(t * 3.1 + x * 0.17 + 1.3) + 1.2 * gust ** 6;
}
const gustAt = (x, t) => Math.max(0, Math.sin(t * 0.42 - x * 0.018)) ** 6;

/* ---------- static layers, built once ---------- */
function layer(w = W, h = H){const c = document.createElement('canvas'); c.width = w; c.height = h; return c;}
const isWater = new Uint8Array(W * H);
const ground = new Float32Array(H);   // grass lightness per row, for tinting blades
const TREES = [{x: 566, y: HZ + 18, s: 1}, {x: 84, y: HZ + 15, s: .8}];   // the old tree on the far bank and a younger one on the near bank
const TREE = [];                      // canopy blobs of every tree, for falling leaves
let SKYC, LAND, CLOUDS;

function buildScene(){
  const rnd = mulberry(hash32('pasture-v2'));
  // sky and sun
  SKYC = layer(W, HZ);
  {
    const ctx = SKYC.getContext('2d'), img = ctx.createImageData(W, HZ), d = img.data;
    const set = (x, y, c) => {const [r, g, b] = rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;};
    for(let y = 0; y < HZ; y++) for(let x = 0; x < W; x++){
      const f = y / HZ * 6, i = Math.floor(f), k = (i + (f - i > bayer(x, y) ? 1 : 0)) / 6;
      let c = k < .5 ? mix(SKY[0], SKY[1], k * 2) : mix(SKY[1], SKY[2], k * 2 - 1);
      const sd = Math.hypot(x - 46, y - 15);
      if(sd < 5.5) c = [52, 100, 94]; else if(sd < 7.5) c = [50, 95, 84]; else if(sd < 10 && bayer(x, y) > (sd - 7.5) / 2.5) c = shift(c, 4, -8);
      set(x, y, c);
    }
    ctx.putImageData(img, 0, 0);
  }
  CLOUDS = Array.from({length: 7}, (_, j) => {
    const i = j % 3, cv = document.createElement('canvas'), w = 22 + i * 6 + Math.floor(rnd() * 8), h = 9 + i; cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), blobs = [[w * .3, h * .62, w * .22, h * .38], [w * .55, h * .45, w * .26, h * .46], [w * .78, h * .66, w * .18, h * .32]];
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      if(!blobs.some(([bx, by, rx, ry]) => ((x + .5 - bx) / rx) ** 2 + ((y + .5 - by) / ry) ** 2 <= 1)) continue;
      ctx.fillStyle = css(y >= h - 2 ? [212, 38, 88] : y >= h - 3 && bayer(x, y) > .5 ? [208, 30, 94] : [200, 30, 99]); ctx.fillRect(x, y, 1, 1);
    }
    return {cv, x: (j + rnd() * .7) * W / 7, y: 4 + i * 9 + Math.floor(rnd() * 4), v: 1.4 + i * 0.7};
  });

  LAND = layer();
  const ctx = LAND.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const set = (x, y, c, a = 255) => {if(x < 0 || y < 0 || x >= W || y >= H) return; const [r, g, b] = rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;};
  const far = x => HZ - 15 + 5 * Math.sin(x * 0.028 + 0.6) + 2.5 * Math.sin(x * 0.083 + 2);
  const near = x => HZ - 6 + 3.5 * Math.sin(x * 0.045 + 3.2) + 1.5 * Math.sin(x * 0.13);
  for(let x = 0; x < W; x++){
    const fy = Math.ceil(far(x)), ny = Math.ceil(near(x));
    for(let y = fy; y < HZ; y++) set(x, y, y === fy ? hi(FAR) : y > fy + 6 && bayer(x, y) > .55 ? shift(FAR, -3) : FAR);
    for(let y = ny; y < HZ; y++) set(x, y, y === ny ? hi(NEAR) : NEAR);
  }
  // rows of far trees on the back hills
  for(let i = 0; i < 30; i++){
    const tx = Math.floor(rnd() * W), ty = Math.ceil(far(tx)) + 1, r = 1 + Math.floor(rnd() * 2);
    for(let y = -r * 2; y <= 0; y++) for(let x = -r; x <= r; x++) if((x / (r + .5)) ** 2 + ((y + r) / (r + .6)) ** 2 <= 1 && ty + y < Math.ceil(near(tx + x))) set(tx + x, ty + y, x < 0 && y < -r ? [140, 26, 50] : [150, 28, 42]);
  }
  // meadow: lighter toward the back, with darker clumps and speckles
  for(let y = HZ; y < H; y++){
    const dpt = (y - HZ) / (H - HZ), L = 56 - 14 * dpt; ground[y] = L;
    for(let x = 0; x < W; x++){
      const q = L / 3, i = Math.floor(q), Lb = (i + (q - i > bayer(x, y) ? 1 : 0)) * 3;
      let c = [GRASS[0] - 4 + 8 * dpt, GRASS[1] - 4 + 6 * dpt, Lb];
      const v = Math.sin(x * 0.11 + y * 0.07 + 1) * Math.sin(y * 0.19 - x * 0.05 + 2) + 0.15 * Math.sin(x * 0.5 + y * 0.3);
      if(v > 0.42 + (bayer(x, y) - .5) * 0.2) c = shift(c, -4, 6);
      const n = rnd();
      if(n < 0.05) c = shift(c, 7, -8); else if(n < 0.10) c = shift(c, -6, 10);
      set(x, y, c);
    }
  }
  // the stream bed and banks
  for(let y = HZ; y < H; y++){
    const l = sL(y), r = sR(y), w = r - l, dpt = (y - HZ) / (H - HZ);
    const a = Math.ceil(l - 0.5), b = Math.floor(r - 0.5);
    for(let x = a; x <= b; x++){
      const e = Math.min(x + .5 - l, r - x - .5);
      let c = e < 1.2 ? WATER.shallow : e < w * .28 + bayer(x, y) * 1.5 ? WATER.mid : WATER.deep;
      c = shift(c, (1 - dpt) * 7);
      set(x, y, c); if(x >= 0 && x < W) isWater[y * W + x] = 1;
    }
    set(a - 1, y, [36, 32, 30]); set(b + 1, y, [36, 32, 30]);
    if(bayer(a, y) > .4) set(a - 2, y, shift([GRASS[0], GRASS[1], ground[y]], -9, 8));
    if(bayer(b, y) > .4) set(b + 2, y, shift([GRASS[0], GRASS[1], ground[y]], -9, 8));
  }
  // a wooden fence along the back of the meadow, on both sides of the stream
  const FB = HZ + 7;
  const fence = (x0, x1) => {
    for(let x = x0; x <= x1; x++){ set(x, FB - 5, WOOD); set(x, FB - 2, WOOD); set(x, FB - 4, lo(WOOD), 120); set(x, FB - 1, lo(WOOD), 120); }
    for(let x = x0; x <= x1 - 1; x += 9){
      for(let y = FB - 7; y <= FB; y++){ set(x, y, y === FB - 7 ? hi(hi(WOOD)) : hi(WOOD)); set(x + 1, y, y === FB - 7 ? hi(WOOD) : lo(WOOD)); }
      set(x - 1, FB + 1, shift([GRASS[0], GRASS[1], ground[FB]], -8)); set(x + 2, FB + 1, shift([GRASS[0], GRASS[1], ground[FB]], -8));
    }
  };
  fence(3, Math.floor(sL(FB)) - 6); fence(Math.ceil(sR(FB)) + 6, W - 4);
  // stones on the banks, in the water and out in the grass
  const stones = [[sCx(HZ + 50), HZ + 50, 2], [sCx(HZ + 110) + 2, HZ + 110, 3], [sL(HZ + 80) - 3, HZ + 80, 2], [sR(HZ + 34) + 3, HZ + 34, 2],
    [sR(HZ + 128) + 1, HZ + 128, 3], [sL(HZ + 136) - 2, HZ + 136, 3], [sCx(HZ + 88) - 4, HZ + 88, 2], [210, HZ + 104, 2], [498, HZ + 122, 2], [146, HZ + 40, 1]];
  for(const [sx, sy, r] of stones){
    const rx = r + .5, ry = r * .65 + .3, inS = (x, y) => ((x + .5 - sx) / rx) ** 2 + ((y + .5 - sy) / ry) ** 2 <= 1;
    for(let y = Math.floor(sy - ry - 1); y <= sy + ry + 1; y++) for(let x = Math.floor(sx - rx - 1); x <= sx + rx + 1; x++){
      if(!inS(x, y)) continue;
      const edge = !inS(x - 1, y) || !inS(x + 1, y) || !inS(x, y - 1) || !inS(x, y + 1);
      set(x, y, edge ? OUT : y + .5 < sy - ry * .2 ? hi(STONE) : y + .5 > sy + ry * .3 ? lo(STONE) : STONE);
      if(x >= 0 && x < W) isWater[y * W + x] = 0;
    }
  }
  // the trees
  for(const {x: TX, y: TY, s} of TREES){
    const k = v => v * s;
    for(let y = -2; y <= 2; y++) for(let x = -13; x <= 13; x++) if((x / k(13)) ** 2 + (y / 2.6) ** 2 <= 1) set(TX + x, TY + y, shift([GRASS[0], GRASS[1], ground[TY + y]], -9, 12));
    for(let y = TY - Math.round(k(13)); y <= TY; y++) for(let x = -1; x <= 1; x++) set(TX + x, y, x < 0 ? hi(BARK) : x > 0 ? lo(BARK) : BARK);
    set(TX - 2, TY, BARK); set(TX + 2, TY, lo(BARK));
    const blobs = [[TX, TY - k(21), k(11), k(8.5)], [TX - k(8), TY - k(15), k(6.5), k(5.5)], [TX + k(8), TY - k(15), k(6.5), k(5.5)], [TX + k(1), TY - k(27), k(7), k(5.5)]];
    TREE.push(...blobs.map(b => [...b, TY]));
    const inT = (x, y) => blobs.some(([bx, by, rx, ry]) => ((x + .5 - bx) / rx) ** 2 + ((y + .5 - by) / ry) ** 2 <= 1);
    for(let y = TY - Math.ceil(k(34)); y <= TY - Math.floor(k(8)); y++) for(let x = TX - Math.ceil(k(16)); x <= TX + Math.ceil(k(16)); x++){
      if(!inT(x, y)) continue;
      const edge = !inT(x - 1, y) || !inT(x + 1, y) || !inT(x, y - 1) || !inT(x, y + 1);
      const [bx, by, rx, ry] = blobs.reduce((m, b) => (((x - b[0]) / b[2]) ** 2 + ((y - b[1]) / b[3]) ** 2 < ((x - m[0]) / m[2]) ** 2 + ((y - m[1]) / m[3]) ** 2 ? b : m));
      const sh = (x - bx) / rx * .5 + (y - by) / ry * .8 + (rnd() - .5) * .35;
      set(x, y, edge ? [140, 40, 17] : sh < -.45 ? hi(LEAF) : sh > .35 ? lo(LEAF) : LEAF);
    }
  }
  ctx.putImageData(img, 0, 0);
  return rnd;
}

/* ---------- animated props: grass tufts, flowers and reeds ---------- */
const PROPS = [];
const FLOWERS = {
  daisy: {w: 4, petal: [60, 30, 96], shade: [220, 22, 82], eye: [46, 92, 55]},
  poppy: {w: 3, petal: [4, 80, 54], shade: [355, 75, 40], eye: [0, 30, 18]},
  bluebell: {w: 3, petal: [228, 62, 64], shade: [236, 55, 48]},
  buttercup: {w: 4, petal: [50, 96, 58], shade: [42, 92, 48]},
  clover: {w: 2, petal: [328, 55, 74], shade: [330, 45, 60]},
};
function blade(ctx, x, y, h, tip, cols){
  let prev = 0;
  for(let i = 0; i < h; i++){
    const f = (i + 1) / h, ox = Math.round(tip * f * f);
    ctx.fillStyle = i === h - 1 ? cols[2] : i < h * .35 ? cols[0] : cols[1];
    if(Math.abs(ox - prev) > 1) ctx.fillRect(x + prev + Math.sign(ox - prev), y - i, 1, 1);
    ctx.fillRect(x + ox, y - i, 1, 1); prev = ox;
  }
  return [x + prev, y - h + 1];
}
function grassCols(y, dry){
  const g = [dry ? 70 : 98, dry ? 50 : 48, ground[y]];
  return [css(shift(g, -11, 14, 4)), css(shift(g, 5, -6, 6)), css(hi(shift(g, 8, -4)))];
}
const landAt = (x, y, pad = 1) => {
  if(x < 0 || x >= W || y < HZ + 2 || y >= H) return false;
  for(let dx = -pad; dx <= pad; dx++){const xx = x + dx; if(xx >= 0 && xx < W && isWater[y * W + xx]) return false;}
  const l = sL(y), r = sR(y); return x < l - 1 - pad || x > r + 1 + pad;
};
function buildProps(rnd){
  for(let n = 0; n < 760; n++){
    const x = Math.floor(rnd() * W), y = HZ + 3 + Math.floor(rnd() ** .8 * (H - HZ - 3));
    if(!landAt(x, y)) continue;
    const d = (y - HZ) / (H - HZ), lush = Math.abs(x - sCx(y)) < sW(y) / 2 + 7, k = 2 + Math.floor(rnd() * (2 + d * 3));
    const blades = Array.from({length: k}, () => ({dx: Math.round((rnd() - .5) * 4), h: Math.max(2, Math.round((3 + rnd() * 4 + (lush ? 3 : 0)) * (.5 + .5 * d))), lean: (rnd() - .5) * 1.4}));
    const cols = grassCols(y, rnd() < .18);
    PROPS.push({x, y, draw(ctx, t){ for(const b of blades) blade(ctx, x + b.dx, y, b.h, b.lean + wind(x, t) * b.h * .32, cols); }});
  }
  const kinds = Object.keys(FLOWERS), centres = Array.from({length: 22}, (_, i) => [(i + .2 + rnd() * .6) * W / 22, HZ + 14 + rnd() * (H - HZ - 20), kinds[Math.floor(rnd() * kinds.length)]]);
  for(let n = 0; n < 190; n++){
    const [cx, cy, ck] = centres[n % centres.length];
    const x = Math.round(cx + (rnd() - .5) * 26), y = Math.round(cy + (rnd() - .5) * 16);
    if(!landAt(x, y, 2)) continue;
    const d = (y - HZ) / (H - HZ), kind = rnd() < .7 ? ck : kinds[Math.floor(rnd() * kinds.length)], P = FLOWERS[kind];
    const h = Math.max(2, Math.round((3 + rnd() * 4) * (.55 + .45 * d))), lean = (rnd() - .5) * .8, ph = rnd() * 6;
    const stem = [css([110, 40, 30]), css([104, 42, 38]), css([104, 42, 38])];
    const c = {p: css(P.petal), s: css(P.shade), e: P.eye && css(P.eye)};
    PROPS.push({x, y, draw(ctx, t){
      const [hx, hy] = blade(ctx, x, y, h, lean + wind(x, t + ph * .02) * h * .2, stem);
      const px = (dx, dy, col) => {ctx.fillStyle = col; ctx.fillRect(hx + dx, hy + dy, 1, 1);};
      switch(kind){
        case 'daisy': px(-1, -1, c.p); px(1, -1, c.p); px(0, -2, c.p); px(0, 0, c.s); px(0, -1, c.e); break;
        case 'poppy': px(-1, -1, c.p); px(0, -2, c.p); px(1, -1, c.s); px(0, -1, c.e); px(-1, -2, c.p); break;
        case 'bluebell': px(0, -1, c.p); px(1, -1, c.s); px(1, 0, c.p); break;
        case 'buttercup': px(0, -1, c.p); px(-1, -1, c.s); px(1, -1, c.s); break;
        case 'clover': px(0, -1, c.p); px(0, -2, c.s); break;
      }
    }});
  }
  // reeds and cattails along both banks
  for(let y = HZ + 10; y < H - 2; y += 5 + Math.floor(rnd() * 7)){
    const left = rnd() < .5, x = Math.round(left ? sL(y) - 2 - rnd() * 2 : sR(y) + 2 + rnd() * 2);
    if(x < 1 || x > W - 2) continue;
    const d = (y - HZ) / (H - HZ), s = .55 + .45 * d, ph = rnd() * 6;
    const stalks = Array.from({length: 2 + Math.floor(rnd() * 2)}, (_, i) => ({dx: i - 1, h: Math.round((9 + rnd() * 6) * s), lean: (rnd() - .5) * 1.5, cat: i === 0}));
    const cols = [css([78, 40, 30]), css([74, 42, 40]), css([62, 48, 54])], cat = [css([24, 52, 30]), css([28, 55, 42])];
    PROPS.push({x, y, draw(ctx, t){
      for(const st of stalks){
        const [tx, ty] = blade(ctx, x + st.dx, y, st.h, st.lean + wind(x, t + ph * .03) * st.h * .14, cols);
        if(st.cat){ ctx.fillStyle = cat[0]; ctx.fillRect(tx, ty + 1, 1, 3); ctx.fillStyle = cat[1]; ctx.fillRect(tx, ty + 1, 1, 1); }
      }
    }});
  }
}

/* ---------- moving scenery, drawn every frame for the columns x0..x1 ---------- */
const WC = [WATER.glint, WATER.foam].map(css);
function drawSky(ctx, t){
  ctx.drawImage(SKYC, 0, 0);
  for(const cl of CLOUDS){ const span = W + cl.cv.width * 2, x = ((cl.x + t * cl.v) % span + span) % span - cl.cv.width; ctx.drawImage(cl.cv, Math.round(x), cl.y); }
  ctx.drawImage(LAND, 0, 0);
}
function drawWater(ctx, t, x0, x1){
  const k = Math.floor(t * 9);
  for(let y = HZ; y < H; y++){
    const c = sCx(y), a = Math.ceil(sL(y) - .5), b = Math.floor(sR(y) - .5), row = y * W;
    for(let x = Math.max(0, a, x0); x <= Math.min(W - 1, b, x1); x++){
      if(!isWater[row + x]) continue;
      const u = Math.round(x - c), n = h2(u, y - k), m = h2(u - 1, y - k);
      if(n < .03 || m < .03){ ctx.fillStyle = WC[0]; ctx.fillRect(x, y, 1, 1); }
      else if(n > .996 || ((x === a || x === b) && h2(x, y * 7 + Math.floor(t * 3)) < .25)){ ctx.fillStyle = WC[1]; ctx.fillRect(x, y, 1, 1); }
      else if(!isWater[row - W + x] && y > HZ && h2(x, Math.floor(t * 5)) < .6){ ctx.fillStyle = WC[1]; ctx.fillRect(x, y, 1, 1); }   // foam below a stone
    }
  }
}

/* ---------- particles: petals and seeds on the wind, falling leaves, splashes ---------- */
function makeFx(){
  const ps = [];
  const petal = [css([60, 30, 97]), css([330, 60, 84]), css([50, 90, 80])], leaf = [css(hi(LEAF)), css(LEAF)], drop = css(WATER.glint);
  return {
    ping(x, y){ ps.push({k: 'ring', x, y, life: .7}); },
    splash(x, y){ for(let i = 0; i < 6; i++) ps.push({k: 'drop', x, y, vx: (Math.random() - .5) * 26, vy: -14 - Math.random() * 16, life: .45, c: drop}); },
    step(dt, t){
      if(ps.length < 110 && Math.random() < dt * 3 * (.35 + 4 * gustAt(20, t))) ps.push({k: 'seed', x: Math.random() * W - 30, y: HZ + 6 + Math.random() * (H - HZ - 10), life: 12, ph: Math.random() * 6, c: petal[Math.floor(Math.random() * 3)]});
      if(ps.length < 110 && Math.random() < dt * .5){ const [bx, by, rx, ry, ty] = TREE[Math.floor(Math.random() * TREE.length)]; ps.push({k: 'leaf', x: bx + (Math.random() - .5) * rx, y: by + ry * .5, floor: ty - 2 + Math.random() * 10, life: 8, ph: Math.random() * 6, c: leaf[Math.floor(Math.random() * 2)]}); }
      for(const p of ps){
        p.life -= dt;
        if(p.k === 'ring') continue;
        if(p.k === 'drop'){ p.vy += 90 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        else if(p.k === 'seed'){ p.x += (5 + wind(p.x, t) * 18) * dt; p.y += Math.sin(t * 3 + p.ph) * 6 * dt + 1.2 * dt; if(p.x > W + 2) p.life = 0; }
        else { if(p.y < p.floor){ p.x += (wind(p.x, t) * 9 + Math.sin(t * 2 + p.ph) * 6) * dt; p.y += 7 * dt; } else if(p.life > 1) p.life = 1; }
      }
      for(let i = ps.length - 1; i >= 0; i--) if(ps[i].life <= 0) ps.splice(i, 1);
    },
    draw(ctx){
      for(const p of ps){
        if(p.k === 'ring'){   // a little ripple where you called from
          const k = 1 - p.life / .7, r = 2 + k * 7;
          ctx.fillStyle = `rgba(255,253,235,${(1 - k) * .9})`;
          for(let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2; ctx.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r * .5), 1, 1); }
          continue;
        }
        ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    },
  };
}
const BUTTERFLIES = [[0, 60, 50, [50, 92, 72]], [2.4, 150, 110, [0, 0, 97]], [4.1, 40, 130, [22, 88, 62]], [1.2, 250, 70, [200, 80, 70]],
  [3.3, 310, 120, [50, 92, 72]], [5.0, 470, 60, [0, 0, 97]], [0.7, 580, 115, [22, 88, 62]]].map(([ph, cx, cy, c]) => ({ph, cx, cy: HZ + cy * .82, c: css(c)}));
function drawButterflies(ctx, t){
  for(const b of BUTTERFLIES){
    const x = Math.round(b.cx + 30 * Math.sin(t * .23 + b.ph) + 8 * Math.sin(t * .9 + b.ph * 2)), y = Math.round(b.cy + 10 * Math.sin(t * .31 + b.ph * 3) + 3 * Math.sin(t * 2.3 + b.ph));
    const open = Math.floor(t * 7 + b.ph) % 2;
    ctx.fillStyle = b.c;
    if(open){ ctx.fillRect(x - 1, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1, 1, 2); } else { ctx.fillRect(x - 1, y - 2, 1, 1); ctx.fillRect(x + 1, y - 2, 1, 1); }
    ctx.fillStyle = 'rgb(40,30,30)'; ctx.fillRect(x, y - 1, 1, 2);
  }
}

let built = false;
function build(){ if(!built){ buildProps(buildScene()); built = true; } }

window.PastureScene = {W, H, HZ, clamp, css, WATER, isWater, sCx, sW, sL, sR, PROPS, build, drawSky, drawWater, makeFx, drawButterflies};
})();
