/* The sky island: the mythics' place. A green island floating high above a sea of cloud, with a little islet
   beside it, old marble ruins, and a spring whose stream runs off the front edge in a waterfall. By day a rainbow
   stands in the spray; at night the northern lights ripple overhead. */
(() => {
'use strict';
const K = window.PastureScene;
const {W, H, HZ, rgb, css, hi, lo, shift, bayer, h2, wind, layer, blade, WATER, hash32, mulberry} = K;
const GRASS = [110, 46, 50], ROCK = [250, 12, 46], CLOUD = [230, 40, 94], MARBLE = [40, 20, 90];

/* the main island and the islet: wobbly ovals of turf */
const ISLE = {x: 296, y: 128, rx: 252, ry: 56}, ISLET = {x: 594, y: 150, rx: 36, ry: 12};
const inOval = (o, k) => (x, y) => { const a = Math.atan2(y - o.y, x - o.x); return ((x + .5 - o.x) / o.rx) ** 2 + ((y + .5 - o.y) / o.ry) ** 2 <= (1 + .04 * Math.sin(5 * a + k) + .03 * Math.sin(11 * a)) ** 2; };
const onIsle = inOval(ISLE, 1), onIslet = inOval(ISLET, 3);
const onTop = (x, y) => onIsle(x, y) || onIslet(x, y);
/* the spring and its stream, which runs to the front edge and pours off it */
const SPRING = {x: 300, y: 136, rx: 18, ry: 6};
const sCx = y => 300 + (y - SPRING.y) * .6 + 4 * Math.sin((y - SPRING.y) * .2);
const sW = y => 4 + (y - SPRING.y) * .05;
const COLUMNS = [{x: 150, y: 104, h: 26}, {x: 176, y: 100, h: 18, broken: true}, {x: 440, y: 106, h: 28}, {x: 466, y: 112, h: 12, broken: true}, {x: 90, y: 150, h: 20}, {x: 520, y: 140, h: 16, broken: true}];

K.define('sky', P => {
  const {isWater, PROPS} = P, rnd = mulberry(hash32('sky-v1')), ground = new Float32Array(H);
  const gap = P.isGap = new Uint8Array(W * H);
  P.name = 'The sky island';
  P.NAPS = COLUMNS.filter(c => !c.broken).map(c => ({x: c.x, y: c.y - 2}));
  P.flow = (x, y) => [(sCx(y) - x) * 2, 8];
  P.petals = [[50, 90, 70], [330, 60, 84], [0, 0, 97]];
  P.lift = .2;

  const LAND = P.LAND = layer();
  const ctx = LAND.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const set = (x, y, c, a = 255) => {if(x < 0 || y < 0 || x >= W || y >= H) return; const [r, g, b] = rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;};

  // the sea of cloud: soft billows from the horizon down, brighter on top of each billow
  const billow = (x, row) => Math.round(HZ - 2 + row * 13 - 6 * Math.abs(Math.sin(x * (.045 + row * .004) + row * 1.7)) - 2 * Math.abs(Math.sin(x * .13 + row)));   // rows of puffy cloud tops
  for(let x = 0; x < W; x++) for(let y = HZ - 6; y < H; y++){
    let row = -1; for(let r = 0; r < 14; r++) if(y >= billow(x, r)) row = r;
    if(row < 0) continue;
    const top = billow(x, row), k = y - top;
    set(x, y, k === 0 ? [0, 0, 100] : k < 4 ? shift(CLOUD, 3) : k < 9 + bayer(x, y) * 2 ? CLOUD : shift(CLOUD, -5));
    gap[y * W + x] = 1;
  }
  // the islands: turf on top, and their rocky undersides hanging below the front edge
  const front = new Int16Array(W).fill(-1);
  for(let y = HZ; y < H; y++) for(let x = 0; x < W; x++) if(onTop(x, y)) front[x] = y;
  for(let x = 0; x < W; x++){
    if(front[x] < 0) continue;
    const o = onIslet(x, front[x]) ? ISLET : ISLE, depth = Math.round((o === ISLET ? 16 : 44) * Math.sqrt(Math.max(0, 1 - ((x - o.x) / o.rx) ** 2)) + 3 * Math.sin(x * .3));
    for(let k = 1; k <= depth; k++){
      const y = front[x] + k; if(y >= H) break;
      let c = shift(ROCK, -k * .5);
      if((k + Math.round(2 * Math.sin(x * .2))) % 5 === 0) c = shift(c, -6);
      if(k === 1) c = [30, 40, 30];
      if(k > depth - 3 && h2(x, 7) < .5) c = [110, 40, 30];   // roots trailing from the bottom
      set(x, y, c);
    }
  }
  for(let y = HZ; y < H; y++){
    const dpt = (y - HZ) / (H - HZ), L0 = 54 - 10 * dpt; ground[y] = L0;
    for(let x = 0; x < W; x++){
      if(!onTop(x, y)) continue;
      gap[y * W + x] = 0;
      const edge = !onTop(x, y - 1) || !onTop(x - 1, y) || !onTop(x + 1, y);
      const q = L0 / 3, i = Math.floor(q), Lb = (i + (q - i > bayer(x, y) ? 1 : 0)) * 3;
      let c = [GRASS[0], GRASS[1], Lb];
      const v = Math.sin(x * .07 + y * .12) * Math.sin(y * .19 - x * .05 + 1);
      if(v > .5 + (bayer(x, y) - .5) * .2) c = shift(c, 5, -8);
      const n = rnd(); if(n < .05) c = shift(c, 6, -10); else if(n < .09) c = shift(c, -5, 10);
      set(x, y, edge ? hi(GRASS) : c);
    }
  }
  // the spring and the stream down to the edge
  for(let y = SPRING.y - SPRING.ry; y < H; y++){
    const inS = (x, yy) => ((x + .5 - SPRING.x) / SPRING.rx) ** 2 + ((yy + .5 - SPRING.y) / SPRING.ry) ** 2 <= 1;
    for(let x = SPRING.x - SPRING.rx - 30; x <= SPRING.x + SPRING.rx + 40; x++){
      const stream = y > SPRING.y && Math.abs(x - sCx(y)) <= sW(y) / 2;
      if(!(inS(x, y) || stream) || !onTop(x, y)) continue;
      const e = inS(x, y) ? ((x - SPRING.x) / SPRING.rx) ** 2 + ((y - SPRING.y) / SPRING.ry) ** 2 : Math.abs(x - sCx(y)) / (sW(y) / 2);
      set(x, y, e > .7 ? WATER.shallow : e > .3 ? WATER.mid : WATER.deep); isWater[y * W + x] = 1;
    }
  }
  // a stone path ring round the spring
  for(let a = 0; a < Math.PI * 2; a += .3){
    const x = Math.round(SPRING.x + Math.cos(a) * (SPRING.rx + 8)), y = Math.round(SPRING.y + Math.sin(a) * (SPRING.ry + 4));
    if(isWater[y * W + x] || Math.abs(x - sCx(y)) < sW(y) + 3 && y > SPRING.y) continue;
    set(x, y, MARBLE); set(x + 1, y, lo(MARBLE)); set(x, y + 1, lo(lo(MARBLE)));
  }
  ctx.putImageData(img, 0, 0);

  /* props: marble columns (some broken), grass and golden flowers */
  const sprite = (w, h, paint) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); paint((x, y, col) => { c.fillStyle = css(col); c.fillRect(x, y, 1, 1); }); return cv; };
  for(const col of COLUMNS){
    const cv = sprite(14, col.h + 6, px => {
      for(let y = 0; y <= col.h; y++) for(let j = -3; j <= 3; j++){
        let c = j === -3 ? hi(MARBLE) : j >= 2 ? lo(MARBLE) : (j === -1 || j === 1) ? shift(MARBLE, -4) : MARBLE;   // fluted
        if(col.broken && y < 3 && h2(j, y) < .5) continue;
        px(7 + j, col.h + 4 - y, c);
      }
      for(let j = -5; j <= 5; j++){ px(7 + j, col.h + 5, lo(MARBLE)); px(7 + j, col.h + 4, MARBLE); }   // the base
      if(!col.broken) for(let j = -5; j <= 5; j++){ px(7 + j, 2, MARBLE); px(7 + j, 3, lo(MARBLE)); px(7 + j, 1, hi(MARBLE)); }   // the capital
      if(!col.broken) for(let j = -2; j <= 2; j++) px(7 + j, 0, [100, 40, 40]);   // a little ivy on top
    });
    PROPS.push({x: col.x, y: col.y, draw(ctx){ ctx.drawImage(cv, col.x - 7, col.y - col.h - 5); }});
  }
  const cols = y => { const g = [GRASS[0], GRASS[1], ground[y]]; return [css(shift(g, -11, 14, 4)), css(shift(g, 5, -6, 6)), css(hi(shift(g, 8, -4)))]; };
  const GOLD = [css([48, 96, 60]), css([40, 90, 50])], stem = [css([110, 40, 30]), css([104, 42, 38]), css([104, 42, 38])];
  for(let n = 0; n < 600; n++){
    const x = Math.floor(rnd() * W), y = HZ + 8 + Math.floor(rnd() * (H - HZ - 8));
    if(!onTop(x, y) || !onTop(x - 3, y) || !onTop(x + 3, y) || !onTop(x, y + 2) || isWater[y * W + x] || isWater[y * W + x + 2] || isWater[y * W + x - 2]) continue;
    const s = .5 + .5 * (y - HZ) / (H - HZ);
    if(rnd() < .2){
      const h = Math.max(2, Math.round((3 + rnd() * 3) * s)), ph = rnd() * 6;
      PROPS.push({x, y, draw(ctx, t){ const [hx, hy] = blade(ctx, x, y, h, wind(x, t + ph * .02) * h * .2, stem); ctx.fillStyle = GOLD[0]; ctx.fillRect(hx - 1, hy - 1, 3, 1); ctx.fillRect(hx, hy - 2, 1, 1); ctx.fillStyle = GOLD[1]; ctx.fillRect(hx, hy - 1, 1, 1); }});
    } else {
      const blades = Array.from({length: 2 + Math.floor(rnd() * 3)}, () => ({dx: Math.round((rnd() - .5) * 4), h: Math.max(2, Math.round((3 + rnd() * 4) * s)), lean: (rnd() - .5) * 1.4})), c = cols(y);
      PROPS.push({x, y, draw(ctx, t){ for(const b of blades) blade(ctx, x + b.dx, y, b.h, b.lean + wind(x, t) * b.h * .3, c); }});
    }
  }

  /* each frame, under the light: far islands bobbing, cloud wisps drifting past, the stream, the waterfall and its rainbow */
  const fars = [{x: 60, y: HZ - 10, r: 10, ph: 0}, {x: 250, y: HZ - 22, r: 6, ph: 2}, {x: 470, y: HZ - 14, r: 8, ph: 4}].map(f => ({...f, cv: sprite(f.r * 2 + 3, f.r * 2 + 4, px => {
    for(let y = -Math.round(f.r * .4); y <= f.r; y++){ const w = y < 0 ? Math.round(f.r * Math.sqrt(1 - (y / (f.r * .4 + .5)) ** 2)) : Math.round(f.r * (1 - y / (f.r + 1))); for(let j = -w; j <= w; j++) px(j + f.r + 1, y + f.r + 1, y < 0 ? [120, 30, 70] : y === 0 ? [120, 30, 60] : [250, 14, 72]); }
  })}));
  const wisps = Array.from({length: 8}, () => ({y: HZ + rnd() * (H - HZ), x: rnd() * W, v: 3 + rnd() * 4, w: 14 + rnd() * 20}));
  let fy = SPRING.y; while(fy < H - 1 && onTop(Math.round(sCx(fy + 1)), fy + 1)) fy++;   // where the stream reaches the edge
  const fallX = Math.round(sCx(fy)), fallTop = fy + 1;
  const WC = [css(WATER.glint), css(WATER.foam)], WISP = 'rgba(255,255,255,.5)', FALL = [css([196, 60, 80]), css([196, 40, 92]), css([0, 0, 100])];
  const BOW = [[0, 80, 64], [30, 90, 62], [54, 90, 64], [120, 50, 56], [210, 70, 62], [270, 50, 64]].map(css);
  P.drawWater = (ctx, t, x0, x1, lt) => {
    for(const f of fars){ const y = Math.round(f.y + 2 * Math.sin(t * .4 + f.ph)); ctx.drawImage(f.cv, f.x - f.r - 1, y - f.r - 1); }
    const k = Math.floor(t * 8);
    for(let y = SPRING.y; y < H; y++){   // the stream running down to the edge
      for(let x = Math.round(sCx(y) - sW(y)); x <= Math.round(sCx(y) + sW(y)); x++){
        if(!isWater[y * W + x] || x < x0 || x > x1) continue;
        const n = h2(x - Math.round(sCx(y)), y - k);
        if(n < .05){ ctx.fillStyle = WC[0]; ctx.fillRect(x, y, 1, 1); } else if(n > .97){ ctx.fillStyle = WC[1]; ctx.fillRect(x, y, 1, 1); }
      }
    }
    if(fallTop > 0 && fallTop < H){   // the waterfall pouring off the front edge into the clouds
      for(let y = fallTop; y < H; y++) for(let j = -3; j <= 3; j++){
        const n = h2(j + 9, y - Math.floor(t * 30));
        ctx.fillStyle = FALL[n < .3 ? 2 : Math.abs(j) > 2 ? 0 : 1]; ctx.fillRect(fallX + j + Math.round((y - fallTop) * .08), y, 1, 1);
      }
      const day = Math.max(0, 1 - (lt ? lt.night : 0) * 1.6);
      if(day > 0){   // a rainbow standing in the spray
        ctx.globalAlpha = .28 * day;
        BOW.forEach((c, i) => { ctx.fillStyle = c; const r = 34 - i; for(let a = Math.PI * 1.05; a < Math.PI * 1.95; a += .02) ctx.fillRect(Math.round(fallX + 8 + Math.cos(a) * r), Math.round(H + 6 + Math.sin(a) * r * .9), 1, 1); });
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = WISP;
    for(const w of wisps){ const x = Math.round(((w.x + t * w.v) % (W + w.w * 2)) - w.w); if(x > x1 || x + w.w < x0) continue; if(!gap[Math.round(w.y) * W + Math.max(0, Math.min(W - 1, x))]) continue; ctx.fillRect(x, Math.round(w.y), Math.round(w.w), 1); ctx.fillRect(x + 3, Math.round(w.y) - 1, Math.round(w.w * .6), 1); }
  };
  /* over the light: the northern lights, rippling curtains of green and violet across the night sky */
  P.drawGlow = (ctx, t, lt, x0, x1) => {
    const night = lt ? lt.night : 0;
    if(night < .4) return;
    const a = (night - .4) / .6;
    ctx.globalCompositeOperation = 'lighter';
    for(let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++){
      for(const [c, base, amp, ph, al] of [['#3dffa0', 14, 6, 0, .26], ['#a070ff', 6, 5, 2, .2]]){
        const top = base + amp * Math.sin(x * .02 + t * .3 + ph) + 3 * Math.sin(x * .07 - t * .5), len = 12 + 8 * Math.sin(x * .05 + t * .4 + ph);
        const flick = .6 + .4 * Math.sin(x * .3 + t * 1.2 + ph);
        ctx.fillStyle = c;
        for(let i = 0; i < len; i++){ ctx.globalAlpha = a * al * flick * (1 - i / len); ctx.fillRect(x, Math.round(top + i), 1, 1); }
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
});
})();
