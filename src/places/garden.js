/* The undergrowth: the insects' place. The bottom of a garden bed seen from down low, where everything is huge:
   dark soil and moss under giant leaves, toadstools to nap under, clover, a puddle with a leaf floating on it, and
   sunflowers looking over the garden fence. */
(() => {
'use strict';
const K = window.PastureScene;
const {W, H, HZ, rgb, css, hi, lo, shift, bayer, h2, wind, layer, blade, WATER, hash32, mulberry} = K;
const SOIL = [26, 34, 26], MOSS = [92, 44, 36], PLANK = [30, 34, 52], SUN = [46, 92, 58], DISC = [24, 60, 24];
const LEAF = [104, 44, 36], CAP = [4, 72, 50], STEM = [40, 30, 86], LITTER = [[24, 60, 44], [34, 64, 50], [14, 56, 40]];

const PUDDLE = {x: 300, y: 150, rx: 40, ry: 10};
const inPuddle = (x, y) => { const a = Math.atan2(y - PUDDLE.y, x - PUDDLE.x); return ((x + .5 - PUDDLE.x) / PUDDLE.rx) ** 2 + ((y + .5 - PUDDLE.y) / PUDDLE.ry) ** 2 <= (1 + .1 * Math.sin(3 * a + 2) + .05 * Math.sin(7 * a)) ** 2; };
/* toadstools: where they stand, how tall and how wide the cap is; the big ones are for napping under */
const SHROOMS = [{x: 96, y: 128, h: 20, r: 15}, {x: 116, y: 134, h: 11, r: 8}, {x: 470, y: 112, h: 17, r: 13}, {x: 560, y: 176, h: 24, r: 17}, {x: 222, y: 98, h: 13, r: 10}, {x: 382, y: 186, h: 10, r: 7}];
/* clumps of big leaves fanning out from the ground */
const CLUMPS = [{x: 30, y: 100, s: 1.1}, {x: 180, y: 170, s: 1.3}, {x: 390, y: 104, s: 1}, {x: 620, y: 120, s: 1.2}, {x: 470, y: 192, s: .9}];

K.define('garden', P => {
  const {isWater, PROPS} = P, rnd = mulberry(hash32('garden-v1')), ground = new Float32Array(H);
  P.name = 'The undergrowth';
  P.NAPS = SHROOMS.filter(m => m.r >= 13).map(m => ({x: m.x, y: m.y - 4}));
  P.flow = (x, y) => [Math.sin(y * .3) * 2, Math.cos(x * .2) * 1];   // a ball in the puddle just bobs about
  P.petals = [[0, 0, 97], [52, 80, 70]];
  P.leaves = [[30, 60, 46], [20, 56, 42]];
  P.butterflyPaths = [[0, 80, 40, [50, 92, 72]], [2.4, 260, 70, [200, 80, 70]], [4.1, 420, 50, [22, 88, 62]], [1.2, 540, 90, [0, 0, 97]], [3.3, 330, 120, [300, 50, 70]]];

  const LAND = P.LAND = layer();
  const ctx = LAND.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const set = (x, y, c, a = 255) => {if(x < 0 || y < 0 || x >= W || y >= H) return; const [r, g, b] = rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;};

  // sunflowers behind the fence, nodding over it
  const FB = HZ + 6;
  for(const [sx, top, r] of [[64, HZ - 46, 9], [150, HZ - 38, 7], [430, HZ - 50, 10], [508, HZ - 40, 8], [604, HZ - 44, 8]]){
    for(let y = top + r; y < FB; y++){ set(sx, y, [100, 40, 32]); set(sx + 1, y, [100, 40, 26]); }
    for(const dy of [16, 28]){ for(let i = 0; i < 6; i++){ set(sx + 2 + i, top + r + dy - (i >> 1), [104, 40, 34]); set(sx - 1 - i, top + r + dy + 4 - (i >> 1), [104, 40, 30]); } }
    for(let y = -r - 4; y <= r + 4; y++) for(let x = -r - 4; x <= r + 4; x++){
      const k = Math.hypot(x, y), a = Math.atan2(y, x);
      if(k <= r * .55) set(sx + x, top + y, (x + y) & 1 ? DISC : shift(DISC, -4));
      else if(k <= r + 3 + 1.6 * Math.cos(a * 12)) set(sx + x, top + y, k > r + 1 ? shift(SUN, -6) : y < 0 ? hi(SUN) : SUN);
    }
  }
  // the fence: weathered planks along the back
  for(let x = 0; x < W; x++){
    const plank = Math.floor(x / 11), top = HZ - 18 - (plank % 3 === 1 ? 2 : 0) - Math.round(h2(plank, 1) * 2), e = x % 11;
    for(let y = top; y < FB; y++){
      let c = e === 0 ? lo(lo(PLANK)) : e === 1 ? hi(PLANK) : e > 8 ? lo(PLANK) : PLANK;
      if(e > 1 && e < 9 && h2(x, (y >> 2) + plank * 7) < .08) c = shift(c, -6);   // the grain
      if(y === top) c = hi(PLANK);
      set(x, y, c);
    }
    for(const ry of [HZ - 11, FB - 6]) set(x, ry, e === 0 ? lo(lo(PLANK)) : shift(PLANK, 6));   // the rails behind show as nail lines
  }
  // the soil: dark and crumbly, mossy in patches, lighter toward the back where the light comes in
  for(let y = FB; y < H; y++){
    const dpt = (y - HZ) / (H - HZ), L = 34 - 10 * dpt; ground[y] = L;
    for(let x = 0; x < W; x++){
      const q = L / 3, i = Math.floor(q), Lb = (i + (q - i > bayer(x, y) ? 1 : 0)) * 3;
      let c = [SOIL[0], SOIL[1], Lb];
      const m = Math.sin(x * .05 + y * .08) * Math.sin(y * .13 - x * .03 + 1) + .3 * Math.sin(x * .2 + y * .17);
      if(m > .35 + (bayer(x, y) - .5) * .3) c = [MOSS[0], MOSS[1], Lb + 6];
      const n = rnd();
      if(n < .05) c = shift(c, 6); else if(n < .1) c = shift(c, -5);
      set(x, y, c);
    }
  }
  for(let x = 0; x < W; x++){ set(x, FB, [26, 30, 16]); set(x, FB + 1, [26, 30, 20]); }   // the fence's shadow on the soil
  // fallen leaves, each with a midrib
  for(let n = 0; n < 46; n++){
    const cx = Math.floor(rnd() * W), cy = FB + 6 + Math.floor(rnd() * (H - FB - 8)), a = rnd() * Math.PI, len = 4 + rnd() * 4, wd = len * .45, c = LITTER[Math.floor(rnd() * 3)];
    if(inPuddle(cx, cy)) continue;
    const ca = Math.cos(a), sa = Math.sin(a);
    for(let y = -8; y <= 8; y++) for(let x = -8; x <= 8; x++){
      const u = x * ca + y * sa, v = (-x * sa + y * ca) / .6;
      if((u / len) ** 2 + (v / wd) ** 2 > 1) continue;
      set(cx + x, cy + y, Math.abs(v) < .7 ? lo(c) : v < 0 ? hi(c) : c);
    }
  }
  // the puddle, with a muddy rim
  for(let y = PUDDLE.y - PUDDLE.ry - 3; y <= PUDDLE.y + PUDDLE.ry + 3; y++) for(let x = PUDDLE.x - PUDDLE.rx - 5; x <= PUDDLE.x + PUDDLE.rx + 5; x++){
    if(inPuddle(x, y)){
      const e = ((x - PUDDLE.x) / PUDDLE.rx) ** 2 + ((y - PUDDLE.y) / PUDDLE.ry) ** 2;
      set(x, y, shift(e > .7 ? WATER.shallow : e > .25 + bayer(x, y) * .1 ? WATER.mid : WATER.deep, -10, 0, -10)); isWater[y * W + x] = 1;
    } else if(inPuddle(x - 2, y) || inPuddle(x + 2, y) || inPuddle(x, y + 1) || inPuddle(x, y - 1)) set(x, y, shift(SOIL, 4, 0, 6));
  }
  // pebbles, which are boulders down here
  for(const [bx, by, r] of [[250, 120, 5], [262, 124, 3], [520, 140, 6], [140, 190, 4], [600, 94, 4], [356, 128, 3]]){
    const rx = r + .5, ry = r * .7 + .3, inB = (x, y) => ((x + .5 - bx) / rx) ** 2 + ((y + .5 - by) / ry) ** 2 <= 1;
    for(let y = Math.floor(by - ry - 1); y <= by + ry + 1; y++) for(let x = Math.floor(bx - rx - 1); x <= bx + rx + 1; x++){
      if(!inB(x, y)) continue;
      const edge = !inB(x - 1, y) || !inB(x + 1, y) || !inB(x, y - 1) || !inB(x, y + 1), S = [30, 10, 56];
      set(x, y, edge ? [220, 14, 22] : y + .5 < by - ry * .2 ? hi(S) : y + .5 > by + ry * .3 ? lo(S) : S);
    }
  }
  ctx.putImageData(img, 0, 0);

  /* props, drawn in depth order with the creatures. Big things are painted once into their own little canvas. */
  const sprite = (w, h, paint) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); paint((x, y, col) => { c.fillStyle = css(col); c.fillRect(x, y, 1, 1); }); return cv; };
  // toadstools: a white stem and a spotted red cap, with gills showing underneath
  for(const {x, y, h, r} of SHROOMS){
    const sw = Math.max(2, Math.round(r * .3)), capH = Math.max(4, Math.round(r * .62)), cw = r * 2 + 3, ch = h + capH + 2;
    const cv = sprite(cw, ch, px => {
      const cx = r + 1;
      for(let i = 0; i < h; i++) for(let j = -sw; j <= sw; j++) px(cx + j, ch - 1 - i, j === -sw ? hi(STEM) : j >= sw - 1 ? lo(STEM) : STEM);
      const capY = ch - 1 - h;
      for(let j = -r; j <= r; j++){
        const top = Math.round(capH * Math.sqrt(1 - (j / (r + .5)) ** 2));
        px(cx + j, capY + 1, [30, 30, 66]); if(Math.abs(j) < r - 1) px(cx + j, capY + 2, [30, 26, 58]);   // the gills
        for(let k = 0; k <= top; k++){
          const yy = capY - k, rim = k === top || Math.abs(j) === r;
          let c = rim ? lo(CAP) : k > top - 2 && j < 0 ? hi(CAP) : j > r * .4 ? lo(CAP) : CAP;
          if(!rim && h2(x + j * 3, yy * 5) < .1) c = [0, 0, 96];
          px(cx + j, yy, c);
        }
      }
    });
    PROPS.push({x, y, draw(ctx){ ctx.drawImage(cv, x - r - 1, y - ch + 1); }});
  }
  const DEW = css([190, 60, 94]);
  // big leaves fanning out of the ground, swaying a little in the wind
  for(const {x, y, s} of CLUMPS){
    const n = 4 + Math.floor(rnd() * 2), leaves = Array.from({length: n}, (_, i) => {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * .5 + (rnd() - .5) * .2, len = Math.round((22 + rnd() * 10) * s), wd = Math.round(len * .34);
      const box = len * 2 + 4, cv = sprite(box, box, px => {
        const ca = Math.cos(a), sa = Math.sin(a), o = box / 2, c = shift(LEAF, (rnd() - .5) * 8);
        for(let yy = 0; yy < box; yy++) for(let xx = 0; xx < box; xx++){
          const dx = xx - o, dy = yy - o, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
          if(u < 0 || u > len) continue;
          const half = wd * Math.sin(Math.PI * Math.pow(u / len, .8));
          if(Math.abs(v) > half) continue;
          const edge = Math.abs(v) > half - 1, rib = Math.abs(v) < .7, vein = Math.abs(Math.abs(v) - (u * .4) % 5) < .5 && u > 4;
          px(xx, yy, edge ? lo(c) : rib ? hi(hi(c)) : vein ? hi(c) : v > 0 ? lo(c) : c);
        }
      });
      return {cv, box, ph: rnd() * 6, dew: [Math.round(Math.cos(a) * len * .6), Math.round(Math.sin(a) * len * .6)], dph: rnd() * 6};
    });
    PROPS.push({x, y, draw(ctx, t){
      for(const l of leaves){ const sway = Math.round(wind(x, t + l.ph * .05) * 1.2); ctx.drawImage(l.cv, x - l.box / 2 + sway, y - l.box / 2); }
      ctx.fillStyle = DEW;   // a drop of dew on each leaf, catching the light now and then
      for(const l of leaves) if(Math.sin(t * 1.3 + l.dph) > .6){ const sway = Math.round(wind(x, t + l.ph * .05) * 1.2); ctx.fillRect(x + l.dew[0] + sway, y + l.dew[1], 1, 1); }
    }});
  }
  // clover, tall grass stems and dandelion clocks
  const clover = [css([100, 40, 34]), css([104, 42, 42]), css([106, 44, 50])], stems = [css([96, 36, 28]), css([94, 40, 36]), css([90, 44, 46])];
  for(let n = 0; n < 240; n++){
    const x = Math.floor(rnd() * W), y = FB + 6 + Math.floor(rnd() ** .8 * (H - FB - 6));
    if(inPuddle(x, y + 2) || inPuddle(x, y - 2)) continue;
    const dd = (y - HZ) / (H - HZ), k = rnd();
    if(k < .5){   // a clover: three round leaflets on a stalk
      const h = Math.round((4 + rnd() * 4) * (.6 + .4 * dd)), ph = rnd() * 6;
      PROPS.push({x, y, draw(ctx, t){
        const [hx, hy] = blade(ctx, x, y, h, wind(x, t + ph * .02) * h * .2, stems);
        ctx.fillStyle = clover[1]; ctx.fillRect(hx - 2, hy - 1, 2, 2); ctx.fillRect(hx + 1, hy - 1, 2, 2); ctx.fillStyle = clover[2]; ctx.fillRect(hx - 1, hy - 3, 2, 2);
      }});
    } else if(k < .94){   // grass that towers over everything
      const h = Math.round((14 + rnd() * 16) * (.6 + .4 * dd)), lean = (rnd() - .5) * 4, ph = rnd() * 6;
      PROPS.push({x, y, draw(ctx, t){ blade(ctx, x, y, h, lean + wind(x, t + ph * .02) * h * .12, stems); blade(ctx, x + 1, y, h - 2, lean + wind(x, t + ph * .02) * h * .12, stems); }});
    } else {   // a dandelion clock
      const h = Math.round((18 + rnd() * 10) * (.6 + .4 * dd)), ph = rnd() * 6, white = css([0, 0, 96]), grey = css([0, 0, 80]);
      PROPS.push({x, y, draw(ctx, t){
        const [hx, hy] = blade(ctx, x, y, h, wind(x, t + ph * .02) * h * .1, stems);
        for(let a = 0; a < 12; a++){ const dx = Math.round(Math.cos(a * .52) * 3), dy = Math.round(Math.sin(a * .52) * 3); ctx.fillStyle = a & 1 ? white : grey; ctx.fillRect(hx + dx, hy - 3 + dy, 1, 1); }
        ctx.fillStyle = grey; ctx.fillRect(hx, hy - 3, 1, 1);
      }});
    }
  }

  /* each frame: the puddle's glints, and a leaf turning slowly on it */
  const GL = css(WATER.glint), FL = [css([30, 64, 50]), css(lo([30, 64, 50]))];
  P.drawWater = (ctx, t, x0, x1) => {
    ctx.fillStyle = GL;
    for(let y = PUDDLE.y - PUDDLE.ry - 1; y <= PUDDLE.y + PUDDLE.ry + 1; y++) for(let x = PUDDLE.x - PUDDLE.rx - 4; x <= PUDDLE.x + PUDDLE.rx + 4; x++)
      if(isWater[y * W + x] && h2(x + Math.floor(t * 1.5), y * 3) < .02) ctx.fillRect(x, y, 1, 1);
    const lx = Math.round(PUDDLE.x - 12 + 6 * Math.sin(t * .2)), ly = Math.round(PUDDLE.y - 2 + 2 * Math.sin(t * .3)), a = t * .15;
    for(let i = -4; i <= 4; i++) for(let j = -1; j <= 1; j++){ if(Math.abs(i) === 4 && j) continue; ctx.fillStyle = FL[j === 0 ? 1 : 0]; ctx.fillRect(lx + Math.round(i * Math.cos(a) - j * 2 * Math.sin(a)), ly + Math.round(i * Math.sin(a) * .5 + j), 1, 1); }
  };
});
})();
