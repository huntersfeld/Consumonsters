/* Consumonsters app: scanning, hatching and the collection. The creature rules live in engine.js. */
(() => {
'use strict';
const {normalize, roll, RARITY, SIZES, DOMAINS, lab, upcOf} = window.CM;
const $ = s => document.querySelector(s);
const FAMILIES = true;
const STORE = 'consumonsters.collection.v1';
const SAMPLE = '036000291452';
const fmtUPC = g => {const u=upcOf(g); return u.length===12 ? `${u[0]} ${u.slice(1,6)} ${u.slice(6,11)} ${u[11]}` : u;};
const RANK = Object.keys(RARITY);

/* collection: {gtin: {first, last, count}} kept in this browser */
let col = {};
try{ col = JSON.parse(localStorage.getItem(STORE)) || {}; }catch{ col = {}; }
const saveCol = () => { try{ localStorage.setItem(STORE, JSON.stringify(col)); }catch{} };
const cache = new Map();
const creature = g => { if(!cache.has(g)) cache.set(g, roll(g, {families:FAMILIES})); return cache.get(g); };
const Hats = window.CMHats, Rewards = window.CMRewards;
Rewards.setSource(() => Object.keys(col).map(g => ({g, t: creature(g)})));

/* ---------- barcode decoding ---------- */
function upceToUpca(s){
  const d = s.slice(1,7), last = d[5]; let m;
  if('012'.includes(last)) m = d[0]+d[1]+last+'0000'+d[2]+d[3]+d[4];
  else if(last==='3') m = d[0]+d[1]+d[2]+'00000'+d[3]+d[4];
  else if(last==='4') m = d[0]+d[1]+d[2]+d[3]+'00000'+d[4];
  else m = d[0]+d[1]+d[2]+d[3]+d[4]+'0000'+last;
  return s[0] + m + s[7];
}
const fromScan = (text, format) => /upc_?e/i.test(format||'') && text.length===8 ? upceToUpca(text) : text;

let detector;
async function getDetector(){
  if(detector !== undefined) return detector;
  detector = null;
  try{
    if('BarcodeDetector' in window){
      const have = await BarcodeDetector.getSupportedFormats();
      const want = ['ean_13','ean_8','upc_a','upc_e'].filter(f => have.includes(f));
      if(want.length) detector = new BarcodeDetector({formats: want});
    }
  }catch{ detector = null; }
  return detector;
}
let zxReader = null, zxHints = null;
function zxDecode(cv){
  const Z = window.ZXing; if(!Z) return null;
  if(!zxReader){
    zxHints = new Map();
    zxHints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
    zxHints.set(Z.DecodeHintType.TRY_HARDER, true);
    zxReader = new Z.MultiFormatReader();
  }
  try{
    const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)));
    const r = zxReader.decode(bmp, zxHints);
    return {text: r.getText(), format: Z.BarcodeFormat[r.getBarcodeFormat()]};
  }catch{ return null; }
}
async function decodeCanvas(cv){
  const det = await getDetector();
  if(det){ try{ const out = await det.detect(cv); if(out.length) return {text: out[0].rawValue, format: out[0].format}; }catch{} }
  return zxDecode(cv);
}
function drawTo(src, w, h, {rotate=false, crop=null} = {}){
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d', {willReadFrequently:true});
  const [sx,sy,sw,sh] = crop || [0,0,w,h];
  const k = Math.min(1, 1400/Math.max(sw,sh)), dw = Math.round(sw*k), dh = Math.round(sh*k);
  if(rotate){ cv.width=dh; cv.height=dw; ctx.translate(dh,0); ctx.rotate(Math.PI/2); }
  else { cv.width=dw; cv.height=dh; }
  ctx.drawImage(src, sx,sy,sw,sh, 0,0,dw,dh);
  return cv;
}
async function decodeImageFile(file){
  const img = await createImageBitmap(file);
  const w = img.width, h = img.height;
  const tries = [{}, {rotate:true}, {crop:[w*.1,h*.25,w*.8,h*.5]}, {crop:[w*.25,h*.1,w*.5,h*.8], rotate:true}];
  for(const o of tries){ const r = await decodeCanvas(drawTo(img, w, h, o)); if(r) return r; }
  return null;
}

/* ---------- live camera ---------- */
let camStream = null, scanning = false;
async function openCamera(){
  if(!navigator.mediaDevices?.getUserMedia) return false;
  try{
    camStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720}}, audio:false});
  }catch{ return false; }
  const v = $('#video'); v.srcObject = camStream; $('#cam').hidden = false; $('#cam-msg').textContent = 'Line the barcode up inside the box.';
  try{ await v.play(); }catch{}
  scanning = true; loop();
  return true;
}
function closeCamera(){
  scanning = false; $('#cam').hidden = true;
  if(camStream){ camStream.getTracks().forEach(t => t.stop()); camStream = null; }
}
async function loop(){
  const v = $('#video');
  while(scanning){
    if(v.readyState >= 2 && v.videoWidth){
      const w = v.videoWidth, h = v.videoHeight;
      const r = await decodeCanvas(drawTo(v, w, h, {crop:[w*.05, h*.3, w*.9, h*.4]})) || await decodeCanvas(drawTo(v, w, h));
      if(r && scanning){
        const code = fromScan(r.text, r.format), nm = normalize(code);
        if(!nm.error){ closeCamera(); if(navigator.vibrate) try{ navigator.vibrate(60); }catch{} hatch(code); return; }
        $('#cam-msg').textContent = 'Got a partial read. Hold steady.';
      }
    }
    await new Promise(res => setTimeout(res, 180));
  }
}

/* ---------- views ---------- */
const status = (msg, kind='') => { const s=$('#status'); s.textContent = msg; s.className = 'status ' + kind; };
let current = null;

function tagHTML(t, entry){
  const D = DOMAINS[t.domain], R = RARITY[t.rarity];
  const from = s => t.donated.includes(s) ? ` <span class="fact hot">from ${DOMAINS[t.donor].label}</span>` : '';
  const pal = [t.pal.prismName, t.shiny ? 'Shiny' : null].filter(Boolean).join(', ');
  const facts = [
    `${D.label}${t.element ? ' · ' + lab(t.element) : ''}`,
    SIZES[t.size].label,
    window.CMTemper.temperament(t.gtin, t.domain).word,
    entry ? `<span class="hearts" title="Friendship">${window.CMBond.heartText(window.CMBond.hearts(t.gtin))}</span>` : null,
    entry && window.CMBond.hearts(t.gtin) === window.CMBond.BEST ? '<span class="hot">Best friend</span>' : null,
    entry && Rewards.worn(t.gtin) ? `Wearing a ${Hats.HATS[Rewards.worn(t.gtin)].name.toLowerCase()}` : null,
    t.famHit ? 'Brand family' : null,
    t.donor ? `<span class="hot">+ ${DOMAINS[t.donor].label} parts</span>` : null,
    pal ? `<span class="hot">${pal}</span>` : null,
  ].filter(Boolean).map(f => `<span class="fact">${f}</span>`).join('');
  const seen = entry ? `<span>Caught ${new Date(entry.first).toLocaleDateString()}</span><span>Scanned ${entry.count}×</span>` : '<span>Example creature</span>';
  return `<div class="tag-head"><div><p class="eyebrow">Specimen</p><h2 class="cname">${t.name}</h2></div><span class="rarity r-${t.rarity}">${R.label}</span></div>
  <div class="facts">${facts}</div>
  <details class="traits"><summary>All traits</summary><dl>
    <dt>Body</dt><dd>${lab(t.plan)}, ${lab(t.body).toLowerCase()}${t.plan==='headed'?`, ${lab(t.head).toLowerCase()} head`:''}</dd>
    <dt>Top</dt><dd>${lab(t.topper)}${from('topper')}</dd>
    <dt>Sides</dt><dd>${lab(t.sides)}${from('sides')}</dd>
    <dt>Feet</dt><dd>${lab(t.feet)}${from('feet')}</dd>
    <dt>Tail</dt><dd>${lab(t.tail)}${from('tail')}</dd>
    <dt>Face</dt><dd>${lab(t.eyes)} eyes${from('eyes')}, ${lab(t.mouth).toLowerCase()} mouth</dd>
    <dt>Back</dt><dd>${lab(t.back)}${from('back')}</dd>
    <dt>Marks</dt><dd>${lab(t.cheeks)}${from('cheeks')}</dd>
    <dt>Pattern</dt><dd>${lab(t.pattern)}${from('pattern')}</dd>
  </dl></details>
  <div class="meta"><span>${fmtUPC(t.gtin)}</span>${seen}</div>`;
}

function show(gtin, {badge=null, animate=false} = {}){
  const t = creature(gtin); current = gtin;
  Hats.renderWith($('#hero'), t, col[gtin] && Rewards.worn(gtin), 10);
  $('#hero').setAttribute('aria-label', `${t.name}, a ${RARITY[t.rarity].label} ${SIZES[t.size].label} ${DOMAINS[t.domain].label}`);
  $('#tag').innerHTML = tagHTML(t, col[gtin]);
  const b = $('#badge');
  if(badge){ b.hidden = false; b.textContent = badge.text; b.className = 'badge ' + (badge.cls||''); } else b.hidden = true;
  if(animate){
    const st = $('#stage'), l = $('#laser'), f = $('#flash');
    st.classList.remove('pop'); l.classList.remove('go'); f.classList.remove('go'); void st.offsetWidth;
    st.classList.add('pop'); l.classList.add('go');
    if(RANK.indexOf(t.rarity) >= RANK.indexOf('epic')){ f.className = 'flash bg-' + t.rarity; void f.offsetWidth; f.classList.add('go'); }
  }
}

function hatch(raw){
  const nm = normalize(raw);
  if(nm.error){ status(nm.error, 'err'); return; }
  status('');
  const g = nm.gtin, now = Date.now(), isNew = !col[g];
  col[g] = isNew ? {first: now, last: now, count: 1} : {...col[g], last: now, count: col[g].count + 1};
  saveCol(); updateCount();
  const t = creature(g);
  const bond = isNew ? null : window.CMBond.add(g, 'scan');
  show(g, {badge: isNew ? {text: 'New!'} : {text: `Caught before · ${col[g].count}×`, cls: 'dupe'}, animate: true});
  if(isNew && RANK.indexOf(t.rarity) >= RANK.indexOf('rare')) { const r = RARITY[t.rarity].label.toLowerCase(); status(`${/^[aeiou]/.test(r) ? 'An' : 'A'} ${r} find.`); }
  const treats = window.CMBond.earnTreats(g, isNew), got = treats ? ` +${treats} treat${treats > 1 ? 's' : ''} for the pasture.` : '';
  if(bond && bond.gained) status(`${t.name} recognizes you.${bond.levelUp ? ' New heart!' : ''}${got}`);
  else if(got && !(isNew && RANK.indexOf(t.rarity) >= RANK.indexOf('rare'))) status(got.trim());
  const hats = Rewards.check();
  if(hats.length) status(`${$('#status').textContent} New hat${hats.length > 1 ? 's' : ''}: ${hats.map(r => Hats.HATS[r.hat].name).join(', ')}! Try ${hats.length > 1 ? 'them' : 'it'} on in the pasture.`.trim());
  $('#manual').hidden = true;
  if(location.hash !== '#scan' && location.hash) location.hash = 'scan';
  window.scrollTo({top:0, behavior:'auto'});
}

function updateCount(){
  const n = Object.keys(col).length;
  $('#count').textContent = `${n} caught`;
}

let filter = 'all';
function drawDex(){
  const entries = Object.entries(col).map(([g,e]) => ({g, e, t: creature(g)}));
  const domains = new Set(entries.map(x => x.t.domain));
  const best = entries.reduce((b,x) => Math.max(b, RANK.indexOf(x.t.rarity)), -1);
  $('#progress').innerHTML =
    `<div class="stat"><b>${entries.length}</b><span>Creatures</span></div>` +
    `<div class="stat"><b>${domains.size}/${Object.keys(DOMAINS).length}</b><span>Domains found</span></div>` +
    `<div class="stat"><b class="${best>=0?'r-'+RANK[best]:''}" style="font-size:18px;line-height:1.35">${best>=0 ? RARITY[RANK[best]].label : '—'}</b><span>Rarest</span></div>`;
  const counts = {}; entries.forEach(x => counts[x.t.rarity] = (counts[x.t.rarity]||0) + 1);
  const fl = $('#filters'); fl.replaceChildren();
  [['all', `All ${entries.length}`], ...RANK.filter(k => counts[k]).map(k => [k, `${RARITY[k].label} ${counts[k]}`])].forEach(([k, label]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(filter===k));
    b.addEventListener('click', () => { filter = k; drawDex(); }); fl.appendChild(b);
  });
  drawRewards();
  const dex = $('#dex'); dex.replaceChildren();
  if(!entries.length){
    dex.innerHTML = `<div class="empty"><h3>No creatures yet</h3><p class="muted">Every product barcode hatches one creature, and it is the same one for everyone who scans it. Grab anything from the pantry to start.</p><a class="btn" href="#scan" style="flex:0 0 auto;text-decoration:none">Scan your first barcode</a></div>`;
    return;
  }
  const list = entries.filter(x => filter==='all' || x.t.rarity===filter)
    .sort((a,b) => RANK.indexOf(b.t.rarity) - RANK.indexOf(a.t.rarity) || b.e.last - a.e.last);
  const grid = document.createElement('div'); grid.className = 'grid';
  for(const {g, e, t} of list){
    const c = document.createElement('button'); c.type = 'button'; c.className = 'cell';
    c.innerHTML = `<div class="tile"><i class="pip bg-${t.rarity}"></i>${e.count>1?`<span class="times">×${e.count}</span>`:''}</div><b>${t.name}</b><span>${RARITY[t.rarity].label} · ${DOMAINS[t.domain].label}</span>`;
    const cv = document.createElement('canvas'); cv.setAttribute('role','img'); cv.setAttribute('aria-label', t.name);
    c.querySelector('.tile').prepend(cv); Hats.renderWith(cv, t, Rewards.worn(g), 4);
    c.addEventListener('click', () => { show(g); location.hash = 'scan'; });
    grid.appendChild(c);
  }
  dex.appendChild(grid);
}

/* the rewards list: every hat, what earns it, and how close you are */
function drawRewards(){
  const el = $('#rewards'), rows = Rewards.list(), have = rows.filter(r => r.got).length;
  const fmt = ([m, d]) => new Date(2000, m - 1, d).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
  el.innerHTML = `<summary><span>Hats</span><b>${have} of ${rows.length}</b></summary>`;
  for(const group of [...new Set(rows.map(r => r.group))]){
    const sec = document.createElement('section');
    sec.innerHTML = `<h3 class="eyebrow">${group}</h3>`;
    for(const r of rows.filter(x => x.group === group)){
      const row = document.createElement('div'); row.className = 'reward' + (r.got ? '' : ' locked');
      const state = r.got ? 'Earned' : r.goal ? `${r.have}/${r.goal}` : r.season ? (r.open ? 'Now' : `${fmt(r.season[0])}–${fmt(r.season[1])}`) : '';
      row.innerHTML = `<i></i><div><b></b><span></span></div><em>${state}</em>`;
      row.querySelector('i').appendChild(Hats.icon(r.hat));
      row.querySelector('b').textContent = Hats.HATS[r.hat].name; row.querySelector('span').textContent = r.how;
      sec.appendChild(row);
    }
    el.appendChild(sec);
  }
}

/* ---------- home: the pasture ---------- */
const PASTURE_MAX = 40;
let pasture = null;
function drawHome(){
  if(!pasture) pasture = window.Pasture.create({canvas: $('#pasture'), label: $('#plabel'), faces: $('#pfaces'), toys: $('#ptoys'), onOpen: g => { show(g); location.hash = 'scan'; }});
  const all = Object.entries(col).sort((a,b) => b[1].last - a[1].last);
  pasture.setCreatures(all.slice(0, PASTURE_MAX).map(([g]) => ({g, t: creature(g)})));
  pasture.start();
  const n = all.length;
  $('#pasture-note').textContent = !n ? 'Nobody lives here yet. Scan a barcode and your creatures will move in.'
    : n > PASTURE_MAX ? `Your ${PASTURE_MAX} most recent catches are out in the meadow. Tap one to say hello.`
    : `${n} ${n === 1 ? 'creature lives' : 'creatures live'} here. Tap one to say hello.`;
}

const VIEWS = {scan: ['#view-scan', '#tab-scan'], home: ['#view-home', '#tab-home'], collection: ['#view-dex', '#tab-dex']};
function route(){
  const name = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'scan';
  for(const [k, [view, tab]] of Object.entries(VIEWS)){
    $(view).style.display = k === name ? 'flex' : 'none';
    if(k === name) $(tab).setAttribute('aria-current', 'page'); else $(tab).removeAttribute('aria-current');
  }
  if(name === 'collection') drawDex();
  if(name === 'home') drawHome(); else if(pasture) pasture.stop();
  window.scrollTo({top:0, behavior:'auto'});
}

/* ---------- wiring ---------- */
async function pickPhoto(){ $('#file').value = ''; $('#file').click(); }
$('#scan').addEventListener('click', async () => {
  status('Opening camera…', 'busy');
  const ok = await openCamera();
  if(ok){ status(''); return; }
  status('The live camera is not available here, so take a photo of the barcode instead.', 'busy');
  pickPhoto();
});
$('#photo').addEventListener('click', pickPhoto);
$('#cam-photo').addEventListener('click', () => { closeCamera(); pickPhoto(); });
$('#cam-close').addEventListener('click', closeCamera);
$('#file').addEventListener('change', async e => {
  const f = e.target.files[0]; if(!f) return;
  status('Reading barcode…', 'busy');
  try{
    const r = await decodeImageFile(f);
    if(!r){ status('No barcode found in that photo. Get closer so the bars fill most of the frame, with good light.', 'err'); return; }
    hatch(fromScan(r.text, r.format));
  }catch{ status('That image could not be opened. Try another photo.', 'err'); }
});
$('#typebtn').addEventListener('click', () => { const m = $('#manual'); m.hidden = !m.hidden; if(!m.hidden) $('#upc').focus(); });
$('#manual').addEventListener('submit', e => { e.preventDefault(); hatch($('#upc').value); });
document.addEventListener('visibilitychange', () => {
  if(document.hidden && scanning) closeCamera();
  if(!document.hidden){ Rewards.visit(); Rewards.check(); }   // back the next day: that's a visit too
  if(pasture){ if(document.hidden) pasture.stop(); else if(location.hash === '#home') pasture.start(); }
});
window.addEventListener('hashchange', route);

updateCount();
Rewards.visit(); Rewards.check();   // today's visit, and hats already earned by an existing collection
const latest = Object.entries(col).sort((a,b) => b[1].last - a[1].last)[0];
if(latest) show(latest[0]);
else show(normalize(SAMPLE).gtin, {badge: {text: 'Example · scan to start', cls: 'example'}});
route();

if('serviceWorker' in navigator && location.protocol === 'https:'){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
