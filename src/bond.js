/* Consumonsters friendship: how much each creature likes you, from 0 to 5 hearts.
   Saved in this browser under its own key, separate from the collection. Every way of earning points has a daily
   cap, so a few minutes a day is the sweet spot. Hearts never drain; a creature you haven't seen in a while is
   just extra happy to see you. */
(function(root){
'use strict';
const STORE = 'consumonsters.pasture.v1';
const LEVELS = [0, 10, 30, 60, 100, 150];   // points needed for 0..5 hearts
/* points per event, and the most each source can give one creature in a day */
const SOURCES = {
  pet: {pts: 2, cap: 8},       // press and hold (or the Pet button); 20 s cooldown per creature
  came: {pts: 2, cap: 4},      // a pet soon after it answered your call
  watch: {pts: 1, cap: 5},     // a minute on screen while you watch the pasture
  scan: {pts: 5, cap: 5},      // scanning its barcode again: it recognizes you
  play: {pts: 2, cap: 6},      // catching the ball
  treat: {pts: 4, cap: 8},     // eating a treat you dropped; shy ones count it twice
};
const START_TREATS = 5, NEW_TREATS = 3;   // treats you begin with, and get for each new creature (one more for a rescan, once a day)
const PET_COOLDOWN = 20e3;

let data;
function load(){
  if(data) return data;
  try{ data = JSON.parse(localStorage.getItem(STORE)); }catch{ data = null; }
  if(!data || data.v !== 1) data = {v: 1, bond: {}};
  if(typeof data.treats !== 'number') data.treats = START_TREATS;
  return data;
}
const save = () => { try{ localStorage.setItem(STORE, JSON.stringify(data)); }catch{} };
const today = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const heartsFor = pts => { let h = 0; while(h < 5 && pts >= LEVELS[h + 1]) h++; return h; };
function entry(g){
  const b = load().bond;
  return b[g] || (b[g] = {pts: 0, day: '', got: {}, lastPet: 0, seen: 0});
}

/* add points from one source; returns what happened so the pasture can show it */
function add(g, source, now = Date.now()){
  const e = entry(g), S = SOURCES[source], before = heartsFor(e.pts);
  if(source === 'pet'){ if(now - e.lastPet < PET_COOLDOWN) return {gained: 0, hearts: before, cooling: true}; e.lastPet = now; }
  const d = today(now); if(e.day !== d){ e.day = d; e.got = {}; }
  const gained = Math.max(0, Math.min(S.pts, S.cap - (e.got[source] || 0)));
  e.got[source] = (e.got[source] || 0) + gained; e.pts += gained;
  save();
  const hearts = heartsFor(e.pts);
  return {gained, hearts, levelUp: hearts > before};
}
function hearts(g){ const e = load().bond[g]; return e ? heartsFor(e.pts) : 0; }
/* when you last saw it in the pasture; returns the previous time, then marks it seen now */
function seen(g, now = Date.now()){ const e = entry(g), prev = e.seen; e.seen = now; save(); return prev; }
/* treats: earned by scanning, spent in the pasture, sometimes brought to you by a good friend */
const treats = () => load().treats;
function earnTreats(g, isNew, now = Date.now()){
  const e = entry(g), d = today(now);
  let n = isNew ? NEW_TREATS : 0;
  if(!isNew && e.treatDay !== d){ e.treatDay = d; n = 1; }
  data.treats += n; save();
  return n;
}
function useTreat(){ if(load().treats < 1) return false; data.treats--; save(); return true; }
function giveTreat(){ load().treats++; save(); }
/* a 3-heart friend brings you a gift at most once a day */
function gift(g, now = Date.now()){
  const e = entry(g), d = today(now);
  if(heartsFor(e.pts) < 3 || e.giftDay === d) return false;
  e.giftDay = d; save(); return true;
}
const heartText = h => '♥'.repeat(h) + '♡'.repeat(5 - h);

root.CMBond = {LEVELS, SOURCES, add, hearts, seen, heartText, treats, earnTreats, useTreat, giveTreat, gift, BEST: 5};
})(typeof window !== 'undefined' ? window : globalThis);
