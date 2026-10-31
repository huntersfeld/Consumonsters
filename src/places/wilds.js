/* The crossroads: the elementals' place, where four wild lands meet. Fire at the back left (black rock, a smoking volcano and
   pools of lava), air at the back right (pale wind-combed grass under floating rocks), frost at the front left (snow
   and a frozen pond with a hole in the ice) and earth at the front right (rich ground, boulders and shrubs). In the
   middle, a ring of four standing stones, one for each land, with runes that glow after dark. */
(() => {
'use strict';
const K = window.PastureScene;
const {W, H, HZ, rgb, css, hi, lo, shift, bayer, h2, wind, layer, blade, WATER, hash32, mulberry} = K;
const CX = 320, CY = 128;   // where the four lands meet
const ASH = [14, 10, 20], LAVA = [18, 96, 54], AIRG = [52, 44, 70], SNOW = [212, 24, 92], ICE = [196, 48, 78], LOAM = [96, 36, 36];
const STONE = [220, 8, 52], RUNES = {fire: [16, 100, 60], air: [190, 80, 76], frost: [200, 90, 80], earth: [100, 70, 56]};

/* which land a spot belongs to; the borders wander so the lands blend into each other */
const landOf = (x, y) => {
  const fx = x - CX + 18 * Math.sin(y * .09) + 8 * Math.sin(y * .31 + x * .05), fy = y - CY + 7 * Math.sin(x * .05) + 4 * Math.sin(x * .17);
  return fy < 0 ? (fx < 0 ? 'fire' : 'air') : (fx < 0 ? 'frost' : 'earth');
};
const LAVAPOOLS = [{x: 112, y: 104, rx: 26, ry: 7}, {x: 228, y: 92, rx: 12, ry: 4}];
const inLava = (x, y) => LAVAPOOLS.some(p => { const a = Math.atan2(y - p.y, x - p.x); return ((x + .5 - p.x) / p.rx) ** 2 + ((y + .5 - p.y) / p.ry) ** 2 <= (1 + .12 * Math.sin(4 * a + p.x)) ** 2; });
const POND = {x: 120, y: 170, rx: 56, ry: 13}, HOLE = {x: 138, y: 172, rx: 17, ry: 5};
const inPond = (x, y) => { const a = Math.atan2(y - POND.y, x - POND.x); return ((x + .5 - POND.x) / POND.rx) ** 2 + ((y + .5 - POND.y) / POND.ry) ** 2 <= (1 + .07 * Math.sin(5 * a)) ** 2; };
const inHole = (x, y) => ((x + .5 - HOLE.x) / HOLE.rx) ** 2 + ((y + .5 - HOLE.y) / HOLE.ry) ** 2 <= 1 + .15 * Math.sin(x * .7);
const GLYPHS = {fire: [[0, 0], [-1, 1], [1, 1], [0, 2], [-2, 3], [2, 3], [-1, 4], [0, 4], [1, 4]], air: [[-2, 0], [-1, 0], [0, 1], [1, 1], [2, 2], [1, 3], [0, 3], [-1, 4], [-2, 4]],
        frost: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [-2, 2], [-1, 2], [1, 2], [2, 2], [-1, 1], [1, 3]], earth: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-2, 4], [-1, 4], [0, 4], [1, 4], [2, 4], [-2, 2], [2, 2]]};
const STONES = [{x: CX - 30, y: CY - 10, land: 'fire'}, {x: CX + 30, y: CY - 10, land: 'air'}, {x: CX - 34, y: CY + 12, land: 'frost'}, {x: CX + 34, y: CY + 12, land: 'earth'}];

K.define('wilds', P => {
  const {isWater, PROPS} = P, rnd = mulberry(hash32('wilds-v1')), ground = new Float32Array(H);
  const gap = P.isGap = new Uint8Array(W * H);
  P.name = 'The crossroads';
  P.NAPS = STONES.map(s => ({x: s.x + (s.x < CX ? 6 : -6), y: s.y - 4}));
  P.flow = (x, y) => [Math.sin(y * .2) * 1.5, Math.cos(x * .2)];
  P.petals = [[16, 90, 60], [0, 0, 97], [52, 80, 74]];
  P.butterflyPaths = [[0, 480, 70, [50, 92, 72]], [2.4, 540, 130, [0, 0, 97]], [4.1, 420, 110, [22, 88, 62]], [1.2, 600, 60, [200, 80, 70]]];

  const LAND = P.LAND = layer();
  const ctx = LAND.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const set = (x, y, c, a = 255) => {if(x < 0 || y < 0 || x >= W || y >= H) return; const [r, g, b] = rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;};

  // the skyline: a volcano on the fire side, low hills, and far pale cliffs on the air side
  const volcano = x => HZ - Math.max(0, 34 - Math.abs(x - 92) * .55) + (Math.abs(x - 92) < 7 ? 3 : 0);   // a cone with a dip for the crater
  const hills = x => HZ - 6 - 3 * Math.sin(x * .04 + 1) - 2 * Math.sin(x * .13);
  const cliffs = x => x < 400 ? HZ : HZ - 14 - 5 * Math.sin(x * .03) - 3 * Math.sin(x * .11) - (x > 560 ? 6 : 0);
  for(let x = 0; x < W; x++){
    const cy = Math.round(cliffs(x));
    for(let y = cy; y < HZ; y++) set(x, y, y === cy ? [200, 18, 82] : (y - cy) % 4 === 1 ? [210, 14, 70] : [205, 16, 76]);
    const hy = Math.round(hills(x));
    for(let y = hy; y < HZ; y++) set(x, y, y === hy ? hi([x < CX ? 20 : 80, 20, 42]) : [x < CX ? 20 : 80, 20, 40]);
    const vy = Math.round(volcano(x));
    if(vy < HZ) for(let y = vy; y < HZ; y++){
      const crater = Math.abs(x - 92) < 7 && y < vy + 2;
      set(x, y, crater ? LAVA : y === vy ? [10, 12, 30] : (x + y * 2) % 9 === 0 ? [10, 10, 16] : [12, 12, 22]);
    }
  }
  for(let k = 0; k < 18; k++){ const y = HZ - 20 + k, x = 92 + Math.round(4 * Math.sin(k * .9)) - (k >> 2); if(k > 2) set(x, y, LAVA); }   // a lava trickle down its side
  // the four lands
  for(let y = HZ; y < H; y++){
    const dpt = (y - HZ) / (H - HZ); ground[y] = dpt;
    for(let x = 0; x < W; x++){
      const land = landOf(x, y), b = bayer(x, y), n = rnd();
      let c;
      if(land === 'fire'){
        c = shift(ASH, 6 - dpt * 6 + (b > .7 ? 4 : 0));
        const crack = Math.abs(Math.sin(x * .11 + y * .37 + 2 * Math.sin(x * .03))) < .04 || Math.abs(Math.sin(x * .07 - y * .29 + 1)) < .03;
        if(crack) c = shift(LAVA, -16, -6); else if(n < .04) c = shift(c, 8);
      } else if(land === 'air'){
        c = [AIRG[0], AIRG[1] - dpt * 8, AIRG[2] - dpt * 12 + (b > .6 ? 3 : 0)];
        if((y * 2 + Math.round(5 * Math.sin(x * .05))) % 9 === 0) c = shift(c, 5, -4);   // wind-combed stripes
        if(n < .04) c = shift(c, -6, 10);
      } else if(land === 'frost'){
        c = shift(SNOW, -dpt * 8 + (b > .75 ? -4 : 0));
        if(n < .03) c = shift(c, -8, 0, 10);
      } else {
        c = [LOAM[0], LOAM[1], 40 - dpt * 12 + (b > .6 ? 3 : 0)];
        const v = Math.sin(x * .1 + y * .13) * Math.sin(y * .2 - x * .07);
        if(v > .72) c = shift(c, -5, -60, 10);   // patches of bare earth
        if(n < .05) c = shift(c, 7, -10);
      }
      set(x, y, c);
    }
  }
  // lava pools with a crust of black rock round them; nothing can stand in them
  for(const p of LAVAPOOLS) for(let y = p.y - p.ry - 3; y <= p.y + p.ry + 3; y++) for(let x = p.x - p.rx - 5; x <= p.x + p.rx + 5; x++){
    if(inLava(x, y)){ const e = ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2; set(x, y, e > .7 ? shift(LAVA, -10, -6) : e > .3 + bayer(x, y) * .1 ? LAVA : shift(LAVA, 10, 20)); gap[y * W + x] = 1; }
    else if(inLava(x - 2, y) || inLava(x + 2, y) || inLava(x, y - 1) || inLava(x, y + 1)) set(x, y, [10, 10, 10]);
  }
  // the frozen pond: pale ice with cracks, and dark open water where the ice has a hole
  for(let y = POND.y - POND.ry - 2; y <= POND.y + POND.ry + 2; y++) for(let x = POND.x - POND.rx - 3; x <= POND.x + POND.rx + 3; x++){
    if(!inPond(x, y)) continue;
    const edge = !inPond(x - 1, y) || !inPond(x + 1, y) || !inPond(x, y - 1) || !inPond(x, y + 1);
    if(inHole(x, y)){ set(x, y, ((x - HOLE.x) / HOLE.rx) ** 2 + ((y - HOLE.y) / HOLE.ry) ** 2 > .6 ? WATER.mid : WATER.deep); isWater[y * W + x] = 1; continue; }
    const crack = Math.abs(Math.sin(x * .3 + y * .9)) < .05 && h2(x >> 3, y >> 2) < .5;
    set(x, y, edge ? shift(ICE, 10, 0, -20) : crack ? hi(ICE) : bayer(x, y) > .8 ? shift(ICE, 5) : ICE);
  }
  // the ring of standing stones, each marked with its land's rune
  for(const s of STONES){
    for(let y = -2; y <= 2; y++) for(let x = -9; x <= 9; x++) if((x / 9) ** 2 + (y / 2.4) ** 2 <= 1) set(s.x + x, s.y + y, [220, 10, 22], 120);
  }
  // a worn circle of flat stones in the middle where the four lands meet
  for(let a = 0; a < Math.PI * 2; a += .26){
    const x = Math.round(CX + Math.cos(a) * 22), y = Math.round(CY + 1 + Math.sin(a) * 7);
    for(let j = -2; j <= 2; j++) set(x + j, y, j === -2 ? hi(STONE) : j === 2 ? lo(STONE) : STONE); set(x, y + 1, lo(lo(STONE)));
  }
  ctx.putImageData(img, 0, 0);

  /* props in depth order */
  const sprite = (w, h, paint) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); paint((x, y, col) => { c.fillStyle = css(col); c.fillRect(x, y, 1, 1); }); return cv; };
  // the standing stones: tall, rough-sided, with a rune carved on the face
  for(const s of STONES){
    const h = 26, w = 9, rune = RUNES[s.land];
    const cv = sprite(w + 4, h + 2, px => {
      for(let y = 0; y <= h; y++){ const ww = Math.round(4 - (y < 4 ? (4 - y) * .7 : 0)); for(let j = -ww; j <= ww; j++) px(6 + j, y, j === -ww ? hi(STONE) : j >= ww - 1 ? lo(STONE) : h2(j, y) < .1 ? lo(STONE) : STONE); }
      for(const [gx, gy] of GLYPHS[s.land]) px(6 + gx, 8 + gy, lo(lo(STONE)));
    });
    s.rune = css(rune); s.top = s.y - h;
    PROPS.push({x: s.x, y: s.y, draw(ctx){ ctx.drawImage(cv, s.x - 6, s.y - h); }});
  }
  // fire: black rock spires; air: tall pale grass that leans hard in the wind; frost: snowy little pines; earth: shrubs and flowers
  const AG = [css([66, 34, 44]), css([62, 40, 54]), css([58, 46, 68])];
  const PINE = [150, 30, 26], SNOWC = css(SNOW), PC = css(PINE), PL = css(hi(PINE)), TRUNK = css([24, 30, 26]);
  const SHRUB = [104, 40, 30];
  for(let n = 0; n < 700; n++){
    const x = 4 + Math.floor(rnd() * (W - 8)), y = HZ + 6 + Math.floor(rnd() ** .85 * (H - HZ - 6)), i = y * W + x;
    if(gap[i] || isWater[i] || inPond(x, y + 2) || inLava(x, y + 3) || Math.hypot(x - CX, (y - CY) * 2.6) < 50) continue;
    const land = landOf(x, y), s = .5 + .5 * ground[y], k = rnd();
    if(land === 'air'){
      const blades = Array.from({length: 3 + Math.floor(rnd() * 3)}, () => ({dx: Math.round((rnd() - .5) * 4), h: Math.round((4 + rnd() * 6) * s), lean: 1 + rnd()}));
      PROPS.push({x, y, draw(ctx, t){ for(const b of blades) blade(ctx, x + b.dx, y, b.h, b.lean + (wind(x, t) + .6) * b.h * .45, AG); }});
    } else if(land === 'frost' && k < .1){
      const h = Math.round((10 + rnd() * 10) * s);
      PROPS.push({x, y, draw(ctx){
        ctx.fillStyle = TRUNK; ctx.fillRect(x, y - 2, 1, 2);
        for(let i = 0; i < h; i++){ const w = Math.round((h - i) * .38 * (1 - (i % 4) * .12)); ctx.fillStyle = i % 4 === 0 ? SNOWC : i % 4 === 1 ? PL : PC; ctx.fillRect(x - w, y - 2 - i, w * 2 + 1, 1); }
        ctx.fillStyle = SNOWC; ctx.fillRect(x, y - 3 - h, 1, 1);
      }});
    } else if(land === 'fire' && k < .05){
      const h = Math.round((6 + rnd() * 10) * s), w = 2 + Math.floor(rnd() * 2);
      PROPS.push({x, y, draw(ctx){ for(let i = 0; i < h; i++){ const ww = Math.max(0, Math.round(w * (1 - i / h))); ctx.fillStyle = i % 3 ? css([10, 10, 16]) : css([12, 12, 24]); ctx.fillRect(x - ww, y - i, ww * 2 + 1, 1); } }});
    } else if(land === 'earth'){
      if(k < .08){
        const r = Math.round((4 + rnd() * 4) * s), cv = sprite(r * 2 + 3, r + 3, px => { for(let yy = 0; yy <= r; yy++) for(let xx = -r; xx <= r; xx++) if((xx / (r + .5)) ** 2 + ((yy - r) / (r + .5)) ** 2 <= 1) px(xx + r + 1, yy, yy < r * .4 && xx < 0 ? hi(SHRUB) : xx > r * .4 ? lo(SHRUB) : h2(xx, yy) < .15 ? [340, 60, 66] : SHRUB); });
        PROPS.push({x, y, draw(ctx){ ctx.drawImage(cv, x - r - 1, y - r); }});
      } else if(k < .5){
        const blades = Array.from({length: 2 + Math.floor(rnd() * 3)}, () => ({dx: Math.round((rnd() - .5) * 4), h: Math.round((3 + rnd() * 4) * s), lean: (rnd() - .5) * 1.4}));
        const cols = [css([100, 40, 30]), css([98, 44, 38]), css([96, 46, 48])];
        PROPS.push({x, y, draw(ctx, t){ for(const b of blades) blade(ctx, x + b.dx, y, b.h, b.lean + wind(x, t) * b.h * .25, cols); }});
      }
    }
  }

  /* each frame, under the light: smoke from the volcano, wind streaks and floating rocks on the air side,
     snow falling on the frost side, and the open water in the ice */
  const rocks = [{x: 470, y: HZ - 30, r: 7, ph: 0}, {x: 540, y: HZ - 40, r: 5, ph: 2}, {x: 600, y: HZ - 24, r: 9, ph: 4}, {x: 430, y: HZ - 14, r: 4, ph: 1}].map(r => ({...r, cv: sprite(r.r * 2 + 3, r.r * 2 + 4, px => {
    for(let y = -r.r; y <= r.r + 1; y++){ const top = y < 0, w = top ? Math.round(r.r * Math.sqrt(1 - (y / (r.r + .5)) ** 2)) : Math.round(r.r * (1 - y / (r.r + 2))); for(let j = -w; j <= w; j++) px(j + r.r + 1, y + r.r + 1, top ? (y === -w || y < -r.r + 2 ? [96, 40, 42] : [80, 20, 50]) : j < 0 ? [220, 8, 46] : [220, 10, 36]); }
  })}));
  const flakes = Array.from({length: 70}, () => ({x: rnd() * CX, y: rnd() * H, v: 6 + rnd() * 6, ph: rnd() * 6}));
  const streaks = Array.from({length: 14}, () => ({y: HZ + 4 + rnd() * (CY - HZ), x: rnd() * W, v: 40 + rnd() * 30, len: 6 + rnd() * 10}));
  const SMOKE = css([20, 6, 46]), WS = 'rgba(255,255,255,.55)', SN = 'rgb(255,255,255)', GL = css(WATER.glint);
  P.drawWater = (ctx, t, x0, x1) => {
    for(let i = 0; i < 7; i++){   // smoke rising from the crater and drifting off
      const k = ((t * .08 + i / 7) % 1), x = Math.round(92 + k * 30 + 3 * Math.sin(t + i)), y = Math.round(HZ - 34 - k * 40), r = Math.round(2 + k * 6);
      ctx.globalAlpha = .55 * (1 - k); ctx.fillStyle = SMOKE;
      for(let yy = -r; yy <= r; yy++){ const w = Math.round(Math.sqrt(r * r - yy * yy)); ctx.fillRect(x - w, y + yy, w * 2 + 1, 1); }
    }
    ctx.globalAlpha = 1;
    for(const r of rocks){ const y = Math.round(r.y + 2 * Math.sin(t * .6 + r.ph)); ctx.drawImage(r.cv, r.x - r.r - 1, y - r.r - 1); }
    ctx.fillStyle = WS;
    for(const s of streaks){
      const x = Math.round((s.x + t * s.v) % (W - CX + 60)) + CX - 30;
      if(landOf(x, s.y) !== 'air' && s.y > HZ + 2) continue;
      ctx.fillRect(x, Math.round(s.y + Math.sin(t + s.x) * 2), Math.round(s.len), 1);
    }
    ctx.fillStyle = GL;
    for(let y = HOLE.y - HOLE.ry; y <= HOLE.y + HOLE.ry; y++) for(let x = HOLE.x - HOLE.rx; x <= HOLE.x + HOLE.rx; x++) if(isWater[y * W + x] && h2(x + Math.floor(t * 2), y * 3) < .03) ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = SN;
    for(const f of flakes){
      const y = ((f.y + t * f.v) % (H + 10)) - 10, x = Math.round(f.x + 4 * Math.sin(t * .8 + f.ph));
      if(y > HZ + 4 && landOf(x, y) !== 'frost') continue;
      if(x < x0 || x > x1) continue;
      ctx.fillRect(x, Math.round(y), 1, 1);
    }
  };
  /* and over the light: the lava's glow, embers rising, and the runes lighting up after dark */
  const embers = Array.from({length: 26}, () => ({p: LAVAPOOLS[Math.floor(rnd() * 2)], dx: (rnd() - .5), v: 8 + rnd() * 8, ph: rnd()}));
  P.drawGlow = (ctx, t, lt, x0, x1) => {
    const night = lt ? lt.night : 0;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = css(LAVA);
    for(const p of LAVAPOOLS){
      if(p.x + p.rx * 2 < x0 || p.x - p.rx * 2 > x1) continue;
      for(let ring = 2; ring >= 1; ring--){
        const rx = p.rx * (1 + ring * .35), ry = p.ry * (1 + ring * .8);
        ctx.globalAlpha = (.08 + .14 * night) * (.85 + .15 * Math.sin(t * 2 + p.x));
        for(let y = -Math.round(ry); y <= Math.round(ry); y++){ const hw = Math.round(rx * Math.sqrt(1 - (y / (ry + .5)) ** 2)); ctx.fillRect(Math.round(p.x - hw), p.y + y, hw * 2, 1); }
      }
    }
    for(const e of embers){
      const k = (t * .3 + e.ph) % 1, x = Math.round(e.p.x + e.dx * e.p.rx * 1.6 + 3 * Math.sin(t * 2 + e.ph * 9)), y = Math.round(e.p.y - k * 40);
      ctx.globalAlpha = (1 - k) * (.5 + .5 * night); ctx.fillRect(x, y, 1, 1);
    }
    if(night > .2) for(const s of STONES){   // the runes light up, with a faint halo
      const a = (night - .2) / .8 * (.7 + .3 * Math.sin(t * 1.5 + s.x));
      ctx.fillStyle = s.rune;
      ctx.globalAlpha = a * .25; ctx.fillRect(s.x - 4, s.top + 6, 9, 9);
      ctx.globalAlpha = a; for(const [gx, gy] of GLYPHS[s.land]) ctx.fillRect(s.x + gx, s.top + 8 + gy, 1, 1);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
});
})();
