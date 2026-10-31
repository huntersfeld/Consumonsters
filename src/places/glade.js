/* The glade: the flora's place. A sunny clearing deep in a wood, ringed by dark trees, with old trunks at either
   side, ferns, bluebells, a mossy log and a stump to nap by. By day sunbeams slant down through the canopy and
   dapple the grass; at night the wood closes in and the fireflies come out. */
(() => {
'use strict';
const K = window.PastureScene;
const {W, H, HZ, rgb, css, hi, lo, shift, bayer, h2, wind, layer, blade, hash32, mulberry} = K;
const GRASS = [100, 44, 44], DEEP = [140, 30, 16], CANOPY = [128, 36, 24], BARK = [26, 26, 30], MOSS = [84, 50, 40];
const FERN = [118, 50, 32], WOOD = [28, 36, 40];

/* the two old trunks at the sides, a younger tree in the middle distance, the log and the stump */
const TRUNKS = [{x: 14, w: 22}, {x: 626, w: 26}];
const MIDTREE = {x: 444, y: HZ + 34, w: 7};
const LOG = {x0: 70, x1: 176, y: HZ + 46};
const STUMP = {x: 300, y: 172, r: 12};
/* where the sun gets through: each beam lands on a patch of grass */
const BEAMS = [{x: 214, y: 120, rx: 26, ry: 8}, {x: 330, y: 150, rx: 34, ry: 10}, {x: 520, y: 128, rx: 22, ry: 7}, {x: 120, y: 176, rx: 20, ry: 6}];

K.define('glade', P => {
  const {PROPS, TREE} = P, rnd = mulberry(hash32('glade-v1')), ground = new Float32Array(H);
  P.name = 'The glade';
  P.NAPS = [{x: STUMP.x + 4, y: STUMP.y - 4}, {x: (LOG.x0 + LOG.x1) / 2, y: LOG.y - 2}, {x: MIDTREE.x, y: MIDTREE.y - 4}, {x: 40, y: 150}, {x: 600, y: 160}];
  P.flow = () => [0, 0];
  P.petals = [[230, 60, 70], [0, 0, 97], [56, 80, 70]];
  P.leaves = [[100, 44, 34], [60, 60, 44], [30, 60, 44]];
  P.butterflyPaths = [[0, 200, 70, [50, 92, 72]], [2.4, 330, 100, [0, 0, 97]], [4.1, 500, 70, [200, 80, 70]], [1.2, 140, 120, [22, 88, 62]]];
  // leaves drift down from the canopy over the whole clearing
  for(let i = 0; i < 8; i++) TREE.push([40 + i * 80, 4, 40, 6, HZ + 40 + Math.floor(rnd() * 100)]);

  const LAND = P.LAND = layer();
  const ctx = LAND.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const set = (x, y, c, a = 255) => {if(x < 0 || y < 0 || x >= W || y >= H) return; const [r, g, b] = rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;};

  // the wood behind: a wall of dark canopy over shadowy trunks, with the sky showing through only at the top
  const crown = x => HZ - 34 + 6 * Math.sin(x * .05 + 1) + 4 * Math.sin(x * .13) + 3 * Math.sin(x * .31 + 2);
  for(let x = 0; x < W; x++){
    const top = Math.round(crown(x));
    for(let y = Math.max(0, top); y < HZ + 12; y++){
      const k = (y - top) / (HZ + 12 - top);
      let c = shift(CANOPY, -k * 16);
      if(y < top + 3) c = hi(CANOPY); else if(h2(x >> 1, y >> 1) < .2) c = shift(c, 5); else if(bayer(x, y) > .8) c = shift(c, -4);
      set(x, y, c);
    }
  }
  for(let i = 0; i < 26; i++){   // far trunks, darker the deeper they stand
    const tx = Math.floor(rnd() * W), tw = 2 + Math.floor(rnd() * 3), from = Math.round(crown(tx)) + 10 + Math.floor(rnd() * 8);
    for(let y = from; y < HZ + 12; y++) for(let j = 0; j < tw; j++) set(tx + j, y, j === 0 ? shift(BARK, -6) : shift(BARK, -14));
  }
  // the clearing: bright in the middle where the sun gets in, darker toward the edges of the wood
  for(let y = HZ + 6; y < H; y++){
    const dpt = (y - HZ) / (H - HZ), L0 = 50 - 12 * dpt; ground[y] = L0;
    for(let x = 0; x < W; x++){
      const edge = Math.min(1, Math.min(x, W - x) / 90), back = Math.min(1, (y - HZ - 6) / 14), L = L0 - (1 - edge) * 12 - (1 - back) * 10;
      const q = L / 3, i = Math.floor(q), Lb = (i + (q - i > bayer(x, y) ? 1 : 0)) * 3;
      let c = [GRASS[0] + (1 - edge) * 20, GRASS[1], Lb];
      const v = Math.sin(x * .08 + y * .1) * Math.sin(y * .17 - x * .06 + 2) + .2 * Math.sin(x * .4 + y * .3);
      if(v > .62 + (bayer(x, y) - .5) * .2) c = [MOSS[0], MOSS[1], Lb + 2];
      const n = rnd();
      if(n < .05) c = shift(c, 6, -8); else if(n < .09) c = shift(c, -6, 8);
      set(x, y, c);
    }
  }
  // the mossy log, lying along the back of the clearing
  for(let x = LOG.x0; x <= LOG.x1; x++){
    const r = 5 + (x - LOG.x0) / (LOG.x1 - LOG.x0) * 1.5;
    for(let dy = -r; dy <= r; dy++){
      const y = Math.round(LOG.y - r + dy), k = dy / r;
      let c = k < -.4 ? (h2(x, y) < .6 ? MOSS : hi(MOSS)) : k > .5 ? lo(WOOD) : (x % 7 === 0 ? lo(WOOD) : WOOD);
      if(Math.abs(k) > .92) c = [30, 30, 18];
      set(x, y, c);
    }
  }
  for(let dy = -6; dy <= 6; dy++) for(let dx = -3; dx <= 3; dx++){   // the cut end, with its rings
    const rr = Math.hypot(dx * 1.7, dy); if(rr > 6.2) continue;
    set(LOG.x1 + dx, Math.round(LOG.y - 6 + dy), rr > 5.2 ? lo(WOOD) : Math.round(rr) % 2 ? [36, 40, 62] : [34, 44, 70]);
  }
  for(let x = LOG.x0 - 2; x <= LOG.x1 + 4; x++) set(x, LOG.y + 1, shift([GRASS[0], GRASS[1], ground[LOG.y + 1]], -10, 10));
  // the stump: a ring-marked top and a bark side, with roots reaching into the grass
  {
    const {x: sx, y: sy, r} = STUMP, h = 8;
    for(let y = -2; y <= 3; y++) for(let x = -r - 6; x <= r + 6; x++) if((x / (r + 6)) ** 2 + (y / 3) ** 2 <= 1) set(sx + x, sy + y, shift([GRASS[0], GRASS[1], ground[sy]], -10, 12));
    for(const [dx, len] of [[-r, -6], [r, 6], [-r / 2, -3], [r / 2 + 2, 4]]) for(let i = 0; i <= Math.abs(len); i++){ set(Math.round(sx + dx + Math.sign(len) * i), sy - 1 + (i >> 2), BARK); set(Math.round(sx + dx + Math.sign(len) * i), sy + (i >> 2), lo(BARK)); }
    for(let x = -r; x <= r; x++) for(let y = 0; y < h; y++){ const e = Math.abs(x) / r; set(sx + x, sy - y, x < -r * .3 ? hi(BARK) : x > r * .5 ? lo(BARK) : (x & 3) ? BARK : lo(BARK)); }
    const ry = r * .4;
    for(let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for(let x = -r; x <= r; x++){
      const rr = Math.hypot(x, y / .4); if(rr > r + .3) continue;
      set(sx + x, sy - h + y, rr > r - 1 ? lo(BARK) : Math.round(rr) % 3 === 0 ? [32, 40, 56] : [36, 46, 68]);
    }
  }
  // the young tree in the middle distance: a slim trunk and a round crown
  {
    const {x: tx, y: ty, w} = MIDTREE;
    for(let y = -2; y <= 2; y++) for(let x = -12; x <= 12; x++) if((x / 12) ** 2 + (y / 2.4) ** 2 <= 1) set(tx + x, ty + y, shift([GRASS[0], GRASS[1], ground[ty]], -10, 12));
    for(let y = ty - 40; y <= ty; y++) for(let j = 0; j < w; j++) set(tx - (w >> 1) + j, y, j < 2 ? hi(BARK) : j > w - 3 ? lo(BARK) : BARK);
    const blobs = [[tx, ty - 50, 18, 13], [tx - 13, ty - 40, 11, 9], [tx + 13, ty - 41, 11, 9]];
    TREE.push(...blobs.map(b => [...b, ty]));
    for(let y = ty - 66; y <= ty - 30; y++) for(let x = tx - 26; x <= tx + 26; x++){
      const inT = (xx, yy) => blobs.some(([bx, by, rx, ry]) => ((xx - bx) / rx) ** 2 + ((yy - by) / ry) ** 2 <= 1);
      if(!inT(x, y)) continue;
      const edge = !inT(x - 1, y) || !inT(x + 1, y) || !inT(x, y - 1) || !inT(x, y + 1), sh = (x - tx) / 26 * .5 + (y - (ty - 50)) / 16 + (rnd() - .5) * .4;
      set(x, y, edge ? [130, 40, 16] : sh < -.4 ? hi([112, 44, 34]) : sh > .4 ? lo([112, 44, 34]) : [112, 44, 34]);
    }
  }
  ctx.putImageData(img, 0, 0);

  /* props in depth order: the two big trunks at the sides (in front of everything), ferns, bluebells and toadstools */
  const sprite = (w, h, paint) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); paint((x, y, col) => { c.fillStyle = css(col); c.fillRect(x, y, 1, 1); }); return cv; };
  for(const {x, w} of TRUNKS){
    const cv = sprite(w + 24, H, px => {
      const o = 12;
      for(let y = 0; y < H; y++){
        const flare = Math.max(0, (y - (H - 26)) / 26) ** 2 * 10;   // the trunk widens into roots at the foot
        for(let j = -Math.round(flare); j < w + Math.round(flare); j++){
          const u = (j + flare) / (w + 2 * flare);
          let c = u < .2 ? hi(BARK) : u > .7 ? lo(BARK) : BARK;
          if(((j + (y >> 3)) % 5 === 0) && u > .1 && u < .9) c = lo(c);   // furrows in the bark
          if(u < .5 && h2(j, y >> 2) < .06) c = MOSS;
          px(o + j, y, c);
        }
      }
    });
    PROPS.push({x, y: H + 50, draw(ctx){ ctx.drawImage(cv, x - w / 2 - 12, 0); }});
  }
  // ferns: arching fronds with leaflets down both sides, painted once
  const fernAt = (x, y, s) => {
    const n = 6 + Math.floor(rnd() * 3), fronds = Array.from({length: n}, (_, i) => ({side: i % 2 ? 1 : -1, spread: .25 + (i >> 1) / (n / 2) * .9, len: (16 + rnd() * 6) * s}));
    const bw = Math.ceil(30 * s) * 2 + 8, bh = Math.ceil(20 * s) + 6, o = bw / 2;
    const cv = sprite(bw, bh, px => {
      for(const f of fronds){
        for(let i = 0; i <= f.len; i++){
          const k = i / f.len, fx = o + f.side * Math.sin(f.spread * 1.4 * k + f.spread * .3) * i * .95, fy = bh - 2 - Math.sin(Math.PI * k * .8) * f.len * (.75 - f.spread * .35) + k * k * 4;
          const X = Math.round(fx), Y = Math.round(fy);
          px(X, Y, lo(FERN));
          const lw = Math.round((1 - k) * 4 * s);
          if(i > 2 && i % 2 === 0) for(let j = 1; j <= lw; j++){ px(X - j, Y - (j >> 1), j === lw ? hi(FERN) : FERN); px(X + j, Y - (j >> 1), j === lw ? hi(FERN) : FERN); }
        }
      }
    });
    PROPS.push({x, y, draw(ctx){ ctx.drawImage(cv, x - o, y - bh + 2); }});
  };
  for(const [fx, fy, s] of [[40, 120, 1.2], [60, 186, 1.4], [592, 110, 1.1], [600, 190, 1.3], [250, 96, .8], [390, 104, .8], [480, 182, 1], [196, LOG.y + 2, .9]]) fernAt(fx, fy, s);
  const grassCols = y => { const g = [GRASS[0], GRASS[1], ground[y]]; return [css(shift(g, -11, 14, 4)), css(shift(g, 5, -6, 6)), css(hi(shift(g, 8, -4)))]; };
  for(let n = 0; n < 520; n++){
    const x = Math.floor(rnd() * W), y = HZ + 14 + Math.floor(rnd() ** .8 * (H - HZ - 14));
    if((x - STUMP.x) ** 2 / 300 + (y - STUMP.y) ** 2 / 30 < 1) continue;
    const dd = (y - HZ) / (H - HZ), blades = Array.from({length: 2 + Math.floor(rnd() * 3)}, () => ({dx: Math.round((rnd() - .5) * 4), h: Math.max(2, Math.round((3 + rnd() * 5) * (.5 + .5 * dd))), lean: (rnd() - .5) * 1.4}));
    const cols = grassCols(y);
    PROPS.push({x, y, draw(ctx, t){ for(const b of blades) blade(ctx, x + b.dx, y, b.h, b.lean + wind(x, t) * b.h * .25, cols); }});
  }
  // drifts of bluebells and white wood anemones
  const stem = [css([110, 40, 30]), css([104, 42, 38]), css([104, 42, 38])], BB = [css([234, 60, 62]), css([238, 52, 48])], AN = [css([0, 0, 97]), css([50, 80, 60])];
  const drifts = [[110, 140, 'bell'], [250, 186, 'bell'], [430, 150, 'bell'], [560, 120, 'anem'], [180, 104, 'anem'], [380, 190, 'anem'], [70, 160, 'bell']];
  for(let n = 0; n < 200; n++){
    const [cx, cy, kind] = drifts[n % drifts.length], x = Math.round(cx + (rnd() - .5) * 40), y = Math.round(cy + (rnd() - .5) * 18);
    if(y < HZ + 14 || y >= H) continue;
    const dd = (y - HZ) / (H - HZ), h = Math.max(2, Math.round((3 + rnd() * 3) * (.55 + .45 * dd))), ph = rnd() * 6;
    PROPS.push({x, y, draw(ctx, t){
      const [hx, hy] = blade(ctx, x, y, h, .4 + wind(x, t + ph * .02) * h * .2, stem);
      if(kind === 'bell'){ ctx.fillStyle = BB[0]; ctx.fillRect(hx + 1, hy, 1, 2); ctx.fillStyle = BB[1]; ctx.fillRect(hx, hy + 1, 1, 1); }
      else { ctx.fillStyle = AN[0]; ctx.fillRect(hx - 1, hy - 1, 3, 1); ctx.fillRect(hx, hy - 2, 1, 3); ctx.fillStyle = AN[1]; ctx.fillRect(hx, hy - 1, 1, 1); }
    }});
  }

  /* each frame: by day, sunbeams slanting down through the canopy and the light dappling the grass where they land */
  const SUNC = 'rgb(255,246,200)';
  const flecks = BEAMS.map(b => Array.from({length: 7}, () => ({dx: (rnd() - .5) * b.rx * 1.6, dy: (rnd() - .5) * b.ry * 1.4, r: 2 + rnd() * 4, ph: rnd() * 6})));
  P.drawWater = (ctx, t, x0, x1, lt) => {
    const day = Math.max(0, 1 - (lt ? lt.night : 0) * 1.6);
    if(!day) return;
    ctx.fillStyle = SUNC;
    BEAMS.forEach((b, i) => {
      if(b.x + b.rx + 60 < x0 || b.x - b.rx - 60 > x1) return;
      // the beam: a soft slanted band from the canopy down to its patch
      const top = 0, slant = .35;
      for(let y = top; y < b.y; y++){
        const k = (y - top) / (b.y - top), cx = b.x - (b.y - y) * slant, hw = b.rx * (.4 + .6 * k);
        ctx.globalAlpha = day * (.16 + .06 * Math.sin(t * .7 + i * 2)) * (.3 + .7 * k);
        ctx.fillRect(Math.round(cx - hw), y, Math.round(hw * 2), 1);
      }
      // the patch of light on the grass, with flecks that come and go as the leaves move overhead
      for(let y = -b.ry; y <= b.ry; y++){
        const hw = b.rx * Math.sqrt(1 - (y / (b.ry + .5)) ** 2);
        ctx.globalAlpha = day * .22; ctx.fillRect(Math.round(b.x - hw), b.y + y, Math.round(hw * 2), 1);
      }
      for(const f of flecks[i]){
        const a = Math.sin(t * .9 + f.ph); if(a < 0) continue;
        ctx.globalAlpha = day * .3 * a;
        for(let y = -Math.round(f.r * .5); y <= Math.round(f.r * .5); y++){ const hw = f.r * Math.sqrt(1 - (y / (f.r * .5 + .5)) ** 2); ctx.fillRect(Math.round(b.x + f.dx - hw), Math.round(b.y + f.dy + y), Math.round(hw * 2), 1); }
      }
    });
    ctx.globalAlpha = 1;
  };
});
})();
