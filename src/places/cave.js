/* The crystal cave: the minerals' place. A great cavern whose wide mouth looks out on the sky, with a stone floor,
   stalagmites, a still pool and clusters of crystal growing everywhere. The crystals glow, softly by day and
   brightly after dark, so this is the brightest place to visit at night. */
(() => {
'use strict';
const K = window.PastureScene;
const {W, H, HZ, rgb, css, hi, lo, shift, bayer, h2, layer, WATER, hash32, mulberry} = K;
const ROCK = [228, 14, 30], FLOOR = [222, 12, 40], FAR = [150, 18, 56];
const HUES = {amethyst: [276, 60, 62], aqua: [182, 70, 58], rose: [330, 64, 70], citrine: [46, 86, 60]};

/* the mouth of the cave: an arch the sky shows through */
const MOUTH = {x: 330, y: HZ - 4, rx: 210, ry: 62};
const inMouth = (x, y) => { const a = Math.atan2(y - MOUTH.y, x - MOUTH.x); return y < HZ && ((x - MOUTH.x) / MOUTH.rx) ** 2 + ((y - MOUTH.y) / MOUTH.ry) ** 2 <= (1 + .05 * Math.sin(9 * a) + .03 * Math.sin(23 * a)) ** 2; };
const POOL = {x: 430, y: 166, rx: 50, ry: 12};
const inPool = (x, y) => { const a = Math.atan2(y - POOL.y, x - POOL.x); return ((x + .5 - POOL.x) / POOL.rx) ** 2 + ((y + .5 - POOL.y) / POOL.ry) ** 2 <= (1 + .08 * Math.sin(3 * a + 1) + .04 * Math.sin(8 * a)) ** 2; };
/* crystal clusters: where they grow, what colour, how big; the big ones are for napping beside */
const CLUSTERS = [{x: 70, y: 120, hue: 'amethyst', s: 1.3}, {x: 196, y: 168, hue: 'aqua', s: 1.1}, {x: 560, y: 116, hue: 'rose', s: 1.2}, {x: 610, y: 182, hue: 'amethyst', s: 1},
  {x: 300, y: 104, hue: 'citrine', s: .8}, {x: 128, y: 186, hue: 'rose', s: .7}, {x: 486, y: 96, hue: 'aqua', s: .7}, {x: 372, y: 192, hue: 'amethyst', s: .6}];
const STALAGMITES = [[30, 170, 9, 32], [250, 128, 5, 18], [520, 154, 7, 24], [636, 140, 8, 30], [404, 112, 4, 12], [160, 104, 4, 12]];

K.define('cave', P => {
  const {isWater, PROPS} = P, rnd = mulberry(hash32('cave-v1')), ground = new Float32Array(H);
  P.name = 'The crystal cave';
  P.NAPS = CLUSTERS.filter(c => c.s >= 1).map(c => ({x: c.x + 12, y: c.y - 4}));
  P.flow = (x, y) => [Math.sin(y * .2) * 1.5, Math.cos(x * .1)];
  P.seeds = false;
  P.butterflyPaths = [];
  P.lift = .45;   // the crystals light the place up: night here is much less dark than outside

  const LAND = P.LAND = layer();
  const ctx = LAND.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const set = (x, y, c, a = 255) => {if(x < 0 || y < 0 || x >= W || y >= H) return; const [r, g, b] = rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;};

  // the cave wall all round the mouth, dark and craggy, lighter at the lip where the daylight catches it
  for(let y = 0; y < HZ + 10; y++) for(let x = 0; x < W; x++){
    if(inMouth(x, y)) continue;
    const lip = [1, 2, 3].some(k => inMouth(x, y + k) || inMouth(x - k, y) || inMouth(x + k, y));
    let c = shift(ROCK, -y / HZ * 6);
    const v = Math.sin(y * .5 + 2.5 * Math.sin(x * .025) + Math.sin(x * .09)) + .45 * Math.sin(x * .3 + y * .7);   // rough, layered rock
    if(v > 1 + (bayer(x, y) - .5) * .3) c = shift(c, 5); else if(v < -1.1) c = shift(c, -6);
    if(bayer(x, y) > .9) c = shift(c, 3);
    set(x, y, lip ? hi(ROCK) : c);
  }
  // stalactites hanging from the top of the mouth
  for(let i = 0; i < 26; i++){
    const sx = Math.round(MOUTH.x + (rnd() - .5) * MOUTH.rx * 1.9);
    let top = 0; while(top < HZ && !inMouth(sx, top)) top++;
    if(top >= HZ - 10) continue;
    const len = 4 + Math.floor(rnd() * 12), w = 1 + Math.floor(rnd() * 3);
    for(let k = 0; k < len; k++){ const ww = Math.max(0, Math.round(w * (1 - k / len))); for(let j = -ww; j <= ww; j++) set(sx + j, top + k, j < 0 ? hi(ROCK) : ROCK); }
  }
  // through the mouth: far hills, and the light falling on the floor just inside
  const hill = x => HZ - 8 + 3 * Math.sin(x * .04) + 2 * Math.sin(x * .11 + 1);
  for(let x = 0; x < W; x++) for(let y = Math.ceil(hill(x)); y < HZ; y++) if(inMouth(x, y)) set(x, y, y === Math.ceil(hill(x)) ? hi(FAR) : FAR);
  // the floor: worn stone, lit near the mouth and dimmer toward the sides and front, with cracks and pebbles
  for(let y = HZ; y < H; y++){
    const dpt = (y - HZ) / (H - HZ), L0 = 44 - 12 * dpt; ground[y] = L0;
    for(let x = 0; x < W; x++){
      const lit = Math.max(0, 1 - Math.abs(x - MOUTH.x) / (MOUTH.rx + 40)) * (1 - dpt * .7), L = L0 - 10 + lit * 14;
      const q = L / 3, i = Math.floor(q), Lb = (i + (q - i > bayer(x, y) ? 1 : 0)) * 3;
      let c = [FLOOR[0], FLOOR[1] - lit * 4, Lb];
      const crack = Math.abs(Math.sin(x * .07 + y * .21 + Math.sin(x * .02) * 3)) < .025 || Math.abs(Math.sin(x * .13 - y * .17 + 1)) < .02;
      if(crack) c = shift(c, -10);
      else if(h2(x >> 2, y >> 1) < .12) c = shift(c, 4);
      const n = rnd(); if(n < .03) c = shift(c, -6); else if(n < .05) c = shift(c, 6);
      set(x, y, c);
    }
  }
  for(let x = 0; x < W; x++) if(!inMouth(x, HZ - 1)) for(let k = 0; k < 4; k++) set(x, HZ + k, shift(ROCK, -k));   // where the wall meets the floor
  // the pool: still and deep, with a rim of wet stone
  for(let y = POOL.y - POOL.ry - 3; y <= POOL.y + POOL.ry + 3; y++) for(let x = POOL.x - POOL.rx - 5; x <= POOL.x + POOL.rx + 5; x++){
    if(inPool(x, y)){
      const e = ((x - POOL.x) / POOL.rx) ** 2 + ((y - POOL.y) / POOL.ry) ** 2;
      set(x, y, e > .75 ? [184, 50, 44] : e > .3 + bayer(x, y) * .1 ? [192, 56, 32] : [200, 60, 22]); isWater[y * W + x] = 1;
    } else if(inPool(x - 2, y) || inPool(x + 2, y) || inPool(x, y + 1) || inPool(x, y - 1)) set(x, y, shift(FLOOR, -8, 0, 8));
  }
  // little shards of crystal poking out of the floor
  const shardC = Object.values(HUES);
  for(let n = 0; n < 60; n++){
    const x = Math.floor(rnd() * W), y = HZ + 8 + Math.floor(rnd() * (H - HZ - 10));
    if(isWater[y * W + x]) continue;
    const c = shardC[Math.floor(rnd() * shardC.length)], h = 2 + Math.floor(rnd() * 3);
    for(let k = 0; k < h; k++){ set(x, y - k, k === h - 1 ? hi(c) : c); if(k < h - 1) set(x + 1, y - k, lo(c)); }
  }
  ctx.putImageData(img, 0, 0);

  /* props in depth order: stalagmites and the crystal clusters, each painted once into its own little canvas */
  const sprite = (w, h, paint) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); paint((x, y, col) => { c.fillStyle = css(col); c.fillRect(x, y, 1, 1); }); return cv; };
  for(const [x, y, r, h] of STALAGMITES){
    const cv = sprite(r * 2 + 3, h + 2, px => {
      for(let k = 0; k <= h; k++){ const w = Math.round(r * Math.pow(k / h, .7)); for(let j = -w; j <= w; j++) px(r + 1 + j, k, j < -w / 3 ? hi(ROCK) : j > w / 3 ? lo(ROCK) : shift(ROCK, 4)); }
    });
    PROPS.push({x, y, draw(ctx){ ctx.drawImage(cv, x - r - 1, y - h); }});
  }
  for(const cl of CLUSTERS){
    const base = HUES[cl.hue], n = 3 + Math.round(cl.s * 3);
    const prisms = Array.from({length: n}, (_, i) => ({ang: (i - (n - 1) / 2) * .32 + (rnd() - .5) * .2, len: (8 + rnd() * 14) * cl.s * (i === Math.floor(n / 2) ? 1.4 : 1), w: (2 + rnd() * 2) * cl.s, dx: (i - (n - 1) / 2) * 3 * cl.s}));
    const bw = Math.ceil(40 * cl.s) + 8, bh = Math.ceil(36 * cl.s) + 4, ox = bw / 2, oy = bh - 2;
    cl.top = oy;
    const cv = sprite(bw, bh, px => {
      for(let y = -2; y <= 2; y++) for(let x = -bw / 2 + 2; x < bw / 2 - 2; x++) if((x / (bw / 2 - 2)) ** 2 + (y / 2.5) ** 2 <= 1) px(ox + x, oy + y, shift(FLOOR, -12));   // a dark base
      for(const p of [...prisms].sort((a, b) => b.len - a.len)){
        const ux = Math.sin(p.ang), uy = -Math.cos(p.ang), vx = -uy, vy = ux;
        for(let s = 0; s <= p.len; s += .5){
          const k = s / p.len, w = k > .72 ? p.w * (1 - k) / .28 : p.w;
          for(let t = -w; t <= w; t += .5){
            const X = Math.round(ox + p.dx + ux * s + vx * t), Y = Math.round(oy + uy * s + vy * t);
            const c = Math.abs(t) > w - .7 ? lo(lo(base)) : k > .72 ? (t < 0 ? hi(hi(base)) : hi(base)) : t < -w * .3 ? hi(base) : t > w * .35 ? lo(base) : base;
            px(X, Y, c);
          }
        }
      }
    });
    PROPS.push({x: cl.x, y: cl.y, draw(ctx){ ctx.drawImage(cv, cl.x - ox, cl.y - oy); }});
    cl.glow = css(hi(base)); cl.r = 18 * cl.s;
  }

  /* each frame, under the light: ripples on the pool, and glints along the crystal tips */
  const GL = css([180, 60, 80]);
  P.drawWater = (ctx, t) => {
    ctx.fillStyle = GL;
    for(let y = POOL.y - POOL.ry; y <= POOL.y + POOL.ry; y++) for(let x = POOL.x - POOL.rx; x <= POOL.x + POOL.rx; x++)
      if(isWater[y * W + x] && h2(x + Math.floor(t), y * 5) < .012) ctx.fillRect(x, y, 1, 1);
  };
  /* and over the light: the crystals' glow, which pulses gently and gets stronger as the light outside fades */
  const motes = Array.from({length: 40}, () => ({x: rnd() * W, y: HZ + rnd() * (H - HZ), ph: rnd() * 6, v: 2 + rnd() * 3}));
  P.drawGlow = (ctx, t, lt, x0, x1) => {
    const night = lt ? lt.night : 0, strength = .35 + .65 * night;
    ctx.globalCompositeOperation = 'lighter';
    for(const cl of CLUSTERS){
      if(cl.x + cl.r * 2 < x0 || cl.x - cl.r * 2 > x1) continue;
      const pulse = .85 + .15 * Math.sin(t * 1.1 + cl.x * .05), cy = cl.y - 10 * cl.s;
      ctx.fillStyle = cl.glow;
      for(let ring = 3; ring >= 1; ring--){   // three soft rings of light, brighter toward the middle
        const r = cl.r * ring / 2.2;
        ctx.globalAlpha = strength * pulse * .1;
        for(let y = -Math.round(r * .6); y <= Math.round(r * .6); y++){ const hw = Math.round(r * Math.sqrt(1 - (y / (r * .6 + .5)) ** 2)); ctx.fillRect(Math.round(cl.x - hw), Math.round(cy + y), hw * 2, 1); }
      }
    }
    // motes of light drifting up from the floor
    for(const m of motes){
      const y = HZ + ((m.y - HZ - t * m.v) % (H - HZ) + (H - HZ)) % (H - HZ), x = Math.round(m.x + 3 * Math.sin(t * .5 + m.ph));
      if(x < x0 || x > x1) continue;
      ctx.globalAlpha = strength * (.4 + .4 * Math.sin(t * 2 + m.ph)); ctx.fillStyle = '#cfe9ff'; ctx.fillRect(x, Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
});
})();
