/* Consumonsters pasture kit: what every place shares. The sky and the time of day, wind, clouds, particles,
   butterflies and fireflies, and the map of where creatures can stand. Each place (src/places/*.js) paints its
   own land and water with these helpers and registers itself here; pasture.js puts the creatures in it.
   Scenery is pixel art at the sprites' scale (one scene pixel = one sprite pixel) and uses their shading rule:
   highlights lean warm, shadows lean cool. */
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
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const h2 = (x, y) => {let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;};
const WATER = {shallow: [186, 52, 62], mid: [198, 56, 52], deep: [206, 58, 44], glint: [185, 60, 82], foam: [190, 40, 94]};
const SKY = [[210, 64, 70], [200, 60, 80], [188, 52, 89]];

/* wind: a steady breeze to the right, with gusts that roll across */
function wind(x, t){
  const gust = Math.max(0, Math.sin(t * 0.42 - x * 0.018));
  return 0.35 + 0.32 * Math.sin(t * 1.7 + x * 0.06) + 0.18 * Math.sin(t * 3.1 + x * 0.17 + 1.3) + 1.2 * gust ** 6;
}
const gustAt = (x, t) => Math.max(0, Math.sin(t * 0.42 - x * 0.018)) ** 6;
function layer(w = W, h = H){const c = document.createElement('canvas'); c.width = w; c.height = h; return c;}
/* a blade of grass (or a stem, or a reed) bending in the wind; returns where its tip ended up */
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

/* ---------- time of day: four painted skies, and a colour grade for everything under them ---------- */
/* sky: three gradient stops, top to horizon; sun or moon: where, its size, core and ring colours; tint: the light below */
const LOOKS = {
  dawn: {sky: [[232, 38, 50], [318, 42, 72], [32, 88, 80]], orb: {x: 128, y: 38, r: 6, core: [48, 100, 92], ring: [36, 100, 76]}, tint: [255, 214, 214], night: .35},
  day: {sky: SKY, orb: {x: 46, y: 15, r: 5.5, core: [52, 100, 94], ring: [50, 95, 84]}, tint: [255, 255, 255], night: 0},
  dusk: {sky: [[252, 42, 36], [332, 48, 56], [24, 92, 64]], orb: {x: 530, y: 41, r: 7, core: [34, 100, 76], ring: [18, 96, 62]}, tint: [255, 190, 156], night: .4},
  night: {sky: [[234, 52, 9], [230, 46, 15], [224, 40, 24]], orb: {x: 378, y: 13, r: 4.5, core: [52, 34, 92], ring: [220, 30, 70], moon: true}, tint: [92, 108, 172], night: 1, stars: 90},
};
const SKIES = {};
/* hour of the day -> which looks to blend, how far, how dark it is (0..1) and the light on the ground */
const KEYS = [[0, 'night'], [5, 'night'], [6.2, 'dawn'], [7.5, 'day'], [17.8, 'day'], [19, 'dusk'], [20.3, 'night'], [24, 'night']];
function lightAt(hour){
  hour = ((hour % 24) + 24) % 24;
  let i = 0; while(KEYS[i + 1][0] <= hour && i < KEYS.length - 2) i++;
  const [h0, a] = KEYS[i], [h1, b] = KEYS[i + 1], k = h1 > h0 ? (hour - h0) / (h1 - h0) : 0, ease = k * k * (3 - 2 * k);
  const A = LOOKS[a], B = LOOKS[b], tint = A.tint.map((v, j) => Math.round(v + (B.tint[j] - v) * ease));
  return {a, b, k: ease, night: A.night + (B.night - A.night) * ease, tint, graded: tint.some(v => v < 255)};
}
function paintSky(L, rnd){
  const cv = layer(W, HZ), ctx = cv.getContext('2d'), img = ctx.createImageData(W, HZ), d = img.data, {sky, orb} = L;
  const set = (x, y, c, raw) => {if(x < 0 || y < 0 || x >= W || y >= HZ) return; const [r, g, b] = raw ? c : rgb(c), i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;};
  const st = sky.map(rgb), toHsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
    if(!dd) return [0, 0, l * 100]; const s = dd / (1 - Math.abs(2 * l - 1)), h = mx === r ? ((g - b) / dd + 6) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; return [h * 60, s * 100, l * 100]; };
  for(let y = 0; y < HZ; y++) for(let x = 0; x < W; x++){
    const f = y / HZ * 6, i = Math.floor(f), k = (i + (f - i > bayer(x, y) ? 1 : 0)) / 6;
    let c = toHsl(k < .5 ? mix(st[0], st[1], k * 2) : mix(st[1], st[2], k * 2 - 1));   // mixed in RGB, so pink to orange never passes through green
    const sd = Math.hypot(x - orb.x, y - orb.y), r = orb.r, glow = orb.moon ? 5 : 2.5;
    if(sd < r) c = orb.moon && Math.hypot(x - orb.x - 1.5, y - orb.y + 1) < 1.3 ? shift(orb.core, -8, 160, -10) : orb.core;   // the moon gets a little crater
    else if(sd < r + 2) c = orb.ring;
    else if(sd < r + 2 + glow && bayer(x, y) > (sd - r - 2) / glow) c = shift(c, orb.moon ? 6 : 4, orb.moon ? 0 : -8);
    set(x, y, c);
  }
  for(let n = 0; n < (L.stars || 0); n++){   // stars, thinning toward the horizon
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() ** 1.6 * (HZ - 14));
    if(Math.hypot(x - orb.x, y - orb.y) < orb.r + 8) continue;
    const big = rnd() < .12, c = [rnd() < .3 ? 48 : 220, 40, big ? 94 : 70 + rnd() * 16];
    set(x, y, c);
    if(big){ const g = shift(c, -30); set(x - 1, y, g); set(x + 1, y, g); set(x, y - 1, g); set(x, y + 1, g); }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
const TWINKLE = (() => { const r = mulberry(hash32('pasture-twinkle')); return Array.from({length: 18}, () => ({x: Math.floor(r() * W), y: Math.floor(r() ** 1.5 * (HZ - 18)), ph: r() * 6, sp: .6 + r() * 1.4})); })();
let CLOUDS = null;
function buildShared(){
  if(CLOUDS) return;
  for(const [k, L] of Object.entries(LOOKS)) SKIES[k] = paintSky(L, mulberry(hash32('pasture-sky-' + k)));
  const rnd = mulberry(hash32('pasture-v2'));   // the meadow's seed: its clouds came first
  CLOUDS = Array.from({length: 7}, (_, j) => {
    const i = j % 3, cv = document.createElement('canvas'), w = 22 + i * 6 + Math.floor(rnd() * 8), h = 9 + i; cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), blobs = [[w * .3, h * .62, w * .22, h * .38], [w * .55, h * .45, w * .26, h * .46], [w * .78, h * .66, w * .18, h * .32]];
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      if(!blobs.some(([bx, by, rx, ry]) => ((x + .5 - bx) / rx) ** 2 + ((y + .5 - by) / ry) ** 2 <= 1)) continue;
      ctx.fillStyle = css(y >= h - 2 ? [212, 38, 88] : y >= h - 3 && bayer(x, y) > .5 ? [208, 30, 94] : [200, 30, 99]); ctx.fillRect(x, y, 1, 1);
    }
    return {cv, x: (j + rnd() * .7) * W / 7, y: 4 + i * 9 + Math.floor(rnd() * 4), v: 1.4 + i * 0.7};
  });
}
/* the sky for this light; the place's land, clouds included, goes on top and is graded with everything else */
function drawSky(ctx, t, lt){
  ctx.drawImage(SKIES[lt.a], 0, 0);
  if(lt.k > 0 && lt.b !== lt.a){ ctx.globalAlpha = lt.k; ctx.drawImage(SKIES[lt.b], 0, 0); ctx.globalAlpha = 1; }
  if(lt.night > .5){   // a few stars twinkle
    ctx.fillStyle = 'rgb(255,250,226)';
    for(const s of TWINKLE){ const v = Math.sin(t * s.sp + s.ph); if(v > .55){ ctx.globalAlpha = (lt.night - .5) * 2 * (v - .55) / .45; ctx.fillRect(s.x, s.y, 1, 1); } }
    ctx.globalAlpha = 1;
  }
}
function drawLand(ctx, t, lt, P){
  ctx.globalAlpha = 1 - .45 * lt.night;
  for(const cl of CLOUDS){ const span = W + cl.cv.width * 2, x = ((cl.x + t * cl.v) % span + span) % span - cl.cv.width; ctx.drawImage(cl.cv, Math.round(x), cl.y); }
  ctx.globalAlpha = 1;
  ctx.drawImage(P.LAND, 0, 0);
}
/* night light, drawn over the grade so it glows: the moon's path across whatever water lies under it */
function drawMoonlight(ctx, t, lt, x0, x1, P){
  if(lt.night < .5) return;
  const a = (lt.night - .5) * 2, mx = LOOKS.night.orb.x, k = Math.floor(t * 4);
  ctx.fillStyle = 'rgb(236,240,255)';
  for(let y = HZ + 1; y < H; y++){
    const half = 6 + (y - HZ) * .22, row = y * W;
    for(let x = Math.max(x0, Math.ceil(mx - half)); x <= Math.min(x1, Math.floor(mx + half)); x++){
      if(!P.isWater[row + x]) continue;
      const near = 1 - Math.abs(x - mx) / (half + 1), q = h2(x, y * 3 + k);
      if(q < .2 * near * (1 - (y - HZ) / (H - HZ) * .5)){ ctx.globalAlpha = a * (.45 + .55 * near); ctx.fillRect(x, y, 1, 1); }
    }
  }
  ctx.globalAlpha = 1;
}

/* ---------- where creatures can stand ---------- */
/* Splits the ground in front of the back edge into separate patches of dry land (the two banks of a stream,
   islands in a lagoon, the two sides of a gorge). Walkers stay on the patch they live on; fliers hop between them.
   Water, gaps (a drop nobody can stand in) and a two-pixel margin around them count as no land. Patches too small to live on are left out. */
function regions(P){
  const {isWater, isGap, Y0} = P, M = new Uint8Array(W * H), wet = new Uint8Array(W * H);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) if(isWater[y * W + x] || (isGap && isGap[y * W + x])) for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++){
    const xx = x + dx, yy = y + dy; if(xx >= 0 && yy >= 0 && xx < W && yy < H) wet[yy * W + xx] = 1;
  }
  const areas = [0];
  for(let y = Y0; y <= H - 3; y++) for(let x = 3; x < W - 3; x++){
    const i = y * W + x; if(wet[i] || M[i]) continue;
    const id = areas.length, stack = [i], cells = [];
    M[i] = id;
    while(stack.length){
      const j = stack.pop(); cells.push(j);
      const jx = j % W, jy = (j / W) | 0;
      for(const [nx, ny] of [[jx - 1, jy], [jx + 1, jy], [jx, jy - 1], [jx, jy + 1]]){
        if(nx < 3 || nx >= W - 3 || ny < Y0 || ny > H - 3) continue;
        const n = ny * W + nx; if(wet[n] || M[n]) continue; M[n] = id; stack.push(n);
      }
    }
    if(cells.length < 400) for(const j of cells) M[j] = 255;   // too small: a stone in the water
    areas.push(cells.length < 400 ? 0 : cells.length);
  }
  for(let i = 0; i < M.length; i++) if(M[i] === 255) M[i] = 0;
  P.land = M; P.areas = areas;
}

/* ---------- particles: petals and seeds on the wind, falling leaves, splashes, hearts ---------- */
const HEART = [css([350, 80, 62]), css([350, 90, 86])];
function makeFx(P){
  const ps = [], TREE = P.TREE || [];
  const petal = (P.petals || [[60, 30, 97], [330, 60, 84], [50, 90, 80]]).map(css), leaf = (P.leaves || [[116, 42, 34]]).map(c => [css(hi(c)), css(c)]).flat(), drop = css(WATER.glint);
  return {
    ping(x, y){ ps.push({k: 'ring', x, y, life: .7}); },
    hearts(x, y, n = 3){ for(let i = 0; i < n; i++) ps.push({k: 'heart', x: x + (Math.random() - .5) * 12, y: y - Math.random() * 4, vx: (Math.random() - .5) * 6, life: 1 + Math.random() * .5 + i * .12, ph: Math.random() * 6}); },
    splash(x, y){ for(let i = 0; i < 6; i++) ps.push({k: 'drop', x, y, vx: (Math.random() - .5) * 26, vy: -14 - Math.random() * 16, life: .45, c: drop}); },
    bubbles(x, y){ ps.push({k: 'bubble', x: x + (Math.random() - .5) * 4, y, life: .6 + Math.random() * .4}); },
    step(dt, t){
      if(P.seeds !== false && ps.length < 110 && Math.random() < dt * 3 * (.35 + 4 * gustAt(20, t))) ps.push({k: 'seed', x: Math.random() * W - 30, y: HZ + 6 + Math.random() * (H - HZ - 10), life: 12, ph: Math.random() * 6, c: petal[Math.floor(Math.random() * petal.length)]});
      if(TREE.length && ps.length < 110 && Math.random() < dt * .5){ const [bx, by, rx, ry, ty] = TREE[Math.floor(Math.random() * TREE.length)]; ps.push({k: 'leaf', x: bx + (Math.random() - .5) * rx, y: by + ry * .5, floor: ty - 2 + Math.random() * 10, life: 8, ph: Math.random() * 6, c: leaf[Math.floor(Math.random() * leaf.length)]}); }
      for(const p of ps){
        p.life -= dt;
        if(p.k === 'ring') continue;
        if(p.k === 'heart'){ p.y -= 9 * dt; p.x += (p.vx + Math.sin(t * 5 + p.ph) * 4) * dt; continue; }
        if(p.k === 'bubble'){ p.y -= 5 * dt; continue; }
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
        if(p.k === 'heart'){   // a little pixel heart that floats up and fades
          const x = Math.round(p.x), y = Math.round(p.y);
          ctx.globalAlpha = Math.min(1, p.life * 2);
          ctx.fillStyle = HEART[0]; ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y + 2, 1, 1); ctx.fillRect(x - 2, y, 5, 1);
          ctx.fillStyle = HEART[1]; ctx.fillRect(x - 1, y - 1, 1, 1);
          ctx.globalAlpha = 1;
          continue;
        }
        if(p.k === 'bubble'){ ctx.fillStyle = 'rgba(230,250,255,.8)'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); continue; }
        ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    },
  };
}
/* butterflies by day, fireflies by night; a place can set its own butterfly paths */
const DEFAULT_BUTTERFLIES = [[0, 60, 50, [50, 92, 72]], [2.4, 150, 110, [0, 0, 97]], [4.1, 40, 130, [22, 88, 62]], [1.2, 250, 70, [200, 80, 70]],
  [3.3, 310, 120, [50, 92, 72]], [5.0, 470, 60, [0, 0, 97]], [0.7, 580, 115, [22, 88, 62]]];
const flutterers = list => list.map(([ph, cx, cy, c]) => ({ph, cx, cy: HZ + cy * .82, c: css(c)}));
const butterflyAt = (b, t) => [Math.round(b.cx + 30 * Math.sin(t * .23 + b.ph) + 8 * Math.sin(t * .9 + b.ph * 2)), Math.round(b.cy + 10 * Math.sin(t * .31 + b.ph * 3) + 3 * Math.sin(t * 2.3 + b.ph))];
const butterflies = (t, P) => P.BUTTERFLIES.map(b => butterflyAt(b, t));
function drawButterflies(ctx, t, lt, P){
  const a = Math.max(0, 1 - lt.night * 1.6);   // gone by nightfall
  if(!a) return;
  ctx.globalAlpha = a;
  for(const b of P.BUTTERFLIES){
    const [x, y] = butterflyAt(b, t);
    const open = Math.floor(t * 7 + b.ph) % 2;
    ctx.fillStyle = b.c;
    if(open){ ctx.fillRect(x - 1, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1, 1, 2); } else { ctx.fillRect(x - 1, y - 2, 1, 1); ctx.fillRect(x + 1, y - 2, 1, 1); }
    ctx.fillStyle = 'rgb(40,30,30)'; ctx.fillRect(x, y - 1, 1, 2);
  }
  ctx.globalAlpha = 1;
}
const FIREFLIES = (() => { const r = mulberry(hash32('pasture-fireflies')); return Array.from({length: 26}, () => ({cx: r() * W, cy: HZ + 24 + r() * (H - HZ - 34), ph: r() * 6, sp: .5 + r() * .6, blink: 1.2 + r() * 2.5})); })();
const fireflyAt = (f, t) => [Math.round(f.cx + 22 * Math.sin(t * .17 * f.sp + f.ph) + 6 * Math.sin(t * .8 + f.ph * 2)), Math.round(f.cy + 7 * Math.sin(t * .23 * f.sp + f.ph * 3) + 2 * Math.sin(t * 1.9 + f.ph))];
const fireflies = t => FIREFLIES.map(f => fireflyAt(f, t));
const FLY = ['rgb(250,255,170)', 'rgba(220,255,120,.35)'];
function drawFireflies(ctx, t, lt, x0, x1){
  if(lt.night < .3) return;
  const a = Math.min(1, (lt.night - .3) / .5);
  for(const f of FIREFLIES){
    const [x, y] = fireflyAt(f, t);
    if(x < x0 - 2 || x > x1 + 2) continue;
    const g = Math.sin(t * f.blink + f.ph);
    if(g < -.2) continue;
    ctx.globalAlpha = a * Math.min(1, (g + .2) * 1.6);
    ctx.fillStyle = FLY[1]; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    ctx.fillStyle = FLY[0]; ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

/* ---------- places ---------- */
/* a place's builder fills in: name, Y0 (the back edge creatures stay in front of), isWater, LAND (a canvas),
   PROPS (things drawn in depth order with the creatures), NAPS (spots to nap at), drawWater(ctx, t, x0, x1, light),
   flow(x, y) (which way a floating ball drifts), and optionally isGap (ground nobody can stand on or swim in, like a
   gorge), TREE blobs, butterflyPaths, petals, leaves, seeds, dive, lift (how much less dark its night is) and
   drawGlow(ctx, t, light, x0, x1) (light of its own, drawn over the colour grade) */
const BUILDERS = {}, BUILT = {};
function define(id, builder){ BUILDERS[id] = builder; }
function place(id){
  if(BUILT[id]) return BUILT[id];
  buildShared();
  const P = {id, Y0: HZ + 22, isWater: new Uint8Array(W * H), PROPS: [], NAPS: [], TREE: [], BUTTERFLIES: flutterers(DEFAULT_BUTTERFLIES)};
  BUILDERS[id](P, Kit);
  if(P.butterflyPaths) P.BUTTERFLIES = flutterers(P.butterflyPaths);
  regions(P);
  return (BUILT[id] = P);
}
const has = id => !!BUILDERS[id];
const Kit = {W, H, HZ, clamp, rgb, css, mix, hi, lo, shift, bayer, h2, towards, wind, gustAt, layer, blade, WATER, SKY, LOOKS, hash32, mulberry};

window.PastureScene = {...Kit, define, place, has, lightAt, drawSky, drawLand, drawMoonlight, makeFx, drawButterflies, butterflies, drawFireflies, fireflies};
})();
