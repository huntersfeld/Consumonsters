/* Consumonsters pasture: caught creatures hop around the meadow from pasture-scene.js. The meadow is wider than
   most screens, so the canvas is a window onto it that you can drag sideways. Nothing here changes how a creature looks. */
(() => {
'use strict';
const {F, hash32, mulberry, render, RARITY} = window.CM;
const {temperament} = window.CMTemper;
const Bond = window.CMBond;
const S = window.PastureScene;
const {W, H, HZ, clamp, css, WATER, isWater, sCx, sW, sL, sR, TREES, PROPS} = S;
const FOOT = F - 3, CXS = (F - 1) / 2;     // sprite foot row and centre column (GY and CX in engine.js)
const Y0 = HZ + 22;                        // creatures stay in front of the fence
const MIN_SCALE = 2;                       // screen pixels per scene pixel, at least; narrower screens pan instead of shrinking
const SHADOW = 'rgba(16,40,12,.26)';
const HEART_PULL = [0, .25, .35, .45, .55, .65];   // how much more likely a call is answered at 0..5 hearts
let clock = 0, pointer = null;                     // pasture time, and where the finger or cursor last was (scene pixels)

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
    st: 'idle', timer: r() * 3, lift: 0, ph: r() * 4, happy: 0, x: 0, y: 0, p: temperament(g, t.domain), mode: null, bubble: null};
  c.bank = r() < sCx(Y0) / W ? 0 : 1;   // walkers live on one bank, picked in proportion to its width
  const size = spr.y1 - spr.y0 + 1;
  const G = c.gait = gaitOf(t), pep = (.85 + r() * .3) * (.9 + c.p.energy * .2);   // pep: two creatures with the same feet still differ a little
  c.restK = 1.7 - 1.2 * c.p.energy;   // lazy ones rest longer between wanders
  c.stride = (7 + size * .22) * G.stride * pep; c.hopH = (3 + Math.max(0, 32 - size) * .2) * G.hopH; c.hopT = (.3 + size * .006) * G.hopT / pep;
  c.drift = (5 + r() * 4) * (1.2 - size / 80);   // floaters' glide speed, in scene pixels a second; smaller ones are quicker
  for(let i = 0; i < 60; i++){ c.x = 6 + r() * (W - 12); c.y = Y0 + r() * (H - 3 - Y0); if(walkable(c, c.x, c.y)) break; }
  if(!walkable(c, c.x, c.y)){ c.bank = 0; c.x = 40; c.y = (Y0 + H) / 2; }
  return c;
}
function pickTarget(c, mobs){
  const p = c.p;
  if(mobs && p.sociability > .55 && Math.random() < p.sociability * .5){   // social ones wander over to a friend
    const f = nearest(c, mobs, 90, o => walkable(c, o.x, o.y));
    if(f){ const a = Math.random() * Math.PI * 2, [tx, ty] = reachable(c, f.x + Math.cos(a) * 16, f.y + Math.sin(a) * 9); c.tx = tx; c.ty = ty; return true; }
  }
  if(mobs && p.sociability < .3){   // loners edge away from a crowd
    const f = nearest(c, mobs, 26);
    if(f){ const dx = c.x - f.x || 1, dy = c.y - f.y, d = Math.hypot(dx, dy); const [tx, ty] = reachable(c, c.x + dx / d * 30, c.y + dy / d * 18); if(walkable(c, tx, ty)){ c.tx = tx; c.ty = ty; return true; } }
  }
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
function nearest(c, mobs, within, ok = () => true){
  let best = null, bd = within;
  for(const o of mobs){ if(o === c) continue; const d = Math.hypot(o.x - c.x, (o.y - c.y) / .6); if(d < bd && ok(o)){ bd = d; best = o; } }
  return best;
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
    if(c.called){ c.called = false; c.happy = 1; c.linger = true; c.arrived = clock; nextHop(c); return; }   // made it: a happy hop on arrival
    c.st = 'idle'; c.timer = c.mode ? .05 : c.linger ? 3 + Math.random() * 3 : (1 + Math.random() * 3.5) * c.gait.rest * c.restK; c.linger = false; return;
  }
  if(claimSpot(c, dist)){ nextHop(c); return; }
  if(c.called && !c.slot && Math.random() < (1 - c.p.focus) ** 2 * .1){   // a curious one forgets what it was doing
    c.called = false; say(c, '?'); c.st = 'idle'; c.timer = .8 + Math.random(); return;
  }
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
  c.st = 'crouch'; c.timer = (c.called || c.mode ? .05 : .08) * c.gait.pause;
}
/* "come here!": creatures near the tapped spot decide whether to come. Bold ones usually do; shy ones back off,
   stubborn ones sit tight, and calling the same spot again wins some of them over. Ones that come each take their
   own moment to notice, and spots around the call go in order of arrival. */
function call(mobs, x, y, t){
  const spot = {x, y, n: 0, ring: i => i ? 9 + 10 * Math.sqrt(i) : 0, r(){ return this.ring(this.n) + 4; }};
  for(const c of mobs){
    const d = Math.hypot(c.x - x, (c.y - y) / .6);
    if(!(d < 110 || (d < 220 && Math.random() < .4))) continue;
    const L = c.lastCall, again = L && t - L.t < 8 && Math.hypot(L.x - x, L.y - y) < 40;
    c.nag = again ? (c.nag || 0) + 1 : 0; c.lastCall = {x, y, t};
    const p = c.p, wasNapping = c.mode === 'nap' && c.nap > 0;
    let come = clamp(.22 + .75 * p.boldness - .35 * (p.focus - .5) + .22 * c.nag + HEART_PULL[Bond.hearts(c.g)], .08, .97);
    if(wasNapping) come *= .5;
    if(c.called) come = 1;   // already on its way
    if(Math.random() >= come){ if(!wasNapping) endMode(c); refuse(c, x, y, wasNapping); continue; }
    endMode(c);
    [c.tx, c.ty] = reachable(c, x, y);
    c.called = true; c.call = spot; c.slot = false; c.linger = false; c.happy = 0;
    c.wait = (.15 + Math.random() * .9 + d * .004) * c.gait.react * (wasNapping ? 2.5 : 1);   // how long before it notices
    if(wasNapping) say(c, '!');
    if(c.st === 'idle' || c.st === 'glide'){ c.st = 'idle'; c.timer = c.wait; c.wait = 0; }
  }
}
/* not coming: shy ones hop away, stubborn ones stay put, the rest just look puzzled */
function refuse(c, x, y, sleepy){
  if(sleepy){ say(c, 'z'); return; }
  if(c.p.boldness < .35){
    say(c, '…');
    const dx = c.x - x || 1, dy = c.y - y, d = Math.hypot(dx, dy), [tx, ty] = reachable(c, c.x + dx / d * 24, c.y + dy / d * 14);
    if(c.st === 'idle' || c.st === 'glide'){ c.tx = tx; c.ty = ty; c.st = 'idle'; c.timer = .3; }
  }
  else if(c.p.focus > .62){ say(c, '…'); if(c.st === 'idle') c.timer = Math.max(c.timer, 2); }
  else say(c, '?');
}
const say = (c, k, secs = 1.4) => { c.bubble = {k, life: secs}; };
function endMode(c){
  if(c.mode === 'tag' && c.tag && c.tag.other.mode === 'tag') { c.tag.other.mode = null; c.tag.other.tag = null; }
  c.mode = null; c.tag = null; c.nap = 0;
}

/* things that play out on their own: naps under a tree, butterfly chases, tag between friends, splashing about */
function startSomething(c, w){
  const p = c.p, R = Math.random(), n = w.night;
  if(p.energy < .4 + .45 * n && R < (1 - p.energy) * (.12 + .3 * n)){   // a nap, under the nearest tree it can reach; most of them doze off at night
    const tr = TREES.map(tr => reachable(c, tr.x + (Math.random() - .5) * 18, tr.y + 6)).find(([x, y]) => Math.hypot(x - c.x, y - c.y) < 170 && walkable(c, x, y));
    c.mode = 'nap'; c.nap = 0;
    if(tr){ [c.tx, c.ty] = tr; } else { c.tx = c.x; c.ty = c.y; }
    return true;
  }
  if(p.playfulness > .55 && R < p.playfulness * .25){
    const bf = w.butterflies.map(([x, y]) => ({x, y: y + 8})).find(b => Math.hypot(b.x - c.x, b.y - c.y) < 80 && walkable(c, ...reachable(c, b.x, b.y)));
    if(bf){ c.mode = 'chase'; c.until = w.t + 4 + Math.random() * 4; return modeTarget(c, w); }
    const f = p.sociability > .45 && nearest(c, w.mobs, 70, o => !o.mode && !o.called && !o.sel && o.p.playfulness > .45 && o.st === 'idle' && walkable(c, o.x, o.y) && walkable(o, c.x, c.y));
    if(f){   // tag! this one is "it"
      c.mode = f.mode = 'tag'; c.tag = {other: f, it: true, rounds: 0, until: w.t + 16}; f.tag = {other: c, it: false, rounds: 0, until: w.t + 16};
      say(f, '!'); f.st = 'idle'; f.timer = .1;
      return modeTarget(c, w);
    }
  }
  if(c.move === 'swim' && inWater(c) && R < .15){ c.happy = 2 + Math.floor(Math.random() * 2); c.tx = c.x; c.ty = c.y; return true; }   // a splash about
  return false;
}
/* where a creature in a mode wants to go next; false ends the mode */
function modeTarget(c, w){
  if(c.mode === 'fetch'){
    const b = w.toys.ball;
    if(!b || w.t > c.until || (b.holder && b.holder !== c)){ if(b && b.holder && b.holder !== c) say(c, '…', .9); return false; }
    if(b.holder === c){
      if(Math.hypot(c.tx - c.x, c.ty - c.y) < 3){ w.toys.drop(c); return false; }   // dropped it: at your feet if it's a good friend
      return true;
    }
    if(!b.hops.length && Math.hypot(b.x - c.x, b.y - c.y) < 7){ w.toys.pickUp(c); return true; }
    [c.tx, c.ty] = reachable(c, b.x, b.y); return true;
  }
  if(c.mode === 'treat'){
    const tr = c.treat;
    if(!tr || tr.eaten || w.t > c.until){ if(tr && tr.eaten && tr.by !== c) say(c, '…', .9); return false; }
    if(!tr.falling && Math.hypot(tr.x - c.x, tr.y - c.y) < 6){ w.toys.eat(c, tr); return false; }
    [c.tx, c.ty] = reachable(c, tr.x, tr.y); return true;
  }
  if(c.mode === 'follow'){   // a good friend trots after your finger for a few seconds after a pet
    if(w.t > c.until || !pointer) return false;
    [c.tx, c.ty] = reachable(c, pointer.x, pointer.y + 6); return true;
  }
  if(c.mode === 'chase'){
    if(w.t > c.until) return false;
    const b = w.butterflies.map(([x, y]) => ({x, y: y + 8})).sort((a, b2) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b2.x - c.x, b2.y - c.y))[0];
    [c.tx, c.ty] = reachable(c, b.x, b.y); return true;
  }
  if(c.mode === 'tag'){
    const g = c.tag, o = g.other;
    if(w.t > g.until || o.mode !== 'tag' || g.rounds >= 4){ endMode(c); c.happy = 2; c.tx = c.x; c.ty = c.y; return true; }
    if(g.it){
      if(Math.hypot(o.x - c.x, o.y - c.y) < 9){   // tagged: now the other one is it
        g.it = false; g.rounds++; o.tag.it = true; o.tag.rounds = g.rounds; say(o, '!', .9);
        c.tx = c.x; c.ty = c.y; return true;
      }
      [c.tx, c.ty] = reachable(c, o.x, o.y); return true;
    }
    const dx = c.x - o.x || 1, dy = c.y - o.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + (Math.random() - .5) * 1.6;
    [c.tx, c.ty] = reachable(c, c.x + Math.cos(a) * 30, c.y + Math.sin(a) * 18);
    if(Math.hypot(c.tx - c.x, c.ty - c.y) < 4) [c.tx, c.ty] = reachable(c, c.x - dy / d * 30, c.y + dx / d * 18);   // cornered: dodge sideways
    return true;
  }
  return false;
}
function stepCreature(c, dt, w){
  if(c.bubble && (c.bubble.life -= dt) <= 0) c.bubble = null;
  switch(c.st){
    case 'idle':
      c.timer -= dt;
      if(c.mode === 'nap' && c.nap){   // asleep: a "z" now and then
        c.nap -= dt; if(!c.bubble && Math.random() < dt * .7) say(c, 'z', 1.6);
        if(c.nap <= 0){ c.mode = null; c.nap = 0; c.timer = .5; }
        break;
      }
      if(c.timer > 0) break;
      if(c.called) nextHop(c);
      else if(c.mode === 'nap'){ if(Math.hypot(c.tx - c.x, c.ty - c.y) < 2){ c.nap = (10 + Math.random() * 12) * (1 + 1.5 * w.night); say(c, 'z', 1.6); } else nextHop(c); }
      else if(c.mode){ if(modeTarget(c, w)) nextHop(c); else { c.mode = null; c.timer = 1; } }
      else if(!c.sel && startSomething(c, w)) nextHop(c);
      else if(!c.sel && Math.random() < (.45 + .45 * c.p.energy) * (1 - .5 * w.night) && pickTarget(c, w.mobs)) nextHop(c);
      else c.timer = (1 + Math.random() * 3) * c.gait.rest * c.restK * (1 + w.night);   // fewer hops after dark
      break;
    case 'crouch': c.timer -= dt; if(c.timer <= 0){ c.st = 'air'; c.timer = 0; } break;
    case 'air': {
      c.timer += dt; const p = Math.min(1, c.timer / c.hop.dur), h = c.hop;
      c.x = h.fx + (h.tx - h.fx) * p; c.y = h.fy + (h.ty - h.fy) * p; c.lift = Math.round(h.h * 4 * p * (1 - p));
      if(p >= 1){ c.lift = 0; c.st = 'land'; c.timer = .1 * c.gait.pause; if(c.happy) c.happy--; if(inWater(c)) w.fx.splash(c.x, c.y - 3); }
      break;
    }
    case 'land':
      c.timer -= dt;
      if(c.timer > 0) break;
      if(c.happy) nextHop(c); else if(c.sel){ c.st = 'idle'; c.timer = 1; }
      else if(c.wait){ c.st = 'idle'; c.timer = c.wait; c.wait = 0; }   // heard a call mid-hop: it takes a moment to turn round
      else if(c.mode && c.mode !== 'nap'){ if(modeTarget(c, w)) nextHop(c); else { c.mode = null; nextHop(c); } }
      else nextHop(c);
      break;
    case 'glide': {
      claimSpot(c, Math.hypot(c.tx - c.x, c.ty - c.y));
      if(c.mode && c.mode !== 'nap' && !c.called) modeTarget(c, w);
      const dx = c.tx - c.x, dy = c.ty - c.y, dist = Math.hypot(dx, dy), v = c.drift * (c.called || c.mode === 'tag' ? 2 : 1) * dt;
      if(dist <= v || c.sel){ c.st = 'idle'; c.timer = c.called ? 3 + Math.random() * 3 : c.mode ? .2 : (1 + Math.random() * 3) * c.restK; c.called = false; break; }
      c.x += dx / dist * v; c.y += dy / dist * v;
      break;
    }
  }
}
function liftOf(c, t){
  let l = c.lift;
  if(c.floater) l += 3 + Math.round(Math.sin(t * 2.2 + c.ph) * 1.2);
  else if((c.st === 'idle' && !c.nap) || c.st === 'glide') l += Math.floor(t / .55 + c.ph) % 2;   // asleep: no bob   // the same 1-pixel bob as the hatch stage
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
const inWaterAt = (x, y) => { x = Math.round(x); y = Math.round(y); return y >= 0 && y < H && x >= 0 && x < W && !!isWater[y * W + x]; };
/* a little red-and-white ball, with its shadow on the ground while it's loose */
const BALL = ['rgb(222,60,64)', 'rgb(255,246,240)', 'rgb(150,30,40)'];
function drawBall(ctx, x, y, z, shadow){
  x = Math.round(x); y = Math.round(y); const top = y - 3 - Math.round(z);
  if(shadow){ ctx.fillStyle = SHADOW; ctx.fillRect(x - 1, y, 3, 1); }
  ctx.fillStyle = BALL[0]; ctx.fillRect(x - 1, top, 3, 3); ctx.fillRect(x - 2, top + 1, 5, 1);
  ctx.fillStyle = BALL[1]; ctx.fillRect(x - 1, top + 1, 3, 1);
  ctx.fillStyle = BALL[2]; ctx.fillRect(x + 1, top + 2, 1, 1);
}
/* a treat: a little golden biscuit */
function drawTreat(ctx, tr){
  const x = Math.round(tr.x), y = Math.round(tr.y), top = y - 2 - Math.round(tr.z);
  if(!tr.falling || tr.z < 8){ ctx.fillStyle = SHADOW; ctx.fillRect(x - 1, y, 3, 1); }
  ctx.fillStyle = 'rgb(214,150,60)'; ctx.fillRect(x - 1, top, 3, 2); ctx.fillStyle = 'rgb(246,204,112)'; ctx.fillRect(x - 1, top, 2, 1); ctx.fillStyle = 'rgb(150,90,36)'; ctx.fillRect(x + 1, top + 1, 1, 1);
}
/* speech bubbles: tiny pixel glyphs over a creature's head */
const GLYPHS = {'♥': ['01010', '11111', '11111', '01110', '00100'], '?': ['111', '001', '011', '000', '010'], '!': ['010', '010', '010', '000', '010'], '…': ['00000', '00000', '00000', '00000', '10101'], 'z': ['111', '001', '010', '100', '111']};
function drawBubble(ctx, c, t){
  const b = c.bubble, G = GLYPHS[b.k], w = G[0].length, rise = b.k === 'z' ? Math.round((1.6 - b.life) * 4) : 0;
  const x0 = Math.round(c.x) + (b.k === 'z' ? 3 : -Math.floor(w / 2)), y0 = Math.round(c.y) - FOOT - liftOf(c, t) + c.spr.y0 - 8 - rise;
  ctx.globalAlpha = Math.min(1, b.life * 3);
  const dot = (dx, dy) => G.forEach((row, y) => { for(let x = 0; x < w; x++) if(row[x] === '1') ctx.fillRect(x0 + x + dx, y0 + y + dy, 1, 1); });
  if(b.k === 'z'){   // sleep: a plain white z, with a faint shadow so it still reads against a pale sky
    ctx.fillStyle = 'rgba(20,24,48,.35)'; dot(1, 1);
    ctx.fillStyle = 'rgb(255,255,255)'; dot(0, 0);
  } else {
    ctx.fillStyle = 'rgba(255,253,240,.92)'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 7);
    ctx.fillStyle = b.k === '♥' ? 'rgb(214,52,84)' : 'rgb(40,36,48)'; dot(0, 0);
  }
  ctx.globalAlpha = 1;
}
/* a little face for the jump-to row: the sprite's top half, cropped to its outline */
function faceOf(c){
  const S = c.spr, w = S.x1 - S.x0 + 1, h = Math.min(S.y1 - S.y0 + 1, Math.max(10, Math.ceil(w * .9)));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(S.cv, S.x0, S.y0, w, h, 0, 0, w, h);
  return cv;
}

/* ---------- the view ---------- */
function create({canvas, label, faces, toys: tray, onOpen}){
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

  /* the light follows this device's clock; ?hour=21 (or setHour) previews any time of day */
  const fixed = Number.parseFloat(new URLSearchParams(location.search).get('hour'));
  let hourSet = Number.isFinite(fixed) ? fixed : null, lt = null, ltAt = -1e9;
  const hourNow = () => { if(hourSet !== null) return hourSet; const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  const light = () => { if(!lt || t - ltAt > 30){ lt = S.lightAt(hourNow()); ltAt = t; } return lt; };
  let O = null, M = null;   // offscreen layers for the colour grade
  function graded(){
    if(!O || O.width !== VW){ O = document.createElement('canvas'); M = document.createElement('canvas'); O.width = M.width = VW; O.height = M.height = H; }
    return O.getContext('2d');
  }
  function frame(){
    const x0 = Math.round(camX), x1 = x0 + VW, L = light();
    ctx.setTransform(1, 0, 0, 1, -x0, 0);
    ctx.imageSmoothingEnabled = false;
    S.drawSky(ctx, t, L);
    // everything under the sky is drawn into its own layer when there's a colour grade, so the light can tint it
    const g = L.graded ? graded() : ctx;
    if(g !== ctx){ g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, VW, H); g.setTransform(1, 0, 0, 1, -x0, 0); g.imageSmoothingEnabled = false; }
    S.drawLand(g, t, L);
    S.drawWater(g, t, x0, x1);
    const items = [];
    for(const p of PROPS) if(p.x > x0 - 8 && p.x < x1 + 8) items.push(p);
    for(const c of mobs) if(c.x + F / 2 > x0 && c.x - F / 2 < x1) items.push({y: c.y + .5, c});
    if(ball && !ball.holder) items.push({y: ball.y + .4, draw: () => drawBall(g, ball.x, ball.y, ball.z, true)});
    for(const tr of treatsOut) items.push({y: tr.y + .3, draw: () => drawTreat(g, tr)});
    items.sort((a, b) => a.y - b.y);
    for(const it of items){ if(it.c){ drawCreature(g, it.c, t); if(ball && ball.holder === it.c) drawBall(g, it.c.x, it.c.y - 3, liftOf(it.c, t) + 2, false); } else it.draw(g, t); }
    fx.draw(g); S.drawButterflies(g, t, L);
    if(g !== ctx){   // multiply by the light, keep the layer's own shape, then lay it over the sky
      g.setTransform(1, 0, 0, 1, 0, 0);
      const m = M.getContext('2d'); m.globalCompositeOperation = 'copy'; m.drawImage(O, 0, 0);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${L.tint})`; g.fillRect(0, 0, VW, H);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(M, 0, 0);
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(O, x0, 0);
    }
    S.drawMoonlight(ctx, t, L, x0, x1); S.drawFireflies(ctx, t, L, x0, x1);
    for(const c of mobs) if(c.bubble && c.x + F / 2 > x0 && c.x - F / 2 < x1) drawBubble(ctx, c, t);
    if(sel) placeLabel();
  }
  function tick(now){
    raf = requestAnimationFrame(tick);
    const dt = Math.min(.1, (now - last) / 1000 || 0);
    if(dt < 1 / 32) return;   // ~30 fps is plenty for pixel art
    last = now; t += dt;
    if(goal !== null){ const d = goal - camX; if(Math.abs(d) < .5){ setCam(goal); goal = null; } else setCam(camX + d * Math.min(1, dt * 6)); }
    else if(!drag && Math.abs(vel) > 2){ setCam(camX + vel * dt); vel *= Math.pow(.03, dt); if(camX <= 0 || camX >= W - VW) vel = 0; }
    clock = t;
    stepToys(dt);
    const night = light().night;
    const w = {fx, mobs, t, night, butterflies: night > .5 ? S.fireflies(t) : S.butterflies(t), toys};   // after dark, playful ones chase fireflies instead
    for(const c of mobs) stepCreature(c, dt, w);
    for(const c of mobs) if(c.x > camX && c.x < camX + VW && (c.watched = (c.watched || 0) + dt * (night > .5 && !c.nap ? 2 : 1)) >= 60){   // a minute of watching it (half that for a night owl)
      c.watched = 0; const r = Bond.add(c.g, 'watch'); if(r.levelUp) cheer(c, r);
    }
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
    c.sel = true; endMode(c);
    if(!still && (c.st === 'idle' || c.st === 'glide')){ c.happy = 2; c.tx = c.x; c.ty = c.y; c.lift = 0; nextHop(c); }
    const R = RARITY[c.t.rarity];
    label.innerHTML = `<div><b></b><span class="r-${c.t.rarity}">${R.label}</span></div>
      <div><i></i><span class="hearts"></span><button type="button" class="pet">Pet</button><button type="button" class="view">View</button></div>`;
    label.querySelector('b').textContent = c.t.name; label.querySelector('i').textContent = c.p.word;
    showHearts(c);
    label.querySelector('.view').addEventListener('click', e => { e.stopPropagation(); onOpen(c.g); });
    label.querySelector('.pet').addEventListener('click', e => { e.stopPropagation(); pet(c); });
    label.hidden = false; placeLabel();
    if(still) frame();
  }
  function showHearts(c){
    const h = Bond.hearts(c.g), el = label.querySelector('.hearts');
    if(!el) return;
    el.textContent = Bond.heartText(h); el.setAttribute('aria-label', `${h} of 5 hearts`); el.title = h === Bond.BEST ? 'Best friends' : `${h} of 5 hearts`;
  }
  /* a pet: hearts float up, it does a happy hop, and good friends follow you around for a moment */
  function pet(c){
    const r = Bond.add(c.g, 'pet');
    if(!r.cooling && c.arrived && t - c.arrived < 15){ const b = Bond.add(c.g, 'came'); r.gained += b.gained; r.levelUp = r.levelUp || b.levelUp; r.hearts = b.hearts; c.arrived = 0; }
    const top = Math.round(c.y) - FOOT - liftOf(c, t) + c.spr.y0;
    fx.hearts(c.x, top, r.cooling || !r.gained ? 1 : 3);
    if(c.mode === 'nap') say(c, '!', .8);
    endMode(c);
    if(!still && (c.st === 'idle' || c.st === 'glide')){ c.happy = 2; c.tx = c.x; c.ty = c.y; c.lift = 0; nextHop(c); }
    if(r.levelUp) cheer(c, r);
    if(!r.cooling && Math.random() < .35 && Bond.gift(c.g)){ Bond.giveTreat(); say(c, '♥', 2); toast(`${c.t.name} brought you a treat.`); updateToys(); }   // a 3-heart friend's gift
    if(r.hearts >= 2 && !r.cooling && !still){ c.mode = 'follow'; c.until = t + 5; }
    if(c === sel) showHearts(c);
    if(still) frame();
  }
  function cheer(c, r){
    say(c, '♥', 2.2); fx.hearts(c.x, Math.round(c.y) - FOOT + c.spr.y0, 7);
    if(c === sel) showHearts(c);
  }
  /* opening the pasture: good friends say hello, and ones you haven't seen in a week are extra happy */
  function greet(){
    const now = Date.now();
    for(const c of mobs){
      const prev = Bond.seen(c.g, now), onScreen = c.x > camX && c.x < camX + VW;
      if(still || !onScreen) continue;
      const missed = prev && now - prev > 7 * 864e5, friend = Bond.hearts(c.g) >= 4 && (!prev || now - prev > 30 * 6e4);
      if(missed || friend){ endMode(c); c.happy = missed ? 4 : 2; c.tx = c.x; c.ty = c.y; c.st = 'idle'; c.timer = Math.random() * .6; say(c, '♥', 2); }
    }
  }
  /* ---------- toys: a ball to throw and treats to drop ---------- */
  let ball = null, armed = null, toastTimer = 0;
  const treatsOut = [];
  const toastEl = document.createElement('div'); toastEl.className = 'ptoast'; toastEl.hidden = true; toastEl.setAttribute('role', 'status'); box.appendChild(toastEl);
  function toast(msg){ toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600); }
  const toys = {
    get ball(){ return ball; },
    pickUp(c){
      ball.holder = c; say(c, '!', .7);
      const r = Bond.add(c.g, 'play'); if(r.levelUp) cheer(c, r);
      for(const o of mobs) if(o !== c && o.mode === 'fetch'){ o.mode = null; say(o, '…', .9); }
      if(Bond.hearts(c.g) >= 4) [c.tx, c.ty] = reachable(c, ball.home.x, ball.home.y);   // a good friend brings it back
      else { const a = Math.random() * Math.PI * 2; [c.tx, c.ty] = reachable(c, c.x + Math.cos(a) * 40, c.y + Math.sin(a) * 24); }   // the rest run off with it for a bit
    },
    drop(c){
      const back = Bond.hearts(c.g) >= 4;
      ball.holder = null; ball.x = c.x + 4; ball.y = c.y + 1; ball.z = 0;
      if(back){ fx.hearts(c.x, Math.round(c.y) - FOOT + c.spr.y0, 3); say(c, '♥', 1.6); }
      c.happy = back ? 2 : 0; c.tx = c.x; c.ty = c.y;
    },
    eat(c, tr){
      tr.eaten = true; tr.by = c; treatsOut.splice(treatsOut.indexOf(tr), 1);
      let r = Bond.add(c.g, 'treat'); if(c.p.boldness < .35){ const r2 = Bond.add(c.g, 'treat'); r = {...r2, levelUp: r.levelUp || r2.levelUp}; }   // shy ones warm up fastest with treats
      fx.hearts(c.x, Math.round(c.y) - FOOT + c.spr.y0, 3); say(c, '♥', 1.4);
      if(r.levelUp) cheer(c, r);
      c.happy = 2; c.tx = c.x; c.ty = c.y;
    },
  };
  /* throw the ball from the bottom of the view to the tapped spot; it bounces twice and rolls to a stop */
  function throwBall(x, y){
    const fx0 = camX + VW / 2, fy0 = H - 2, d = Math.hypot(x - fx0, (y - fy0) * 1.4), ux = (x - fx0) / (d || 1), uy = (y - fy0) / (d || 1);
    const hops = [{fx: fx0, fy: fy0, tx: x, ty: y, dur: .45 + d / 260, h: 12 + d * .12}];
    for(const k of [.22, .08]){ const p = hops[hops.length - 1], s = d * k; hops.push({fx: p.tx, fy: p.ty, tx: p.tx + ux * s, ty: clamp(p.ty + uy * s * .6, Y0, H - 3), dur: .2 + k, h: p.h * .3}); }
    if(ball && ball.holder){ const h = ball.holder; h.mode = null; }
    ball = {x: fx0, y: fy0, z: 0, hops, t: 0, holder: null, home: {x: fx0, y: H - 8}, landed: false};
    for(const c of mobs) if(c.mode === 'fetch') c.mode = null;
  }
  function dropTreat(x, y){
    if(!Bond.useTreat()){ toast('No treats left. Scan barcodes to earn more.'); armed = null; updateToys(); return; }
    const tr = {x, y, z: 18, falling: true};
    treatsOut.push(tr); updateToys();
  }
  function stepToys(dt){
    if(ball && !ball.holder && ball.hops.length){
      const h = ball.hops[0]; ball.t += dt;
      const p = Math.min(1, ball.t / h.dur);
      ball.x = h.fx + (h.tx - h.fx) * p; ball.y = h.fy + (h.ty - h.fy) * p; ball.z = h.h * 4 * p * (1 - p);
      if(p >= 1){
        ball.hops.shift(); ball.t = 0; ball.z = 0;
        if(inWaterAt(ball.x, ball.y)) fx.splash(ball.x, ball.y - 2);
        if(!ball.landed){ ball.landed = true; noticeBall(); }
      }
    }
    if(ball && !ball.holder && !ball.hops.length && inWaterAt(ball.x, ball.y)){   // it floats off down the stream
      ball.y += 6 * dt; ball.x += (sCx(ball.y) - ball.x) * dt;
      if(ball.y > H + 4) ball = null;
    }
    for(const tr of treatsOut) if(tr.falling){ tr.z -= 60 * dt; if(tr.z <= 0){ tr.z = 0; tr.falling = false; noticeTreat(tr); } }
  }
  /* who goes for it: playful ones chase the ball; bold and hungry ones go for a treat */
  function noticeBall(){
    for(const c of mobs){
      if(c.sel || c.called || (c.mode === 'nap' && c.nap)) continue;
      const d = Math.hypot(c.x - ball.x, (c.y - ball.y) / .6);
      if(d > 160 || Math.random() > .25 + .65 * c.p.playfulness + .08 * Bond.hearts(c.g)) continue;
      endMode(c); c.mode = 'fetch'; c.until = t + 10; c.wait = (.1 + Math.random() * .5) * c.gait.react;
      say(c, '!', .8); if(c.st === 'idle'){ c.timer = c.wait; c.wait = 0; }
    }
  }
  function noticeTreat(tr){
    for(const c of mobs){
      if(c.sel || c.called || (c.mode === 'nap' && c.nap) || c.mode === 'treat') continue;
      const d = Math.hypot(c.x - tr.x, (c.y - tr.y) / .6);
      if(d > 130 || Math.random() > .35 + .45 * c.p.boldness + .08 * Bond.hearts(c.g)) continue;
      endMode(c); c.mode = 'treat'; c.treat = tr; c.until = t + 12; c.wait = (.2 + Math.random() * .6 + (1 - c.p.boldness)) * c.gait.react;
      if(c.st === 'idle'){ c.timer = c.wait; c.wait = 0; }
    }
  }
  /* the toy tray under the pasture: pick a toy, then tap the grass to use it */
  function updateToys(){
    if(!tray) return;
    tray.hidden = still || !mobs.length;
    for(const b of tray.querySelectorAll('button')) b.setAttribute('aria-pressed', String(armed === b.dataset.toy));
    const n = tray.querySelector('[data-toy="treat"] span'); if(n) n.textContent = Bond.treats();
    box.classList.toggle('armed', !!armed);
  }
  if(tray){
    tray.innerHTML = '<button type="button" data-toy="ball"><i class="ico ball"></i>Ball</button><button type="button" data-toy="treat"><i class="ico treat"></i>Treat <span></span></button>';
    tray.addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      armed = armed === b.dataset.toy ? null : b.dataset.toy;
      if(armed === 'treat' && Bond.treats() < 1){ toast('No treats left. Scan barcodes to earn more.'); armed = null; }
      else if(armed) toast(armed === 'ball' ? 'Tap the grass to throw the ball.' : 'Tap the grass to drop a treat.');
      select(null); updateToys();
    });
  }
  function lookAt(c){
    const x = clamp(c.x - VW / 2, 0, W - VW);
    vel = 0;
    if(still){ setCam(x); frame(); } else goal = x;
  }

  /* drag sideways to look around; a tap that doesn't move still calls creatures or picks one */
  let drag = null, dragged = false, hold = null;
  const toScene = e => { const r = canvas.getBoundingClientRect(); return {x: Math.round(camX) + (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * H}; };
  function hitAt({x: px, y: py}){
    return mobs.slice().sort((a, b) => b.y - a.y).find(c => {
      const lx = px - (Math.round(c.x) - Math.round(CXS + .5)), ly = py - (Math.round(c.y) - FOOT - liftOf(c, t));
      return lx >= c.spr.x0 - 2 && lx <= c.spr.x1 + 3 && ly >= c.spr.y0 - 2 && ly <= c.spr.y1 + 3;
    });
  }
  const cancelHold = () => { if(hold){ clearTimeout(hold.timer); hold = null; } };
  canvas.addEventListener('pointerdown', e => {
    dragged = false; cancelHold();
    pointer = toScene(e);
    const c = (e.pointerType !== 'mouse' || e.button === 0) && hitAt(pointer);
    if(c) hold = {id: e.pointerId, x: e.clientX, y: e.clientY, timer: setTimeout(() => { hold = null; dragged = true; pet(c); }, 550)};   // press and hold to pet
    if(!pannable() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = {id: e.pointerId, x: e.clientX, cam: camX, moved: false, lx: e.clientX, lt: e.timeStamp};
    vel = 0; goal = null;
  });
  canvas.addEventListener('pointermove', e => {
    pointer = toScene(e);
    if(hold && e.pointerId === hold.id && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 6) cancelHold();
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
    if(hold && e.pointerId === hold.id) cancelHold();
    if(!drag || e.pointerId !== drag.id) return;
    dragged = drag.moved;
    if(e.timeStamp - drag.lt > 80 || still) vel = 0;   // let go after holding still: no fling
    drag = null; box.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('contextmenu', e => e.preventDefault());   // a long press is a pet, not a menu
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
    const {x: px, y: py} = toScene(e), hit = hitAt({x: px, y: py});
    if(armed && !still){ select(null); if(armed === 'ball') throwBall(px, clamp(py, Y0, H - 3)); else { dropTreat(px, clamp(py, Y0, H - 3)); if(Bond.treats() < 1){ armed = null; updateToys(); } } return; }   // holding a toy: every tap uses it
    if(hit){ select(hit !== sel ? hit : null); return; }
    const hadSel = !!sel; select(null);
    if(still || hadSel) return;   // the first tap off a creature just closes its label
    call(mobs, px, py, t); fx.ping(Math.round(px), Math.round(py));
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
      fit(); updateToys();
      if(!placed) centreOnHerd();
      frame();
    },
    start(){ fit(); if(!placed) centreOnHerd(); if(still){ frame(); return; } if(!raf){ greet(); last = performance.now(); raf = requestAnimationFrame(tick); } },
    setHour(h){ hourSet = h ?? null; lt = null; frame(); },   // null goes back to the clock
    stop(){ if(raf) cancelAnimationFrame(raf); raf = 0; vel = 0; goal = null; select(null); },
  };
}

window.Pasture = {create, W, H};
})();
