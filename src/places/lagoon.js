/* The lagoon: the aquatic creatures' place. Mostly warm, clear water inside a reef, with a long sandbar in the
   middle, a little islet and a beach at the front. Walkers keep to whichever patch of sand they live on, fliers
   hop between them, and swimmers have the run of the water, where they dive and come back up. */
(() => {
'use strict';
const K = window.PastureScene;
const {W, H, HZ, rgb, css, hi, lo, shift, bayer, h2, wind, layer, blade, hash32, mulberry} = K;
const SEA = [212, 60, 42], SAND = [42, 58, 76], WETSAND = [36, 44, 62], ROCK = [220, 10, 44], OUT = [220, 20, 22];
const SHALLOW = [176, 62, 62], MID = [188, 64, 50], DEEP = [202, 64, 40];
const TRUNK = [30, 40, 38], FROND = [122, 46, 36];

/* the sand: a long bar in the middle, an islet on the left, and a beach along the front right */
const wob = (x, y, cx, cy, rx, ry, k) => { const a = Math.atan2((y - cy) / ry, (x - cx) / rx); return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= (1 + .1 * Math.sin(3 * a + k) + .06 * Math.sin(7 * a + 2 * k)) ** 2; };
const beachTop = x => 198 - (x - 430) * .21 + 3 * Math.sin(x * .07);
const isSand = (x, y) => wob(x, y, 300, 146, 168, 25, 1) || wob(x, y, 84, 104, 40, 12, 4) || (x > 430 && y > beachTop(x));
const PALMS = [{x: 214, y: 140, lean: -1}, {x: 392, y: 150, lean: 1}, {x: 76, y: 102, lean: 1}, {x: 588, y: 176, lean: -1}];
const ROCKS = [[560, 92, 7, 3], [548, 95, 4, 2], [470, 112, 3, 2], [150, 150, 3, 2], [20, 176, 5, 3]];

K.define('lagoon', P => {
  const {isWater, PROPS} = P, rnd = mulberry(hash32('lagoon-v1'));
  P.name = 'The lagoon';
  P.seeds = false; P.dive = true;
  P.NAPS = PALMS.map(({x, y, lean}) => ({x: x + lean * 4, y: y + 2}));
  P.flow = (x, y) => [4 + 2 * Math.sin(y * .05), Math.sin(x * .02) * 1.5];   // a gentle current toward the open side
  P.butterflyPaths = [[0, 250, 100, [50, 92, 72]], [2.4, 340, 110, [0, 0, 97]], [4.1, 90, 60, [12, 88, 62]], [1.2, 560, 140, [190, 80, 70]]];

  // how far each pixel is from sand, for the colour of the water (shallow near the sand, deep out in the open)
  const sand = new Uint8Array(W * H), dist = new Float32Array(W * H).fill(99);
  const queue = [];
  for(let y = HZ; y < H; y++) for(let x = 0; x < W; x++) if(y > HZ + 8 && isSand(x, y)){ sand[y * W + x] = 1; dist[y * W + x] = 0; queue.push(y * W + x); }
  for(let q = 0; q < queue.length; q++){
    const i = queue[q], x = i % W, y = (i / W) | 0, d = dist[i] + 1;
    if(d > 30) continue;
    for(const j of [i - 1, i + 1, i - W, i + W]){ const jx = j % W; if(j < 0 || j >= W * H || Math.abs(jx - x) > 1 || dist[j] <= d) continue; dist[j] = d; queue.push(j); }
  }

  const LAND = P.LAND = layer();
  const ctx = LAND.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const set = (x, y, c, a = 255) => {if(x < 0 || y < 0 || x >= W || y >= H) return; const [r, g, b] = rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;};
  // the open sea out to the horizon, and a far island
  const SEAY = HZ - 12;
  for(let y = SEAY; y < HZ + 6; y++) for(let x = 0; x < W; x++){
    const k = (y - SEAY) / 18;
    set(x, y, y === SEAY ? [205, 40, 80] : shift(SEA, (1 - k) * 10 + (bayer(x, y) > .6 ? -2 : 0)));
  }
  const isle = x => SEAY - 6 * Math.max(0, 1 - ((x - 510) / 60) ** 2) - 3 * Math.max(0, 1 - ((x - 545) / 22) ** 2);
  for(let x = 440; x < 590; x++) for(let y = Math.ceil(isle(x)); y < SEAY + 1; y++) set(x, y, y === Math.ceil(isle(x)) ? [150, 22, 60] : [155, 26, 52]);
  // the reef along the back: a line of breakers where the open sea meets the lagoon
  for(let x = 0; x < W; x++) for(let y = HZ + 6; y < HZ + 10; y++) set(x, y, y === HZ + 6 ? [190, 30, 92] : bayer(x, y) > .5 ? [195, 35, 84] : [185, 45, 66]);
  // the lagoon water and the sand
  for(let y = HZ + 10; y < H; y++){
    const dpt = (y - HZ) / (H - HZ);
    for(let x = 0; x < W; x++){
      const i = y * W + x;
      if(sand[i]){
        const edge = !sand[i - 1] || !sand[i + 1] || !sand[i - W] || (y < H - 1 && !sand[i + W]), wet = dist[i] === 0 && edge;
        let c = shift(SAND, -6 * dpt);
        if(bayer(x, y) > .82) c = shift(c, -5, -4); else if(h2(x, y) < .05) c = shift(c, 6, -6);
        set(x, y, wet ? WETSAND : c);
        continue;
      }
      isWater[i] = 1;
      const e = dist[i] + bayer(x, y) * 2;
      let c = e < 3 ? SHALLOW : e < 9 ? MID : DEEP;
      c = shift(c, (1 - dpt) * 6);
      set(x, y, c);
    }
  }
  for(let x = 0; x < W; x++) for(let y = SEAY; y < HZ + 10; y++) isWater[y * W + x] = 1;
  // rocks out in the water
  for(const [rx0, ry0, rx, ry] of ROCKS){
    const inR = (x, y) => ((x + .5 - rx0) / (rx + .5)) ** 2 + ((y + .5 - ry0) / (ry + .3)) ** 2 <= 1;
    for(let y = ry0 - ry - 1; y <= ry0 + ry + 1; y++) for(let x = rx0 - rx - 1; x <= rx0 + rx + 1; x++){
      if(!inR(x, y)) continue;
      const edge = !inR(x - 1, y) || !inR(x + 1, y) || !inR(x, y - 1) || !inR(x, y + 1);
      set(x, y, edge ? OUT : y < ry0 ? hi(ROCK) : lo(ROCK)); isWater[y * W + x] = 0;
    }
  }
  // shells and starfish on the sand
  for(let n = 0; n < 70; n++){
    const x = Math.floor(rnd() * W), y = HZ + 12 + Math.floor(rnd() * (H - HZ - 14));
    if(!sand[y * W + x] || dist[y * W + x] !== 0 || [[-2, 0], [2, 0], [0, -2], [0, 2]].some(([dx, dy]) => !sand[(y + dy) * W + x + dx])) continue;
    const k = rnd();
    if(k < .2){ const c = [12, 80, 62]; set(x, y, c); set(x - 1, y, c); set(x + 1, y, c); set(x, y - 1, c); set(x, y + 1, lo(c)); }   // a starfish
    else set(x, y, k < .6 ? [20, 40, 92] : [330, 40, 84]), set(x + 1, y, [30, 20, 70]);   // a shell
  }
  // the palms: a curved trunk and drooping fronds
  for(const {x: px, y: py, lean} of PALMS){
    for(let y = -2; y <= 1; y++) for(let x = -9; x <= 9; x++) if((x / 9) ** 2 + (y / 2) ** 2 <= 1) set(px + x, py + y, shift(WETSAND, -4));   // its shadow
    const top = 24, tip = [];
    for(let i = 0; i <= top; i++){
      const k = i / top, x = Math.round(px + lean * 6 * k * k), y = py - i;
      set(x - 1, y, i % 3 ? hi(TRUNK) : TRUNK); set(x, y, i % 3 ? TRUNK : lo(TRUNK)); set(x + 1, y, lo(TRUNK));
      if(i === top) tip.push(x, y);
    }
    const [tx, ty] = tip;
    for(let f = 0; f < 6; f++){
      const a = -Math.PI / 2 + (f - 2.5) * .62, len = 11 + (f % 2) * 3;
      for(let s = 0; s <= len; s++){
        const k = s / len, x = Math.round(tx + Math.cos(a) * s), y = Math.round(ty + Math.sin(a) * s * .55 + k * k * 7);
        set(x, y, k > .85 ? lo(FROND) : FROND); set(x, y + 1, lo(FROND));
        if(s % 2 && s > 2){ set(x, y + 2, lo(FROND)); }
      }
    }
    set(tx, ty + 1, [30, 50, 30]); set(tx + 1, ty + 1, [30, 50, 28]);   // coconuts
  }
  ctx.putImageData(img, 0, 0);

  /* animated props: dune grass on the sand, seaweed in the shallows */
  const grass = [css([70, 40, 42]), css([75, 45, 52]), css(hi([75, 45, 52]))], weed = [css([150, 40, 28]), css([140, 45, 34]), css([120, 45, 42])];
  for(let n = 0; n < 220; n++){
    const x = Math.floor(rnd() * W), y = HZ + 12 + Math.floor(rnd() * (H - HZ - 14)), i = y * W + x;
    const dd = (y - HZ) / (H - HZ), s = .55 + .45 * dd;
    if(sand[i] && dist[i] === 0 && sand[i - 3] && sand[i + 3] && sand[i - 3 * W] && rnd() < .6){
      const blades = Array.from({length: 2 + Math.floor(rnd() * 3)}, () => ({dx: Math.round((rnd() - .5) * 4), h: Math.max(2, Math.round((3 + rnd() * 4) * s)), lean: (rnd() - .5) * 1.4}));
      PROPS.push({x, y, draw(ctx, t){ for(const b of blades) blade(ctx, x + b.dx, y, b.h, b.lean + wind(x, t) * b.h * .3, grass); }});
    } else if(isWater[i] && dist[i] > 2 && dist[i] < 8){
      const ph = rnd() * 6, h = Math.round((4 + rnd() * 4) * s);
      PROPS.push({x, y, draw(ctx, t){ blade(ctx, x, y, h, Math.sin(t * 1.3 + ph) * h * .25, weed); blade(ctx, x + 1, y, h - 1, Math.sin(t * 1.3 + ph + 1) * h * .25, weed); }});
    }
  }

  /* moving water: glints drifting with the current, foam lapping at the sand, breakers on the reef */
  const glints = [], foam = [];
  for(let n = 0; n < 900; n++){ const x = Math.floor(rnd() * W), y = HZ + 11 + Math.floor(rnd() * (H - HZ - 11)); if(isWater[y * W + x]) glints.push({x, y, ph: rnd() * 6, sp: .6 + rnd()}); }
  for(let y = HZ + 11; y < H; y++) for(let x = 1; x < W - 1; x++){ const i = y * W + x; if(isWater[i] && dist[i] === 1) foam.push(i); }
  const GL = css([180, 60, 84]), FO = css([190, 40, 95]), BR = css([0, 0, 100]);
  P.drawWater = (ctx, t, x0, x1) => {
    ctx.fillStyle = GL;
    for(const g of glints){
      const x = Math.round(g.x + t * 3 * g.sp) % W;
      if(x < x0 || x > x1 || !isWater[g.y * W + x]) continue;
      if(Math.sin(t * 2 * g.sp + g.ph) > .7){ ctx.fillRect(x, g.y, 1, 1); if(g.sp > 1.2) ctx.fillRect(x + 1, g.y, 1, 1); }
    }
    ctx.fillStyle = FO;
    const k = Math.floor(t * 2.5);
    for(const i of foam){ const x = i % W; if(x < x0 || x > x1) continue; if(h2(x >> 2, k + (i / W | 0)) < .45) ctx.fillRect(x, (i / W) | 0, 1, 1); }
    ctx.fillStyle = BR;
    for(let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++){
      const w = Math.sin(x * .09 - t * 1.6) + .6 * Math.sin(x * .23 + t * 1.1);
      if(w > .9) ctx.fillRect(x, HZ + 6 + (w > 1.3 ? 0 : 1), 1, 1);
      if(w > 1.25) ctx.fillRect(x, HZ + 5, 1, 1);
    }
  };
});
})();
