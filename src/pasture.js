/* Consumonsters pasture: caught creatures hop around the meadow from pasture-scene.js. The meadow is wider than
   most screens, so the canvas is a window onto it that you can drag sideways. Nothing here changes how a creature looks. */
(() => {
'use strict';
const {F, hash32, mulberry, render, RARITY} = window.CM;
const S = window.PastureScene;
const {W, H, HZ, clamp, css, WATER, isWater, sCx, sW, sL, sR, PROPS} = S;
const FOOT = F - 3, CXS = (F - 1) / 2;     // sprite foot row and centre column (GY and CX in engine.js)
const Y0 = HZ + 22;                        // creatures stay in front of the fence
const MIN_SCALE = 2;                       // screen pixels per scene pixel, at least; narrower screens pan instead of shrinking
const SHADOW = 'rgba(16,40,12,.26)';

/* ---------- creatures ---------- */
/* How each kind of feet gets around, as multipliers on the size-based hop: stride (distance per hop), hop time,
   hop height, the pauses before and after a hop, rests between wanders, how quickly it reacts to a call, and how
   much farther it goes per hop in water. Floaters glide instead, at their own drift speed. */
const GAITS = {
  insect_legs: {stride: .7, hopT: .45, hopH: .5, pause: .5, rest: .6, react: .5},   // scurry: many tiny quick hops
  thin: {stride: .9, hopT: .7, hopH: 1.1, pause: .7, rest: .8, react: .7},           // skip
  hooves: {stride: 1.6, hopT: 1.3, hopH: 1.9, pause: 1.2, rest: 1.1, react: .9},     // bound: big springy hops
  stubby: {}, claws: {},                                                             // waddle: the standard hop
  webbed: {stride: .7, hopT: 1.1, hopH: .7, rest: 1.1, react: 1.1, water: 1.8},     // slow on land, quick in water
  coil: {stride: .9, hopT: 1.2, hopH: .2, pause: .5, react: .9},                     // slither: low and flat
  tentacles: {stride: .55, hopT: 1.3, hopH: .5, pause: 1.3, rest: 1.3, react: 1.2, water: 2.2},
  roots: {stride: .4, hopT: 1.1, hopH: .45, pause: 1.6, rest: 2, react: 1.6},        // shuffle, with long rests
  float: {react: 1},
};
const gaitOf = t => ({stride: 1, hopT: 1, hopH: 1, pause: 1, rest: 1, react: 1, water: 1, ...GAITS[t.feet]});
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
/* Where a creature may stand. Walkers keep to their own bank of the stream; winged ones can use either bank (hopping
   over the water), aquatic ones can be anywhere including the stream, and floaters drift wherever they like. */
const nearOK = (c, x, y) => x + c.hw <= sL(y) - 2;
const farOK = (c, x, y) => x - c.hw >= sR(y) + 2;
function walkable(c, x, y){
  if(y < Y0 || y > H - 3 || x - c.hw < 3 || x + c.hw > W - 3) return false;
  if(c.move === 'swim' || c.move === 'float') return true;
  if(c.move === 'fly') return nearOK(c, x, y) || farOK(c, x, y);
  return c.bank ? farOK(c, x, y) : nearOK(c, x, y);
}
const inWater = c => {const x = Math.round(c.x), y = Math.round(c.y); return y < H && y >= 0 && x >= 0 && x < W && !!isWater[y * W + x];};

function newCreature(g, t){
  const spr = makeSprite(t), n = (spr.x1 - spr.x0 + 1);
  const r = mulberry(hash32(g + ':pasture'));
  const c = {g, t, spr, hw: Math.max(3, n / 2), floater: t.feet === 'float', aquatic: t.domain === 'aquatic',
    move: t.feet === 'float' ? 'float' : t.domain === 'aquatic' ? 'swim' : /^wings_/.test(t.sides) ? 'fly' : 'walk',
    st: 'idle', timer: r() * 3, lift: 0, ph: r() * 4, happy: 0, x: 0, y: 0};
  c.bank = r() < sCx(Y0) / W ? 0 : 1;   // walkers live on one bank, picked in proportion to its width
  const size = spr.y1 - spr.y0 + 1;
  const G = c.gait = gaitOf(t), pep = .85 + r() * .3;   // pep: two creatures with the same feet still differ a little
  c.stride = (7 + size * .22) * G.stride * pep; c.hopH = (3 + Math.max(0, 32 - size) * .2) * G.hopH; c.hopT = (.3 + size * .006) * G.hopT / pep;
  c.drift = (5 + r() * 4) * (1.2 - size / 80);   // floaters' glide speed, in scene pixels a second; smaller ones are quicker
  for(let i = 0; i < 60; i++){ c.x = 6 + r() * (W - 12); c.y = Y0 + r() * (H - 3 - Y0); if(walkable(c, c.x, c.y)) break; }
  if(!walkable(c, c.x, c.y)){ c.bank = 0; c.x = 40; c.y = (Y0 + H) / 2; }
  return c;
}
function pickTarget(c){
  for(let i = 0; i < 14; i++){
    let tx, ty;
    const roll = Math.random();
    if(c.move !== 'walk' && roll < .25){   // a trip to the other side of the stream
      ty = c.y + (Math.random() - .5) * 40;
      tx = c.x < sCx(c.y) ? sR(ty) + 2 + c.hw + Math.random() * 30 : sL(ty) - 2 - c.hw - Math.random() * 30;
    }
    else if(c.aquatic && roll < .6){ ty = c.y + (Math.random() - .5) * 50; tx = sCx(ty) + (Math.random() - .5) * sW(ty) * .5; }
    else { const a = Math.random() * Math.PI * 2, dd = 14 + Math.random() * 40; tx = c.x + Math.cos(a) * dd; ty = c.y + Math.sin(a) * dd * .6; }
    if(walkable(c, tx, ty) && (c.move === 'fly' || walkable(c, (tx + c.x) / 2, (ty + c.y) / 2))){ c.tx = tx; c.ty = ty; return true; }
  }
  return false;
}
/* the nearest spot this creature can stand on to (x, y) */
function reachable(c, x, y){
  y = clamp(y, Y0, H - 3);
  x = clamp(x, 3 + c.hw, W - 3 - c.hw);
  if(walkable(c, x, y)) return [x, y];
  const near = [Math.min(x, sL(y) - 2 - c.hw), y], far = [Math.max(x, sR(y) + 2 + c.hw), y];
  if(c.move === 'walk') return c.bank ? far : near;
  return walkable(c, ...far) && far[0] - x < x - near[0] ? far : near;
}
/* a winged creature reaching the water flutters straight over it to the first dry spot on the far side */
function flyAcross(c, dx, dy, dist){
  const ux = dx / dist, uy = dy / dist, startNear = c.x < sCx(c.y);
  for(let s = c.stride; s <= Math.min(dist, 55); s++){
    const x = c.x + ux * s, y = c.y + uy * s;
    if(walkable(c, x, y) && (x < sCx(y)) !== startNear) return [x, y, s];
  }
  return null;
}
/* nearly there after a call: take the next free spot around it, so spots go in order of arrival */
function claimSpot(c, dist){
  if(!c.called || !c.call || c.slot || dist >= c.call.r() + (c.floater ? 4 : c.stride)) return false;
  const i = c.call.n++, a = i * 2.4, r = c.call.ring(i);
  c.slot = true; [c.tx, c.ty] = reachable(c, c.call.x + Math.cos(a) * r, c.call.y + Math.sin(a) * r * .6);
  return true;
}
function nextHop(c){
  const dx = c.tx - c.x, dy = c.ty - c.y, dist = Math.hypot(dx, dy);
  if(!c.happy && dist < 2){
    if(c.called){ c.called = false; c.happy = 1; c.linger = true; nextHop(c); return; }   // made it: a happy hop on arrival
    c.st = 'idle'; c.timer = c.linger ? 3 + Math.random() * 3 : (1 + Math.random() * 3.5) * c.gait.rest; c.linger = false; return;
  }
  if(claimSpot(c, dist)){ nextHop(c); return; }
  if(c.floater && !c.happy){ c.st = 'glide'; return; }
  const stride = c.stride * (c.move === 'swim' && inWater(c) ? c.gait.water : 1);
  const k = c.happy ? 0 : Math.min(1, stride / dist);
  let nx = c.x + dx * k, ny = c.y + dy * k;
  if(!c.happy && c.move === 'fly' && !walkable(c, nx, ny)){
    const j = flyAcross(c, dx, dy, dist);
    if(j){ c.hop = {fx: c.x, fy: c.y, tx: j[0], ty: j[1], dur: .45 + j[2] * .01, h: 10 + j[2] * .12}; c.st = 'crouch'; c.timer = .1; return; }
  }
  if(c.called) [nx, ny] = reachable(c, nx, ny);
  if(c.called && Math.hypot(nx - c.x, ny - c.y) < .5){ c.called = false; c.st = 'idle'; c.timer = 3; return; }   // as close as it can get
  if(!c.happy && !walkable(c, nx, ny)){ c.called = false; c.st = 'idle'; c.timer = 1 + Math.random() * 2; return; }
  c.hop = {fx: c.x, fy: c.y, tx: nx, ty: ny, dur: c.happy ? .4 : c.hopT, h: c.happy ? 9 : c.hopH};
  c.st = 'crouch'; c.timer = (c.called ? .05 : .08) * c.gait.pause;
}
/* "come here!": creatures near the tapped spot head over, each after its own moment to notice; farther ones may
   not bother, and ones on the far side of the meadow don't hear it. Spots around the call go in order of arrival. */
function call(mobs, x, y){
  const spot = {x, y, n: 0, ring: i => i ? 9 + 10 * Math.sqrt(i) : 0, r(){ return this.ring(this.n) + 4; }};
  for(const c of mobs){
    const d = Math.hypot(c.x - x, (c.y - y) / .6);
    if(!(d < 110 || (d < 220 && Math.random() < .4))) continue;
    [c.tx, c.ty] = reachable(c, x, y);
    c.called = true; c.call = spot; c.slot = false; c.linger = false; c.happy = 0;
    c.wait = (.15 + Math.random() * .9 + d * .004) * c.gait.react;   // how long before it notices
    if(c.st === 'idle' || c.st === 'glide'){ c.st = 'idle'; c.timer = c.wait; c.wait = 0; }
  }
}
function stepCreature(c, dt, fx){
  switch(c.st){
    case 'idle':
      c.timer -= dt;
      if(c.timer <= 0){ if(c.called || (!c.sel && Math.random() < .75 && pickTarget(c))) nextHop(c); else c.timer = (1 + Math.random() * 3) * c.gait.rest; }
      break;
    case 'crouch': c.timer -= dt; if(c.timer <= 0){ c.st = 'air'; c.timer = 0; } break;
    case 'air': {
      c.timer += dt; const p = Math.min(1, c.timer / c.hop.dur), h = c.hop;
      c.x = h.fx + (h.tx - h.fx) * p; c.y = h.fy + (h.ty - h.fy) * p; c.lift = Math.round(h.h * 4 * p * (1 - p));
      if(p >= 1){ c.lift = 0; c.st = 'land'; c.timer = .1 * c.gait.pause; if(c.happy) c.happy--; if(inWater(c)) fx.splash(c.x, c.y - 3); }
      break;
    }
    case 'land':
      c.timer -= dt;
      if(c.timer > 0) break;
      if(c.happy) nextHop(c); else if(c.sel){ c.st = 'idle'; c.timer = 1; }
      else if(c.wait){ c.st = 'idle'; c.timer = c.wait; c.wait = 0; }   // heard a call mid-hop: it takes a moment to turn round
      else nextHop(c);
      break;
    case 'glide': {
      claimSpot(c, Math.hypot(c.tx - c.x, c.ty - c.y));
      const dx = c.tx - c.x, dy = c.ty - c.y, dist = Math.hypot(dx, dy), v = c.drift * (c.called ? 2 : 1) * dt;
      if(dist <= v || c.sel){ c.st = 'idle'; c.timer = c.called ? 3 + Math.random() * 3 : 1 + Math.random() * 3; c.called = false; break; }
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
    if(inWater(c)){   // a floater's shadow on the water, broken up by the current
      ctx.fillStyle = 'rgba(10,40,80,.3)';
      for(let x = fx - rx; x < fx + rx; x++) if((x + Math.floor(t * 6)) % 4){ ctx.fillRect(x, fy, 1, 1); if(x > fx - rx && x < fx + rx - 1) ctx.fillRect(x, fy + 1, 1, 1); }
    } else { ctx.fillStyle = SHADOW; ctx.fillRect(fx - rx, fy, rx * 2, 1); ctx.fillRect(fx - rx + 1, fy + 1, rx * 2 - 2, 1); }
  }
  const sh = wet ? FOOT - 3 : FOOT + 2;   // rows of the sprite above the waterline
  if((c.st === 'crouch' || c.st === 'land') && !wet) ctx.drawImage(S.cv, 0, 0, F, sh, left - 1, top + 2, F + 2, sh - 2);
  else ctx.drawImage(S.cv, 0, 0, F, sh, left, top, F, sh);
  if(wet){
    const wl = top + sh, rx = Math.round(c.hw) + 1;
    for(let x = fx - rx; x <= fx + rx; x++){ if((x + Math.floor(t * 4)) % 3 === 0) continue; ctx.fillStyle = css(WATER.foam); ctx.fillRect(x, wl, 1, 1); }
  }
}
/* a little face for the jump-to row: the sprite's top half, cropped to its outline */
function faceOf(c){
  const S = c.spr, w = S.x1 - S.x0 + 1, h = Math.min(S.y1 - S.y0 + 1, Math.max(10, Math.ceil(w * .9)));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(S.cv, S.x0, S.y0, w, h, 0, 0, w, h);
  return cv;
}

/* ---------- the view ---------- */
function create({canvas, label, faces, onOpen}){
  S.build();
  const ctx = canvas.getContext('2d'), box = canvas.parentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fx = S.makeFx();
  let mobs = [], byG = new Map(), raf = 0, last = 0, t = 0, sel = null;
  let VW = W, camX = 0, vel = 0, goal = null, placed = false;   // view width and left edge, in scene pixels

  /* the camera: fit the scene to the box, and pan when the box is too narrow for all of it */
  const pannable = () => VW < W;
  const setCam = x => { camX = clamp(x, 0, W - VW); };
  function fit(){
    const cw = box.clientWidth;
    if(!cw) return;
    const vw = Math.min(W, Math.ceil(cw / Math.max(cw / W, MIN_SCALE)));
    if(vw !== VW || canvas.width !== vw){
      const mid = camX + VW / 2;
      VW = vw; canvas.width = VW; canvas.height = H; box.style.aspectRatio = `${VW} / ${H}`;
      setCam(mid - VW / 2);
    }
    box.classList.toggle('pan', pannable());
    if(faces) faces.hidden = !pannable() || !mobs.length;
    if(still || !raf) frame();
  }
  function centreOnHerd(){
    if(!mobs.length || !box.clientWidth) return;
    const xs = mobs.map(c => c.x).sort((a, b) => a - b);
    setCam(xs[xs.length >> 1] - VW / 2); placed = true;
  }

  function frame(){
    const x0 = Math.round(camX), x1 = x0 + VW;
    ctx.setTransform(1, 0, 0, 1, -x0, 0);
    ctx.imageSmoothingEnabled = false;
    S.drawSky(ctx, t);
    S.drawWater(ctx, t, x0, x1);
    const items = [];
    for(const p of PROPS) if(p.x > x0 - 8 && p.x < x1 + 8) items.push(p);
    for(const c of mobs) if(c.x + F / 2 > x0 && c.x - F / 2 < x1) items.push({y: c.y + .5, c});
    items.sort((a, b) => a.y - b.y);
    for(const it of items) it.c ? drawCreature(ctx, it.c, t) : it.draw(ctx, t);
    fx.draw(ctx); S.drawButterflies(ctx, t);
    if(sel) placeLabel();
  }
  function tick(now){
    raf = requestAnimationFrame(tick);
    const dt = Math.min(.1, (now - last) / 1000 || 0);
    if(dt < 1 / 32) return;   // ~30 fps is plenty for pixel art
    last = now; t += dt;
    if(goal !== null){ const d = goal - camX; if(Math.abs(d) < .5){ setCam(goal); goal = null; } else setCam(camX + d * Math.min(1, dt * 6)); }
    else if(!drag && Math.abs(vel) > 2){ setCam(camX + vel * dt); vel *= Math.pow(.03, dt); if(camX <= 0 || camX >= W - VW) vel = 0; }
    for(const c of mobs) stepCreature(c, dt, fx);
    fx.step(dt, t);
    frame();
  }
  function placeLabel(){
    const c = sel, top = c.y - FOOT - liftOf(c, t) + c.spr.y0 - 3;
    label.style.left = ((c.x - Math.round(camX)) / VW * 100) + '%'; label.style.top = (Math.max(0, top) / H * 100) + '%';
  }
  function select(c){
    if(sel) sel.sel = false;
    sel = c;
    if(faces) for(const b of faces.children) b.setAttribute('aria-pressed', String(!!c && b.dataset.g === c.g));
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
  function lookAt(c){
    const x = clamp(c.x - VW / 2, 0, W - VW);
    vel = 0;
    if(still){ setCam(x); frame(); } else goal = x;
  }

  /* drag sideways to look around; a tap that doesn't move still calls creatures or picks one */
  let drag = null, dragged = false;
  canvas.addEventListener('pointerdown', e => {
    dragged = false;
    if(!pannable() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = {id: e.pointerId, x: e.clientX, cam: camX, moved: false, lx: e.clientX, lt: e.timeStamp};
    vel = 0; goal = null;
  });
  canvas.addEventListener('pointermove', e => {
    if(!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, k = VW / canvas.getBoundingClientRect().width;
    if(!drag.moved && Math.abs(dx) > 6){ drag.moved = true; canvas.setPointerCapture(e.pointerId); box.classList.add('dragging'); }
    if(!drag.moved) return;
    setCam(drag.cam - dx * k);
    const dt = (e.timeStamp - drag.lt) / 1000;
    if(dt > 0){ vel = vel * .6 + (-(e.clientX - drag.lx) * k / dt) * .4; drag.lx = e.clientX; drag.lt = e.timeStamp; }
    if(still || !raf) frame();
  });
  const endDrag = e => {
    if(!drag || e.pointerId !== drag.id) return;
    dragged = drag.moved;
    if(e.timeStamp - drag.lt > 80 || still) vel = 0;   // let go after holding still: no fling
    drag = null; box.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', e => { endDrag(e); vel = 0; });
  canvas.addEventListener('wheel', e => {   // sideways trackpad swipes and shift-scroll on desktop
    if(!pannable()) return;
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if(!dx) return;
    e.preventDefault(); goal = null; vel = 0;
    setCam(camX + dx * VW / canvas.getBoundingClientRect().width);
    if(still || !raf) frame();
  }, {passive: false});

  canvas.addEventListener('click', e => {
    if(dragged){ dragged = false; return; }
    const r = canvas.getBoundingClientRect(), px = Math.round(camX) + (e.clientX - r.left) / r.width * VW, py = (e.clientY - r.top) / r.height * H;
    const hit = mobs.slice().sort((a, b) => b.y - a.y).find(c => {
      const lx = px - (Math.round(c.x) - Math.round(CXS + .5)), ly = py - (Math.round(c.y) - FOOT - liftOf(c, t));
      return lx >= c.spr.x0 - 2 && lx <= c.spr.x1 + 3 && ly >= c.spr.y0 - 2 && ly <= c.spr.y1 + 3;
    });
    if(hit){ select(hit !== sel ? hit : null); return; }
    const hadSel = !!sel; select(null);
    if(still || hadSel) return;   // the first tap off a creature just closes its label
    call(mobs, px, py); fx.ping(Math.round(px), Math.round(py));
  });

  function buildFaces(){
    if(!faces) return;
    faces.replaceChildren(...mobs.map(c => {
      const b = document.createElement('button'), cv = faceOf(c);
      b.type = 'button'; b.dataset.g = c.g; b.title = c.t.name; b.setAttribute('aria-label', `Show ${c.t.name}`); b.setAttribute('aria-pressed', String(c === sel));
      b.className = `r-${c.t.rarity}`; b.appendChild(cv);
      b.addEventListener('click', () => { lookAt(c); if(c !== sel) select(c); });
      return b;
    }));
  }

  if(window.ResizeObserver) new ResizeObserver(fit).observe(box); else addEventListener('resize', fit);

  return {
    /* list: [{g, t}], most recent first */
    setCreatures(list){
      const next = new Map();
      for(const {g, t: tr} of list) next.set(g, byG.get(g) || newCreature(g, tr));
      const changed = next.size !== byG.size || [...next.keys()].some(g => !byG.has(g));
      byG = next; mobs = [...next.values()];
      if(sel && !byG.has(sel.g)) select(null);
      if(changed) buildFaces();
      fit();
      if(!placed) centreOnHerd();
      frame();
    },
    start(){ fit(); if(!placed) centreOnHerd(); if(still){ frame(); return; } if(!raf){ last = performance.now(); raf = requestAnimationFrame(tick); } },
    stop(){ if(raf) cancelAnimationFrame(raf); raf = 0; vel = 0; goal = null; select(null); },
  };
}

window.Pasture = {create, W, H};
})();
