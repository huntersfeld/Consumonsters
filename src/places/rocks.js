/* The red rocks: the reptiles' place. Warm desert sand under red mesas, with big flat slabs of sandstone to bask
   on, cacti, a dry wash and a little spring pool. The air shimmers over the far mesas and tumbleweeds roll by on
   the wind. */
(() => {
'use strict';
const K = window.PastureScene;
const {W, H, HZ, rgb, css, hi, lo, shift, bayer, h2, wind, layer, blade, WATER, hash32, mulberry} = K;
const SAND = [34, 58, 66], RED = [18, 52, 54], FARMESA = [16, 34, 64], NEARMESA = [12, 46, 50];
const SLAB = [22, 46, 62], SLABFACE = [14, 50, 42], OUT = [10, 40, 22];
const CACTUS = [110, 30, 36], SPINE = [50, 40, 82], BLOOM = [340, 70, 66];

/* the slabs to bask on: a flat top (centre, half-width, half-depth) and how tall the front face is */
const SLABS = [{x: 130, y: 112, rx: 34, ry: 9, h: 7}, {x: 520, y: 98, rx: 30, ry: 7, h: 6}, {x: 262, y: 160, rx: 40, ry: 10, h: 8}, {x: 566, y: 168, rx: 26, ry: 8, h: 6}];
const POOL = {x: 392, y: 140, rx: 34, ry: 9};
const inPool = (x, y) => { const a = Math.atan2(y - POOL.y, x - POOL.x); return ((x + .5 - POOL.x) / POOL.rx) ** 2 + ((y + .5 - POOL.y) / POOL.ry) ** 2 <= (1 + .08 * Math.sin(3 * a + 1)) ** 2; };
/* the dry wash: a pale, cracked channel that wanders across the front */
const washCy = x => 186 - 10 * Math.sin(x * .012 + .8) - 4 * Math.sin(x * .05);
const SAGUAROS = [{x: 66, y: 150, h: 26, arms: [[-1, 10, 7], [1, 14, 6]]}, {x: 452, y: 112, h: 22, arms: [[1, 9, 6]]}, {x: 620, y: 132, h: 28, arms: [[-1, 12, 8], [1, 8, 6]]}, {x: 200, y: 90, h: 16, arms: [[-1, 6, 4]]}];

K.define('rocks', P => {
  const {isWater, PROPS} = P, rnd = mulberry(hash32('rocks-v1')), ground = new Float32Array(H);
  P.name = 'The red rocks';
  P.NAPS = SLABS.map(s => ({x: s.x, y: s.y - 6}));   // nap target sits just in front of it, which is up on the slab's top
  P.flow = () => [0, 0];
  P.petals = [[34, 50, 76], [28, 40, 68]];
  P.leaves = [[50, 30, 50]];
  P.butterflyPaths = [[0, 120, 60, [40, 90, 66]], [2.4, 300, 110, [0, 0, 97]], [4.1, 410, 70, [340, 70, 72]], [1.2, 560, 120, [40, 90, 66]]];

  const LAND = P.LAND = layer();
  const ctx = LAND.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const set = (x, y, c, a = 255) => {if(x < 0 || y < 0 || x >= W || y >= H) return; const [r, g, b] = rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;};

  // the mesas: flat-topped buttes along the horizon, the far ones hazy, with bands down their faces
  const mesa = (x, list) => { let top = HZ; for(const [cx, w, h, sl] of list){ const e = Math.abs(x - cx) - w; if(e < 0) top = Math.min(top, HZ - h); else if(e < sl) top = Math.min(top, HZ - h * (1 - e / sl)); } return Math.round(top); };
  const FARS = [[70, 40, 18, 14], [190, 22, 12, 10], [330, 60, 22, 18], [470, 26, 15, 12], [590, 44, 20, 16]];
  const NEARS = [[120, 18, 10, 20], [400, 24, 13, 22], [540, 14, 8, 16]];
  for(let x = 0; x < W; x++){
    const ft = mesa(x, FARS), nt = mesa(x, NEARS);
    for(let y = ft; y < HZ; y++) set(x, y, y === ft ? hi(FARMESA) : (y - ft) % 4 === 2 ? shift(FARMESA, -4) : FARMESA);
    for(let y = nt; y < HZ; y++) set(x, y, y === nt ? hi(NEARMESA) : (y - nt) % 3 === 1 ? shift(NEARMESA, -5) : bayer(x, y) > .8 ? shift(NEARMESA, 3) : NEARMESA);
  }

  // the sand: pale toward the back, redder in drifts, with ripples and pebbles
  for(let y = HZ; y < H; y++){
    const dpt = (y - HZ) / (H - HZ), L = 70 - 12 * dpt; ground[y] = L;
    for(let x = 0; x < W; x++){
      const q = L / 3, i = Math.floor(q), Lb = (i + (q - i > bayer(x, y) ? 1 : 0)) * 3;
      let c = [SAND[0] - 2 * dpt, SAND[1], Lb];
      const drift = Math.sin(y * (.11 + .05 * dpt) + 2.2 * Math.sin(x * .013 + 1) + .7 * Math.sin(x * .041)) + .5 * Math.sin(x * .017 - y * .02 + 3);   // long drifts of redder sand, combed by the wind
      if(drift > 1.15 + (bayer(x, y) - .5) * .25) c = [RED[0], RED[1], Lb - 6];
      if((y * 3 + Math.round(4 * Math.sin(x * .08 + y * .2))) % 13 === 0 && bayer(x, y) > .3) c = shift(c, -4);   // ripples in the sand
      const n = rnd();
      if(n < .03) c = shift(c, -6, -10); else if(n < .05) c = shift(c, 0, 0, 6);
      set(x, y, c);
    }
  }
  // the dry wash, its sand pale and cracked into plates
  for(let x = 0; x < W; x++){
    const cy = washCy(x), hw = 5 + 2 * Math.sin(x * .03);
    for(let y = Math.ceil(cy - hw); y <= Math.floor(cy + hw); y++){
      if(y < HZ || y >= H) continue;
      const edge = Math.abs(y - cy) > hw - 1, crack = h2(x >> 2, (y + (x >> 2)) >> 1) < .2 && bayer(x, y) > .4;
      set(x, y, edge ? shift(SAND, -4, -10) : crack ? shift(SAND, -6, -12) : shift(SAND, -8, 8));
    }
  }
  // the spring pool, with wet sand round it
  for(let y = POOL.y - POOL.ry - 3; y <= POOL.y + POOL.ry + 3; y++) for(let x = POOL.x - POOL.rx - 5; x <= POOL.x + POOL.rx + 5; x++){
    if(inPool(x, y)){
      const e = ((x - POOL.x) / POOL.rx) ** 2 + ((y - POOL.y) / POOL.ry) ** 2;
      set(x, y, e > .75 ? WATER.shallow : e > .3 + bayer(x, y) * .1 ? WATER.mid : WATER.deep); isWater[y * W + x] = 1;
    } else if(inPool(x - 2, y) || inPool(x + 2, y) || inPool(x, y - 1) || inPool(x, y + 1)) set(x, y, shift(SAND, -6, 0, -18));
  }
  // the slabs: a striped front face and a flat, sun-warmed top with a darker rim
  for(const {x: sx, y: sy, rx, ry, h} of SLABS){
    const inTop = (x, y) => { const a = Math.atan2(y - sy, x - sx); return ((x + .5 - sx) / rx) ** 4 + ((y + .5 - sy) / ry) ** 2 <= (1 + .06 * Math.sin(4 * a + sx)) ** 2; };
    for(let y = -2; y <= 3; y++) for(let x = -rx - 4; x <= rx + 6; x++) if(((x - 2) / (rx + 5)) ** 2 + (y / 3) ** 2 <= 1) set(sx + x, sy + ry + h + y, shift(SAND, -4, -6, -14));   // its shadow
    const bottom = {};
    for(let x = sx - rx - 2; x <= sx + rx + 2; x++) for(let y = sy + ry + 2; y >= sy - ry - 2; y--) if(inTop(x, y)){ bottom[x] = y; break; }
    for(const k in bottom){
      const x = +k, b = bottom[x], left = !(x - 1 in bottom), right = !(x + 1 in bottom);
      for(let y = b + 1; y <= b + h; y++){
        const band = (y - b + (x >> 3)) % 3 === 0;
        set(x, y, left || right || y === b + h ? OUT : band ? shift(SLABFACE, -6) : x > sx + rx * .5 ? lo(SLABFACE) : SLABFACE);
      }
    }
    for(let y = sy - ry - 2; y <= sy + ry + 2; y++) for(let x = sx - rx - 2; x <= sx + rx + 2; x++){
      if(!inTop(x, y)) continue;
      const edge = !inTop(x - 1, y) || !inTop(x + 1, y) || !inTop(x, y - 1);
      let c = edge ? shift(SLAB, -4, -10) : SLAB;
      if(!edge && h2(x, y) < .08) c = shift(SLAB, -4, -8); else if(!edge && bayer(x, y) > .9) c = hi(SLAB);
      set(x, y, c);
    }
  }
  // pebbles and small stones
  for(let n = 0; n < 60; n++){
    const x = Math.floor(rnd() * W), y = HZ + 6 + Math.floor(rnd() * (H - HZ - 8));
    if(isWater[y * W + x]) continue;
    const c = rnd() < .5 ? shift(RED, -6, -8) : shift(SAND, -10, -20);
    set(x, y, c); if(rnd() < .5) set(x + 1, y, lo(c)); set(x, y + 1, OUT, 90);
  }
  ctx.putImageData(img, 0, 0);

  /* props: cacti (they stand among the creatures, so they're drawn in depth order), dry tufts, and reeds at the pool */
  const px = (ctx, x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const CA = css(CACTUS), CL = css(hi(CACTUS)), CD = css(lo(CACTUS)), SP = css(SPINE), BL = css(BLOOM);
  for(const {x, y, h, arms} of SAGUAROS) PROPS.push({x, y, draw(ctx){
    px(ctx, x - 4, y, css(shift(SAND, -4, -6, -14)), 9, 1);
    px(ctx, x - 2, y - h, CA, 4, h); px(ctx, x - 2, y - h, CL, 1, h); px(ctx, x + 1, y - h, CD, 1, h); px(ctx, x - 1, y - h - 1, CA, 2, 1);
    for(const [s, at, len] of arms){
      const ax = s < 0 ? x - 5 : x + 2, ay = y - at;
      px(ctx, s < 0 ? ax : x + 2, ay, CA, 3, 2);
      px(ctx, s < 0 ? ax : ax + 1, ay - len, CA, 2, len); px(ctx, s < 0 ? ax : ax + 1, ay - len, CL, 1, len);
    }
    for(let i = 3; i < h; i += 4) px(ctx, x - 3 + (i & 1) * 6, y - i, SP);
    if(h > 20) px(ctx, x, y - h - 2, BL, 1, 1);
  }});
  for(let n = 0; n < 14; n++){   // barrel cacti and prickly pears
    const x = Math.floor(rnd() * W), y = HZ + 14 + Math.floor(rnd() * (H - HZ - 18));
    if(isWater[y * W + x] || SLABS.some(s => Math.abs(x - s.x) < s.rx + 6 && y > s.y - s.ry - 4 && y < s.y + s.ry + s.h + 4) || inPool(x, y + 3) || inPool(x, y - 3)) continue;
    const pear = rnd() < .5, flower = rnd() < .5;
    PROPS.push({x, y, draw(ctx){
      if(pear){ px(ctx, x - 3, y - 4, CA, 3, 4); px(ctx, x, y - 6, CA, 3, 5); px(ctx, x - 3, y - 4, CL, 1, 3); px(ctx, x + 2, y - 6, CD, 1, 5); px(ctx, x - 1, y - 9, CA, 2, 3); if(flower) px(ctx, x - 1, y - 10, BL, 2, 1); }
      else { px(ctx, x - 2, y - 4, CA, 5, 4); px(ctx, x - 1, y - 5, CA, 3, 1); px(ctx, x - 2, y - 4, CL, 1, 4); px(ctx, x + 2, y - 4, CD, 1, 4); px(ctx, x, y - 4, CD, 1, 4); if(flower) px(ctx, x, y - 6, css([48, 90, 60]), 1, 1); }
    }});
  }
  const dry = [css([40, 30, 46]), css([42, 36, 56]), css([44, 40, 68])];
  for(let n = 0; n < 260; n++){
    const x = Math.floor(rnd() * W), y = HZ + 4 + Math.floor(rnd() ** .8 * (H - HZ - 4));
    if(isWater[y * W + x] || inPool(x, y + 2) || SLABS.some(s => Math.abs(x - s.x) < s.rx + 2 && y > s.y - s.ry - 2 && y < s.y + s.ry + s.h + 2)) continue;
    const dd = (y - HZ) / (H - HZ), blades = Array.from({length: 2 + Math.floor(rnd() * 3)}, () => ({dx: Math.round((rnd() - .5) * 4), h: Math.max(2, Math.round((2 + rnd() * 3) * (.5 + .5 * dd))), lean: (rnd() - .5) * 1.6}));
    PROPS.push({x, y, draw(ctx, t){ for(const b of blades) blade(ctx, x + b.dx, y, b.h, b.lean + wind(x, t) * b.h * .2, dry); }});
  }
  const reed = [css([78, 40, 30]), css([74, 42, 40]), css([62, 48, 54])];
  for(let a = 0; a < Math.PI * 2; a += .45){
    if(rnd() < .35) continue;
    const x = Math.round(POOL.x + Math.cos(a) * (POOL.rx + 3)), y = Math.round(POOL.y + Math.sin(a) * (POOL.ry + 2)), ph = rnd() * 6;
    const stalks = Array.from({length: 2 + Math.floor(rnd() * 2)}, (_, i) => ({dx: i - 1, h: 7 + Math.floor(rnd() * 5), lean: (rnd() - .5) * 1.5}));
    PROPS.push({x, y, draw(ctx, t){ for(const s of stalks) blade(ctx, x + s.dx, y, s.h, s.lean + wind(x, t + ph * .03) * s.h * .14, reed); }});
  }

  /* each frame: glints on the pool, the air shimmering over the far mesas, and the odd tumbleweed */
  const GL = css(WATER.glint), TW = [css([36, 34, 44]), css([38, 40, 58])];
  const weeds = [{y: 128, v: 22, ph: 0, s: 3}, {y: 176, v: 30, ph: 23, s: 4}];
  P.drawWater = (ctx, t, x0, x1) => {
    ctx.fillStyle = GL;
    for(let y = POOL.y - POOL.ry; y <= POOL.y + POOL.ry; y++) for(let x = POOL.x - POOL.rx; x <= POOL.x + POOL.rx; x++)
      if(isWater[y * W + x] && h2(x + Math.floor(t * 2), y) < .025) ctx.fillRect(x, y, 1, 1);
    for(let y = HZ - 22; y < HZ; y++){   // heat haze: rows of the mesas slide a pixel back and forth
      const o = Math.round(Math.sin(t * 3.1 + y * .9) * .7);
      if(o && h2(y, Math.floor(t * 4)) < .5) ctx.drawImage(LAND, Math.max(0, x0), y, Math.min(W, x1) - Math.max(0, x0), 1, Math.max(0, x0) + o, y, Math.min(W, x1) - Math.max(0, x0), 1);
    }
    for(const w of weeds){   // a tumbleweed every so often: it rolls across in a series of bounces
      const span = W * 3, along = ((t * w.v + w.ph * 40) % span), x = Math.round(along - 20);
      if(x < -10 || x > W + 10 || x < x0 - 8 || x > x1 + 8) continue;
      const y = Math.round(w.y - Math.abs(Math.sin(along * .06)) * 6), r = w.s, spin = Math.floor(along * .3);
      ctx.fillStyle = 'rgba(80,60,40,.25)'; ctx.fillRect(x - r, w.y + 1, r * 2 + 1, 1);
      for(let dy = -r; dy <= r; dy++) for(let dx = -r; dx <= r; dx++){
        const k = dx * dx + dy * dy; if(k > r * r + 1) continue;
        if(((dx + dy + spin) & 1) && k > 1){ ctx.fillStyle = TW[(dx - dy + spin) & 1]; ctx.fillRect(x + dx, y + dy, 1, 1); }
      }
    }
  };
});
})();
