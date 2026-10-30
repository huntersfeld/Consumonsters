/* Consumonsters hats: little pixel hats a creature can wear in the pasture and on its collection tile.
   A hat is drawn on top of the sprite, never baked into it, so the creature underneath never changes. Hats are
   drawn in the sprites' style (dark outline, highlights warm and up-left, shadows cool and down-right) and are
   built for the head they sit on: the brim is sized from the head's width, so one hat fits a Small and an XL. */
(function(root){
'use strict';
const {F, build, render} = root.CM;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* a hat is built on a small grid whose centre line matches the sprite's (between columns 17 and 18);
   row BY is the brim, which sits one row down into the top of the head */
const LW = 26, LH = 26, C = 13, BY = 22, OX = 18 - C;

const HATS = {
  party: {name: 'Party hat', tall: true, pal: {a: [330, 80, 62], b: [48, 95, 60], c: [190, 80, 70], o: [330, 60, 22]}},
  beanie: {name: 'Beanie', pal: {a: [205, 65, 48], b: [205, 60, 40], d: [205, 55, 30], c: [0, 0, 96], o: [215, 50, 16]}},
  propeller: {name: 'Propeller cap', frames: 2, pal: {a: [0, 80, 55], b: [48, 95, 58], k: [220, 15, 30], r: [200, 70, 62], o: [220, 40, 15]}},
  cowboy: {name: 'Cowboy hat', pal: {a: [28, 50, 42], b: [20, 45, 24], o: [25, 45, 13]}},
  boppers: {name: 'Antenna boppers', pal: {a: [300, 55, 50], k: [0, 0, 22], p: [50, 95, 62], o: [300, 40, 16]}},
  sailor: {name: 'Sailor hat', pal: {a: [0, 0, 97], b: [222, 60, 34], o: [222, 45, 16]}},
  flower: {name: 'Flower crown', pal: {g: [110, 45, 38], p: [340, 75, 72], q: [52, 95, 65], w: [0, 0, 97], o: [110, 40, 15]}},
  miner: {name: 'Miner\'s helmet', pal: {a: [48, 95, 55], l: [55, 100, 86], k: [30, 20, 30], o: [40, 60, 18]}},
  wizard: {name: 'Wizard hat', tall: true, pal: {a: [262, 55, 40], y: [52, 100, 70], o: [262, 50, 14]}},
  viking: {name: 'Viking helmet', tall: true, pal: {a: [210, 8, 62], b: [30, 45, 38], w: [45, 35, 88], o: [215, 15, 20]}},
  cap: {name: 'Baseball cap', pal: {a: [8, 78, 52], b: [8, 70, 40], o: [8, 55, 16]}},
  chef: {name: 'Chef\'s hat', tall: true, pal: {a: [40, 15, 96], b: [210, 15, 80], o: [220, 15, 40]}},
  top: {name: 'Top hat', tall: true, pal: {a: [250, 15, 18], b: [350, 70, 45], o: [250, 20, 6]}},
  crown: {name: 'Crown', pal: {a: [46, 90, 55], r: [350, 80, 52], y: [50, 100, 86], o: [40, 70, 20]}},
  bow: {name: 'Bow', pal: {a: [350, 75, 58], b: [350, 70, 45], o: [350, 55, 18]}},
  beret: {name: 'Beret', pal: {a: [355, 60, 42], b: [355, 55, 30], r: [0, 85, 62], o: [355, 45, 14]}},
};
const FLAT = new Set(['y', 'l', 'r', 'k', 'w', 'p', 'q']);   // these keep one colour; the rest get the sprite shading

/* the drawings: s is the brim's half-width (2 to 7), f the animation frame */
const ART = {
  party(P, s){ const H = s * 2 + 2; for(let i = 0; i < H; i++) P.row(-i, Math.max(1, Math.ceil(s * (1 - i / H))), (i >> 1) % 2 ? 'b' : 'a'); P.row(-H, 1, 'c'); P.row(-H - 1, 1, 'c'); },
  beanie(P, s){
    P.row(0, s, 'b'); for(let x = C - s; x < C + s; x += 2) P.set(x, 0, 'd');
    const n = Math.max(2, Math.round(s * .8)); P.dome(-1, s, n, 'a'); P.row(-n - 1, 1, 'c');
  },
  propeller(P, s, f){
    P.row(0, s, 'a'); const n = Math.max(2, Math.round(s * .7)); P.dome(-1, s, n, 'a');
    for(let y = -n; y <= 0; y++) for(let x = 0; x < LW; x++) if(P.get(x, y) === 'a' && ((x - C + 64) >> 1) % 2) P.set(x, y, 'b');
    P.row(-n - 1, 1, 'k');
    if(f) P.row(-n - 2, Math.max(3, s - 1), 'r'); else { P.row(-n - 2, 1, 'r'); }
    P.row(-n - 2, 1, 'k');
  },
  cowboy(P, s){
    P.row(0, s + 2, 'a'); P.pair(s + 1, -1, 'a');
    const H = Math.max(2, Math.round(s * .8)); P.row(-1, s - 1, 'b'); for(let i = 2; i <= H + 1; i++) P.row(-i, s - 1, 'a');
    if(s >= 3) P.row(-H - 1, 1, 0);
  },
  boppers(P, s){
    P.row(0, s, 'a'); const a = Math.max(0, s - 2), H = s + 1;
    for(let y = -1; y >= -H; y--) P.pair(a, y, 'k');
    for(const y of [-H - 1, -H - 2]) for(const dx of [a, a + 1]) P.pair(dx, y, 'p');
  },
  sailor(P, s){ P.row(0, s, 'b'); P.row(-1, s, 'a'); P.row(-2, s - 1, 'a'); if(s >= 5) P.row(-3, s - 2, 'a'); },
  flower(P, s){ P.row(0, s, 'g'); for(let dx = 0; dx < s; dx += 2){ P.pair(dx, -1, (dx >> 1) % 2 ? 'q' : 'p'); if(s >= 4 && dx % 4 === 0) P.pair(dx, 0, 'w'); } },
  miner(P, s){ P.row(0, s + 1, 'a'); const n = Math.max(2, Math.round(s * .8)); P.dome(-1, s, n, 'a'); P.row(-1, 1, 'l'); P.row(-2, 1, 'l'); P.pair(1, -1, 'k'); P.pair(1, -2, 'k'); },
  wizard(P, s){
    P.row(0, s + 1, 'a'); const H = s * 2 + 3;
    for(let i = 1; i <= H; i++){ const hw = Math.max(1, Math.round((s - .5) * (1 - (i - 1) / H))), sh = Math.max(0, i - (H - 3)); P.span(-i, C - hw + sh, C + hw - 1 + sh, 'a'); }
    for(const [x, y] of [[C - 2, -3], [C + 1, -Math.round(H * .5)], [C - 1, -Math.round(H * .3)]]) if(P.get(x, y)) P.set(x, y, 'y');
  },
  viking(P, s){
    P.row(0, s, 'b'); const n = Math.max(2, Math.round(s * .8)); P.dome(-1, s, n, 'a');
    const L = s >= 5 ? 4 : 3; for(let i = 0; i < L; i++) P.pair(s + (i ? 1 : 0) + (i > 2 ? 1 : 0), -1 - i, 'w');
  },
  cap(P, s){ const n = Math.max(2, Math.round(s * .7)); P.dome(0, s, n, 'a'); P.span(0, C + s, C + s + Math.max(2, Math.round(s * .6)), 'b'); P.row(-n, 1, 'b'); },
  chef(P, s){
    P.row(0, s, 'a'); P.row(-1, s, 'a'); const H = s + 1;
    for(let i = 2; i <= H + 1; i++) P.row(-i, i === 2 || i === H + 1 ? s : s + 1, 'a');
    P.pair(Math.round(s / 2), -3, 'b'); if(s >= 4) P.pair(0, -H, 'b');
  },
  top(P, s){ P.row(0, s + 1, 'a'); P.row(-1, s - 1, 'b'); for(let i = 2; i <= s + 2; i++) P.row(-i, s - 1, 'a'); },
  crown(P, s){
    P.row(0, s, 'a'); P.row(-1, s, 'a'); P.pair(s - 1, -2, 'a'); P.pair(s - 1, -3, 'y'); P.pair(0, -2, 'a'); P.pair(0, -3, 'y');
    if(s >= 5){ const m = Math.round((s - 1) / 2); P.pair(m, -2, 'a'); }
    P.pair(0, -1, 'r');
  },
  bow(P, s){
    const m = clamp(s - 1, 2, 4); P.row(-1, 1, 'b'); P.row(0, 1, 'b');
    for(let i = 1; i <= m; i++){ const h = Math.ceil(i * .5); for(let y = -1 - h; y <= h; y++) P.pair(i, y, 'a'); }
  },
  beret(P, s){ P.row(0, s, 'b'); P.span(-1, C - s, C + s, 'a'); P.span(-2, C - s + 2, C + s, 'a'); P.set(C + 1, -3, 'a'); P.set(C - s + 1, -1, 'r'); },
};

/* ---------- colour, as in the sprites ---------- */
const towards = (h, tg, amt) => {const d = ((tg - h + 540) % 360) - 180; return (h + Math.sign(d) * Math.min(Math.abs(d), amt) + 360) % 360;};
const css = c => `hsl(${c[0].toFixed(1)}, ${clamp(c[1], 0, 100).toFixed(1)}%, ${clamp(c[2], 2, 98).toFixed(1)}%)`;
const hiC = c => css([towards(c[0], 55, 10), c[1] + 4, c[2] + 13]);
const loC = c => css([towards(c[0], 245, 12), c[1] + 6, c[2] - 14]);

function grid(id, s, f){
  const g = new Array(LW * LH).fill(0);
  const set = (x, y, k) => { y += BY; if(x >= 0 && y >= 0 && x < LW && y < LH) g[y * LW + x] = k; };
  const P = {
    set, get: (x, y) => { y += BY; return x >= 0 && y >= 0 && x < LW && y < LH ? g[y * LW + x] : 0; },
    span(y, a, b, k){ for(let x = a; x <= b; x++) set(x, y, k); },
    row(y, hw, k){ this.span(y, C - hw, C + hw - 1, k); },
    pair(dx, y, k){ set(C + dx, y, k); set(C - 1 - dx, y, k); },
    dome(y, s, n, k){ for(let i = 0; i < n; i++) this.row(y - i, Math.max(1, Math.round(s * Math.sqrt(1 - (i / (n + .5)) ** 2))), k); },
  };
  ART[id](P, s, f);
  return g;
}
const cache = new Map();
/* the hat as a little canvas, one pixel per sprite pixel, and its top row (relative to the brim) */
function sprite(id, s, f = 0){
  const key = `${id}:${s}:${f}`;
  if(cache.has(key)) return cache.get(key);
  const g = grid(id, s, f), pal = HATS[id].pal, at = (x, y) => x < 0 || y < 0 || x >= LW || y >= LH ? 0 : g[y * LW + x];
  const cv = document.createElement('canvas'); cv.width = LW; cv.height = LH;
  const ctx = cv.getContext('2d');
  let top = LH;
  for(let y = 0; y < LH; y++) for(let x = 0; x < LW; x++){
    const k = g[y * LW + x];
    if(!k){   // the outline: any empty cell beside the hat
      if(at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)){ ctx.fillStyle = css(pal.o); ctx.fillRect(x, y, 1, 1); top = Math.min(top, y); }
      continue;
    }
    const c = pal[k];
    ctx.fillStyle = FLAT.has(k) ? css(c) : !at(x, y - 1) ? hiC(c) : !at(x, y + 1) ? loC(c) : !at(x - 1, y) ? hiC(c) : !at(x + 1, y) ? loC(c) : css(c);
    ctx.fillRect(x, y, 1, 1);
    top = Math.min(top, y);
  }
  const out = {cv, top: top - BY};
  cache.set(key, out);
  return out;
}

/* where a hat goes on this creature: the top of its head (toppers left out) and the head's width there */
const fits = new Map();
function fit(t){
  if(fits.has(t.gtin)) return fits.get(t.gtin);
  const G = build(t, 1);
  let top = 0;
  for(let y = 0; y < F; y++) if(G[y * F + 17] || G[y * F + 18]){ top = y; break; }
  let w = 0; const r = Math.min(F - 1, top + 3);
  for(let x = 0; x < F; x++) if(G[r * F + x]) w++;
  const out = {top, s: clamp(Math.round(w / 2 * .85), 2, 7)};
  fits.set(t.gtin, out);
  return out;
}

/* a few toppers get in the way */
function allowed(t, id){
  if(t.topper === 'mushroom') return id === 'bow' || id === 'flower';
  if((t.topper === 'halo' || t.topper === 'flame') && HATS[id].tall) return false;
  return true;
}
const why = t => t.topper === 'mushroom' ? 'Only a bow or flowers fit on a mushroom cap.' : `Too tall to fit under its ${t.topper}.`;

/* draw creature t's hat, for a sprite whose top-left corner is at (x, y) and drawn at this scale */
function draw(ctx, t, id, x, y, scale = 1, f = 0){
  if(!id || !HATS[id] || !allowed(t, id)) return;
  const {top, s} = fit(t), h = sprite(id, s, f % (HATS[id].frames || 1));
  const was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(h.cv, x + OX * scale, y + (top + 1 - BY) * scale, LW * scale, LH * scale);
  ctx.imageSmoothingEnabled = was;
}
/* how far above the sprite's top row the hat reaches (0 when it fits inside) */
function overhang(t, id){
  if(!id || !HATS[id] || !allowed(t, id)) return 0;
  const {top, s} = fit(t);
  return Math.max(0, -(top + 1 + sprite(id, s).top));
}
/* the hat's highest row in sprite pixels, for placing labels above it */
const hatTop = (t, id) => !id || !HATS[id] || !allowed(t, id) ? F : fit(t).top + 1 + sprite(id, fit(t).s).top;

/* a creature with its hat on a square canvas: grows the canvas (and keeps the creature at the bottom) when the hat pokes out the top */
function renderWith(cv, t, id, scale){
  const over = overhang(t, id);
  if(!over){ render(cv, t, {scale}); draw(cv.getContext('2d'), t, id, 0, 0, scale); return; }
  const tmp = document.createElement('canvas'); render(tmp, t, {scale});
  const n = F + over; cv.width = cv.height = n * scale;
  const ctx = cv.getContext('2d'), x = Math.round(over / 2) * scale, y = over * scale;
  ctx.drawImage(tmp, x, y); draw(ctx, t, id, x, y, scale);
}
/* a hat on its own, for buttons: a small medium-sized one */
function icon(id, scale = 2){
  const h = sprite(id, 4), cv = document.createElement('canvas');
  const g = grid(id, 4, 0); let x0 = LW, x1 = 0, y0 = LH, y1 = 0;
  for(let y = 0; y < LH; y++) for(let x = 0; x < LW; x++) if(g[y * LW + x]){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  x0--; y0--; x1++; y1++;
  cv.width = (x1 - x0 + 1) * scale; cv.height = (y1 - y0 + 1) * scale;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(h.cv, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, cv.width, cv.height);
  return cv;
}

root.CMHats = {HATS, fit, allowed, why, draw, overhang, hatTop, renderWith, icon, sprite, grid, ART};
})(typeof window !== 'undefined' ? window : globalThis);
