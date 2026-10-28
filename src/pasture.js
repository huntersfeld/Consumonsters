/* Consumonsters pasture: caught creatures hop around a little meadow with a stream while the grass blows in the wind.
   The scenery is pixel art at the same scale as the sprites (one scene pixel = one sprite pixel) and uses the
   sprites' shading rule: highlights lean warm, shadows lean cool. Nothing here changes how a creature looks. */
(() => {
'use strict';
const {F, hash32, mulberry, render, RARITY} = window.CM;
const W = 192, H = 240, HZ = 66;           // scene size in pixels, horizon row
const FOOT = F - 3, CXS = (F - 1) / 2;     // sprite foot row and centre column (GY and CX in engine.js)
const Y0 = HZ + 22;                        // creatures stay in front of the fence

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
const SHADOW = 'rgba(16,40,12,.26)';
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const h2 = (x, y) => {let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;};

/* ---------- the stream: a centre line that widens toward the viewer ---------- */
const sCx = y => 134 + (y - HZ) * 0.2 + 9 * Math.sin((y - HZ) * 0.05);
const sW = y => 4 + (y - HZ) * 0.14;
const sL = y => sCx(y) - sW(y) / 2, sR = y => sCx(y) + sW(y) / 2;

/* wind: a steady breeze to the right, with gusts that roll across the meadow */
function wind(x, t){
  const gust = Math.max(0, Math.sin(t * 0.42 - x * 0.018));
  return 0.35 + 0.32 * Math.sin(t * 1.7 + x * 0.06) + 0.18 * Math.sin(t * 3.1 + x * 0.17 + 1.3) + 1.2 * gust ** 6;
}
const gustAt = (x, t) => Math.max(0, Math.sin(t * 0.42 - x * 0.018)) ** 6;

/* ---------- static layers, built once ---------- */
function layer(){const c = document.createElement('canvas'); c.width = W; c.height = H; return c;}
const isWater = new Uint8Array(W * H);
const ground = new Float32Array(H);   // grass lightness per row, for tinting blades
let SKYC, LAND, CLOUDS, TREE;

function buildScene(){
  const rnd = mulberry(hash32('pasture-v1'));
  // sky, sun and hills
  SKYC = layer();
  {
    const ctx = SKYC.getContext('2d'), img = ctx.createImageData(W, HZ), d = img.data;
    const set = (x, y, c) => {const [r, g, b] = rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;};
    for(let y = 0; y < HZ; y++) for(let x = 0; x < W; x++){
      const f = y / HZ * 6, i = Math.floor(f), k = (i + (f - i > bayer(x, y) ? 1 : 0)) / 6;
      let c = k < .5 ? mix(SKY[0], SKY[1], k * 2) : mix(SKY[1], SKY[2], k * 2 - 1);
      const sd = Math.hypot(x - 26, y - 17);
      if(sd < 5.5) c = [52, 100, 94]; else if(sd < 7.5) c = [50, 95, 84]; else if(sd < 10 && bayer(x, y) > (sd - 7.5) / 2.5) c = shift(c, 4, -8);
      set(x, y, c);
    }
    ctx.putImageData(img, 0, 0);
  }
  CLOUDS = [0, 1, 2].map(i => {
    const cv = document.createElement('canvas'), w = 22 + i * 6, h = 9 + i; cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), blobs = [[w * .3, h * .62, w * .22, h * .38], [w * .55, h * .45, w * .26, h * .46], [w * .78, h * .66, w * .18, h * .32]];
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      if(!blobs.some(([bx, by, rx, ry]) => ((x + .5 - bx) / rx) ** 2 + ((y + .5 - by) / ry) ** 2 <= 1)) continue;
      ctx.fillStyle = css(y >= h - 2 ? [212, 38, 88] : y >= h - 3 && bayer(x, y) > .5 ? [208, 30, 94] : [200, 30, 99]); ctx.fillRect(x, y, 1, 1);
    }
    return {cv, x: rnd() * W, y: 6 + i * 11, v: 1.4 + i * 0.7};
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
  // a row of far trees on the back hill
  for(let i = 0; i < 9; i++){
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
  // a wooden fence along the back of the meadow
  const FB = HZ + 7, fenceEnd = Math.floor(sL(FB)) - 6;
  for(let x = 3; x <= fenceEnd; x++){ set(x, FB - 5, WOOD); set(x, FB - 2, WOOD); set(x, FB - 4, lo(WOOD), 120); set(x, FB - 1, lo(WOOD), 120); }
  for(let x = 3; x <= fenceEnd - 1; x += 9){
    for(let y = FB - 7; y <= FB; y++){ set(x, y, y === FB - 7 ? hi(hi(WOOD)) : hi(WOOD)); set(x + 1, y, y === FB - 7 ? hi(WOOD) : lo(WOOD)); }
    set(x - 1, FB + 1, shift([GRASS[0], GRASS[1], ground[FB]], -8)); set(x + 2, FB + 1, shift([GRASS[0], GRASS[1], ground[FB]], -8));
  }
  // stones on the banks and in the water
  const stones = [[sCx(HZ + 60), HZ + 60, 2], [sCx(HZ + 128) + 2, HZ + 128, 3], [sL(HZ + 95) - 3, HZ + 95, 2], [sR(HZ + 40) + 3, HZ + 40, 2],
    [sR(HZ + 150) + 1, HZ + 150, 3], [sL(HZ + 160) - 2, HZ + 160, 3], [sCx(HZ + 100) - 4, HZ + 100, 2]];
  for(const [sx, sy, r] of stones){
    const rx = r + .5, ry = r * .65 + .3, inS = (x, y) => ((x + .5 - sx) / rx) ** 2 + ((y + .5 - sy) / ry) ** 2 <= 1;
    for(let y = Math.floor(sy - ry - 1); y <= sy + ry + 1; y++) for(let x = Math.floor(sx - rx - 1); x <= sx + rx + 1; x++){
      if(!inS(x, y)) continue;
      const edge = !inS(x - 1, y) || !inS(x + 1, y) || !inS(x, y - 1) || !inS(x, y + 1);
      set(x, y, edge ? OUT : y + .5 < sy - ry * .2 ? hi(STONE) : y + .5 > sy + ry * .3 ? lo(STONE) : STONE);
      if(x >= 0 && x < W) isWater[y * W + x] = 0;
    }
  }
  // the old tree on the far bank
  const TX = 172, TY = HZ + 18;
  for(let y = -2; y <= 2; y++) for(let x = -13; x <= 13; x++) if((x / 13) ** 2 + (y / 2.6) ** 2 <= 1) set(TX + x, TY + y, shift([GRASS[0], GRASS[1], ground[TY + y]], -9, 12));
  for(let y = TY - 13; y <= TY; y++) for(let x = -1; x <= 1; x++) set(TX + x, y, x < 0 ? hi(BARK) : x > 0 ? lo(BARK) : BARK);
  set(TX - 2, TY, BARK); set(TX + 2, TY, lo(BARK));
  TREE = [[TX, TY - 21, 11, 8.5], [TX - 8, TY - 15, 6.5, 5.5], [TX + 8, TY - 15, 6.5, 5.5], [TX + 1, TY - 27, 7, 5.5]];
  const inT = (x, y) => TREE.some(([bx, by, rx, ry]) => ((x + .5 - bx) / rx) ** 2 + ((y + .5 - by) / ry) ** 2 <= 1);
  for(let y = TY - 34; y <= TY - 8; y++) for(let x = TX - 16; x <= TX + 16; x++){
    if(!inT(x, y)) continue;
    const edge = !inT(x - 1, y) || !inT(x + 1, y) || !inT(x, y - 1) || !inT(x, y + 1);
    const [bx, by, rx, ry] = TREE.reduce((m, b) => (((x - b[0]) / b[2]) ** 2 + ((y - b[1]) / b[3]) ** 2 < ((x - m[0]) / m[2]) ** 2 + ((y - m[1]) / m[3]) ** 2 ? b : m));
    const s = (x - bx) / rx * .5 + (y - by) / ry * .8 + (rnd() - .5) * .35;
    set(x, y, edge ? [140, 40, 17] : s < -.45 ? hi(LEAF) : s > .35 ? lo(LEAF) : LEAF);
  }
  ctx.putImageData(img, 0, 0);
  return rnd;
}

/* ---------- animated props: grass tufts, flowers and reeds ---------- */
let PROPS = [];
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
  PROPS = [];
  for(let n = 0; n < 260; n++){
    const x = Math.floor(rnd() * W), y = HZ + 3 + Math.floor(rnd() ** .8 * (H - HZ - 3));
    if(!landAt(x, y)) continue;
    const d = (y - HZ) / (H - HZ), lush = Math.abs(x - sCx(y)) < sW(y) / 2 + 7, k = 2 + Math.floor(rnd() * (2 + d * 3));
    const blades = Array.from({length: k}, () => ({dx: Math.round((rnd() - .5) * 4), h: Math.max(2, Math.round((3 + rnd() * 4 + (lush ? 3 : 0)) * (.5 + .5 * d))), lean: (rnd() - .5) * 1.4}));
    const cols = grassCols(y, rnd() < .18);
    PROPS.push({y, draw(ctx, t){ for(const b of blades) blade(ctx, x + b.dx, y, b.h, b.lean + wind(x, t) * b.h * .32, cols); }});
  }
  const kinds = Object.keys(FLOWERS), centres = Array.from({length: 7}, () => [8 + rnd() * 140, HZ + 14 + rnd() * (H - HZ - 20), kinds[Math.floor(rnd() * kinds.length)]]);
  for(let n = 0; n < 60; n++){
    const [cx, cy, ck] = centres[n % centres.length];
    const x = Math.round(cx + (rnd() - .5) * 26), y = Math.round(cy + (rnd() - .5) * 16);
    if(!landAt(x, y, 2)) continue;
    const d = (y - HZ) / (H - HZ), kind = rnd() < .7 ? ck : kinds[Math.floor(rnd() * kinds.length)], P = FLOWERS[kind];
    const h = Math.max(2, Math.round((3 + rnd() * 4) * (.55 + .45 * d))), lean = (rnd() - .5) * .8, ph = rnd() * 6;
    const stem = [css([110, 40, 30]), css([104, 42, 38]), css([104, 42, 38])];
    const c = {p: css(P.petal), s: css(P.shade), e: P.eye && css(P.eye)};
    PROPS.push({y, draw(ctx, t){
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
  for(let y = HZ + 12; y < H - 2; y += 6 + Math.floor(rnd() * 9)){
    const left = rnd() < .55, x = Math.round(left ? sL(y) - 2 - rnd() * 2 : sR(y) + 2 + rnd() * 2);
    if(x < 1 || x > W - 2) continue;
    const d = (y - HZ) / (H - HZ), s = .55 + .45 * d, ph = rnd() * 6;
    const stalks = Array.from({length: 2 + Math.floor(rnd() * 2)}, (_, i) => ({dx: i - 1, h: Math.round((9 + rnd() * 6) * s), lean: (rnd() - .5) * 1.5, cat: i === 0}));
    const cols = [css([78, 40, 30]), css([74, 42, 40]), css([62, 48, 54])], cat = [css([24, 52, 30]), css([28, 55, 42])];
    PROPS.push({y, draw(ctx, t){
      for(const st of stalks){
        const [tx, ty] = blade(ctx, x + st.dx, y, st.h, st.lean + wind(x, t + ph * .03) * st.h * .14, cols);
        if(st.cat){ ctx.fillStyle = cat[0]; ctx.fillRect(tx, ty + 1, 1, 3); ctx.fillStyle = cat[1]; ctx.fillRect(tx, ty + 1, 1, 1); }
      }
    }});
  }
}

/* ---------- creatures ---------- */
function makeSprite(t){
  const cv = document.createElement('canvas'); render(cv, t, {scale: 1});
  const ctx = cv.getContext('2d'), img = ctx.getImageData(0, 0, F, F), d = img.data;
  let x0 = F, x1 = -1, y0 = F, y1 = -1;
  for(let i = 0; i < F * F; i++){
    const a = d[i * 4 + 3];
    if(a >= 66 && a <= 76){ d[i * 4 + 3] = 0; continue; }   // the baked-in ground shadow; the pasture draws its own
    if(!a) continue;
    const x = i % F, y = (i / F) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  ctx.putImageData(img, 0, 0);
  return {cv, x0, x1, y0, y1};
}
function walkable(c, x, y){
  if(y < Y0 || y > H - 3 || x - c.hw < 3) return false;
  return c.aquatic ? x <= sR(y) - 3 : x + c.hw <= sL(y) - 2;
}
const inWater = c => {const x = Math.round(c.x), y = Math.round(c.y); return y < H && y >= 0 && x >= 0 && x < W && !!isWater[y * W + x];};

function newCreature(g, t){
  const spr = makeSprite(t), n = (spr.x1 - spr.x0 + 1);
  const r = mulberry(hash32(g + ':pasture'));
  const c = {g, t, spr, hw: Math.max(3, n / 2), floater: t.feet === 'float', aquatic: t.domain === 'aquatic',
    st: 'idle', timer: r() * 3, lift: 0, ph: r() * 4, happy: 0, x: 0, y: 0};
  const size = spr.y1 - spr.y0 + 1;
  c.stride = 7 + size * .22; c.hopH = 3 + Math.max(0, 32 - size) * .2; c.hopT = .3 + size * .006;
  for(let i = 0; i < 60; i++){ c.x = 6 + r() * (W - 12); c.y = Y0 + r() * (H - 3 - Y0); if(walkable(c, c.x, c.y)) break; }
  if(!walkable(c, c.x, c.y)){ c.x = 40; c.y = (Y0 + H) / 2; }
  return c;
}
function pickTarget(c){
  for(let i = 0; i < 14; i++){
    let tx, ty;
    if(c.aquatic && Math.random() < .5){ ty = c.y + (Math.random() - .5) * 50; tx = sCx(ty) + (Math.random() - .5) * sW(ty) * .5; }
    else { const a = Math.random() * Math.PI * 2, dd = 14 + Math.random() * 40; tx = c.x + Math.cos(a) * dd; ty = c.y + Math.sin(a) * dd * .6; }
    if(walkable(c, tx, ty) && walkable(c, (tx + c.x) / 2, (ty + c.y) / 2)){ c.tx = tx; c.ty = ty; return true; }
  }
  return false;
}
function nextHop(c){
  const dx = c.tx - c.x, dy = c.ty - c.y, dist = Math.hypot(dx, dy);
  if(!c.happy && dist < 2){ c.st = 'idle'; c.timer = 1 + Math.random() * 3.5; return; }
  if(c.floater && !c.happy){ c.st = 'glide'; return; }
  const k = c.happy ? 0 : Math.min(1, c.stride / dist), nx = c.x + dx * k, ny = c.y + dy * k;
  if(!c.happy && !walkable(c, nx, ny)){ c.st = 'idle'; c.timer = 1 + Math.random() * 2; return; }
  c.hop = {fx: c.x, fy: c.y, tx: nx, ty: ny, dur: c.happy ? .4 : c.hopT, h: c.happy ? 9 : c.hopH};
  c.st = 'crouch'; c.timer = .08;
}
function stepCreature(c, dt, fx){
  switch(c.st){
    case 'idle':
      c.timer -= dt;
      if(c.timer <= 0){ if(!c.sel && Math.random() < .75 && pickTarget(c)) nextHop(c); else c.timer = 1 + Math.random() * 3; }
      break;
    case 'crouch': c.timer -= dt; if(c.timer <= 0){ c.st = 'air'; c.timer = 0; } break;
    case 'air': {
      c.timer += dt; const p = Math.min(1, c.timer / c.hop.dur), h = c.hop;
      c.x = h.fx + (h.tx - h.fx) * p; c.y = h.fy + (h.ty - h.fy) * p; c.lift = Math.round(h.h * 4 * p * (1 - p));
      if(p >= 1){ c.lift = 0; c.st = 'land'; c.timer = .1; if(c.happy) c.happy--; if(inWater(c)) fx.splash(c.x, c.y - 3); }
      break;
    }
    case 'land': c.timer -= dt; if(c.timer <= 0){ if(c.happy) nextHop(c); else if(c.sel){ c.st = 'idle'; c.timer = 1; } else nextHop(c); } break;
    case 'glide': {
      const dx = c.tx - c.x, dy = c.ty - c.y, dist = Math.hypot(dx, dy), v = 7 * dt;
      if(dist <= v || c.sel){ c.st = 'idle'; c.timer = 1 + Math.random() * 3; break; }
      c.x += dx / dist * v; c.y += dy / dist * v;
      break;
    }
  }
}
function liftOf(c, t){
  let l = c.lift;
  if(c.floater) l += 3 + Math.round(Math.sin(t * 2.2 + c.ph) * 1.2);
  else if(c.st === 'idle' || c.st === 'glide') l += Math.floor(t / .55 + c.ph) % 2;   // the same 1-pixel bob as the hatch stage
  return l;
}
function drawCreature(ctx, c, t){
  const fx = Math.round(c.x), fy = Math.round(c.y), lift = liftOf(c, t), S = c.spr, wet = inWater(c) && !c.floater;
  const left = fx - Math.round(CXS + .5), top = fy - FOOT - lift;
  if(!wet){
    const rx = Math.max(2, Math.round(c.hw * .85 - lift * .25));
    ctx.fillStyle = SHADOW; ctx.fillRect(fx - rx, fy, rx * 2, 1); ctx.fillRect(fx - rx + 1, fy + 1, rx * 2 - 2, 1);
  }
  const sh = wet ? FOOT - 3 : FOOT + 2;   // rows of the sprite above the waterline
  if((c.st === 'crouch' || c.st === 'land') && !wet) ctx.drawImage(S.cv, 0, 0, F, sh, left - 1, top + 2, F + 2, sh - 2);
  else ctx.drawImage(S.cv, 0, 0, F, sh, left, top, F, sh);
  if(wet){
    const wl = top + sh, rx = Math.round(c.hw) + 1;
    for(let x = fx - rx; x <= fx + rx; x++){ if((x + Math.floor(t * 4)) % 3 === 0) continue; ctx.fillStyle = css(WATER.foam); ctx.fillRect(x, wl, 1, 1); }
  }
}

/* ---------- particles: petals and seeds on the wind, falling leaves, splashes ---------- */
function makeFx(){
  const ps = [];
  const petal = [css([60, 30, 97]), css([330, 60, 84]), css([50, 90, 80])], leaf = [css(hi(LEAF)), css(LEAF)], drop = css(WATER.glint);
  return {
    splash(x, y){ for(let i = 0; i < 6; i++) ps.push({k: 'drop', x, y, vx: (Math.random() - .5) * 26, vy: -14 - Math.random() * 16, life: .45, c: drop}); },
    step(dt, t){
      if(ps.length < 40 && Math.random() < dt * (.35 + 4 * gustAt(20, t))) ps.push({k: 'seed', x: -2, y: HZ + 6 + Math.random() * (H - HZ - 10), life: 12, ph: Math.random() * 6, c: petal[Math.floor(Math.random() * 3)]});
      if(ps.length < 40 && Math.random() < dt * .25){ const [bx, by, rx, ry] = TREE[Math.floor(Math.random() * TREE.length)]; ps.push({k: 'leaf', x: bx + (Math.random() - .5) * rx, y: by + ry * .5, floor: HZ + 16 + Math.random() * 10, life: 8, ph: Math.random() * 6, c: leaf[Math.floor(Math.random() * 2)]}); }
      for(const p of ps){
        p.life -= dt;
        if(p.k === 'drop'){ p.vy += 90 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        else if(p.k === 'seed'){ p.x += (5 + wind(p.x, t) * 18) * dt; p.y += Math.sin(t * 3 + p.ph) * 6 * dt + 1.2 * dt; if(p.x > W + 2) p.life = 0; }
        else { if(p.y < p.floor){ p.x += (wind(p.x, t) * 9 + Math.sin(t * 2 + p.ph) * 6) * dt; p.y += 7 * dt; } else if(p.life > 1) p.life = 1; }
      }
      for(let i = ps.length - 1; i >= 0; i--) if(ps[i].life <= 0) ps.splice(i, 1);
    },
    draw(ctx){ for(const p of ps){ ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); } },
  };
}
const BUTTERFLIES = [{ph: 0, cx: 60, cy: HZ + 50, c: css([50, 92, 72])}, {ph: 2.4, cx: 110, cy: HZ + 110, c: css([0, 0, 97])}, {ph: 4.1, cx: 40, cy: HZ + 140, c: css([22, 88, 62])}];
function drawButterflies(ctx, t){
  for(const b of BUTTERFLIES){
    const x = Math.round(b.cx + 30 * Math.sin(t * .23 + b.ph) + 8 * Math.sin(t * .9 + b.ph * 2)), y = Math.round(b.cy + 10 * Math.sin(t * .31 + b.ph * 3) + 3 * Math.sin(t * 2.3 + b.ph));
    const open = Math.floor(t * 7 + b.ph) % 2;
    ctx.fillStyle = b.c;
    if(open){ ctx.fillRect(x - 1, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1, 1, 2); } else { ctx.fillRect(x - 1, y - 2, 1, 1); ctx.fillRect(x + 1, y - 2, 1, 1); }
    ctx.fillStyle = 'rgb(40,30,30)'; ctx.fillRect(x, y - 1, 1, 2);
  }
}

/* ---------- the view ---------- */
function create({canvas, label, onOpen}){
  if(!LAND) buildProps(buildScene());
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fx = makeFx(), WC = [css(WATER.glint), css(WATER.foam)];
  let mobs = [], byG = new Map(), raf = 0, last = 0, t = 0, sel = null;

  function drawWater(){
    const k = Math.floor(t * 9);
    for(let y = HZ; y < H; y++){
      const c = sCx(y), a = Math.ceil(sL(y) - .5), b = Math.floor(sR(y) - .5), row = y * W;
      for(let x = Math.max(0, a); x <= Math.min(W - 1, b); x++){
        if(!isWater[row + x]) continue;
        const u = Math.round(x - c), n = h2(u, y - k), m = h2(u - 1, y - k);
        if(n < .03 || m < .03){ ctx.fillStyle = WC[0]; ctx.fillRect(x, y, 1, 1); }
        else if(n > .996 || ((x === a || x === b) && h2(x, y * 7 + Math.floor(t * 3)) < .25)){ ctx.fillStyle = WC[1]; ctx.fillRect(x, y, 1, 1); }
        else if(!isWater[row - W + x] && y > HZ && h2(x, Math.floor(t * 5)) < .6){ ctx.fillStyle = WC[1]; ctx.fillRect(x, y, 1, 1); }   // foam below a stone
      }
    }
  }
  function frame(){
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(SKYC, 0, 0);
    for(const cl of CLOUDS){ const span = W + cl.cv.width * 2, x = ((cl.x + t * cl.v) % span + span) % span - cl.cv.width; ctx.drawImage(cl.cv, Math.round(x), cl.y); }
    ctx.drawImage(LAND, 0, 0);
    drawWater();
    const items = PROPS.concat(mobs.map(c => ({y: c.y + .5, c})));
    items.sort((a, b) => a.y - b.y);
    for(const it of items) it.c ? drawCreature(ctx, it.c, t) : it.draw(ctx, t);
    fx.draw(ctx); drawButterflies(ctx, t);
    if(sel) placeLabel();
  }
  function tick(now){
    raf = requestAnimationFrame(tick);
    const dt = Math.min(.1, (now - last) / 1000 || 0);
    if(dt < 1 / 32) return;   // ~30 fps is plenty for pixel art
    last = now; t += dt;
    for(const c of mobs) stepCreature(c, dt, fx);
    fx.step(dt, t);
    frame();
  }
  function placeLabel(){
    const c = sel, top = c.y - FOOT - liftOf(c, t) + c.spr.y0 - 3;
    label.style.left = (c.x / W * 100) + '%'; label.style.top = (Math.max(0, top) / H * 100) + '%';
  }
  function select(c){
    if(sel) sel.sel = false;
    sel = c;
    if(!c){ label.hidden = true; if(still) frame(); return; }
    c.sel = true;
    if(!still && (c.st === 'idle' || c.st === 'glide')){ c.happy = 2; c.tx = c.x; c.ty = c.y; c.lift = 0; nextHop(c); }
    const R = RARITY[c.t.rarity];
    label.innerHTML = `<b></b><span class="r-${c.t.rarity}">${R.label}</span><button type="button">View</button>`;
    label.querySelector('b').textContent = c.t.name;
    label.querySelector('button').addEventListener('click', e => { e.stopPropagation(); onOpen(c.g); });
    label.hidden = false; placeLabel();
    if(still) frame();
  }
  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, py = (e.clientY - r.top) / r.height * H;
    const hit = mobs.slice().sort((a, b) => b.y - a.y).find(c => {
      const lx = px - (Math.round(c.x) - Math.round(CXS + .5)), ly = py - (Math.round(c.y) - FOOT - liftOf(c, t));
      return lx >= c.spr.x0 - 2 && lx <= c.spr.x1 + 3 && ly >= c.spr.y0 - 2 && ly <= c.spr.y1 + 3;
    });
    select(hit && hit !== sel ? hit : null);
  });

  return {
    /* list: [{g, t}], most recent first */
    setCreatures(list){
      const next = new Map();
      for(const {g, t: tr} of list) next.set(g, byG.get(g) || newCreature(g, tr));
      byG = next; mobs = [...next.values()];
      if(sel && !byG.has(sel.g)) select(null);
      frame();
    },
    start(){ if(still){ frame(); return; } if(!raf){ last = performance.now(); raf = requestAnimationFrame(tick); } },
    stop(){ if(raf) cancelAnimationFrame(raf); raf = 0; select(null); },
  };
}

window.Pasture = {create, W, H};
})();
