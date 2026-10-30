/* Consumonsters rewards: hats you unlock by playing, and which creature is wearing which.
   Nothing is spent: a reward is earned once and kept. Every rule reads the collection and friendship as they
   stand, so a player who already has creatures gets the hats they've earned the first time this runs. */
(function(root){
'use strict';
const STORE = 'consumonsters.rewards.v1';
const RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const firstOf = d => ({entries}) => entries.some(x => x.t.domain === d);
const caught = n => Object.assign(({entries}) => entries.length >= n, {goal: n, have: ({entries}) => entries.length});
const streak = n => Object.assign(({visits}) => visits.best >= n, {goal: n, have: ({visits}) => visits.streak});
/* a date range that comes round every year, as [[month, day], [month, day]] */
const SPOOKY = [[10, 1], [11, 10]];
const inSeason = ([[m0, d0], [m1, d1]], now) => { const d = new Date(now), k = (d.getMonth() + 1) * 100 + d.getDate(); return k >= m0 * 100 + d0 && k <= m1 * 100 + d1; };
/* in the order the rewards list shows them; each unlocks one hat */
const REWARDS = [
  {id: 'first', hat: 'party', group: 'Collecting', how: 'Catch your first creature', test: caught(1)},
  {id: 'mammal', hat: 'beanie', group: 'Collecting', how: 'Catch a mammal', test: firstOf('mammal')},
  {id: 'bird', hat: 'propeller', group: 'Collecting', how: 'Catch a bird', test: firstOf('bird')},
  {id: 'reptile', hat: 'cowboy', group: 'Collecting', how: 'Catch a reptile', test: firstOf('reptile')},
  {id: 'insect', hat: 'boppers', group: 'Collecting', how: 'Catch an insect', test: firstOf('insect')},
  {id: 'aquatic', hat: 'sailor', group: 'Collecting', how: 'Catch an aquatic creature', test: firstOf('aquatic')},
  {id: 'flora', hat: 'flower', group: 'Collecting', how: 'Catch a flora creature', test: firstOf('flora')},
  {id: 'mineral', hat: 'miner', group: 'Collecting', how: 'Catch a mineral creature', test: firstOf('mineral')},
  {id: 'elemental', hat: 'wizard', group: 'Collecting', how: 'Catch an elemental', test: firstOf('elemental')},
  {id: 'mythic', hat: 'viking', group: 'Collecting', how: 'Catch a mythic creature', test: firstOf('mythic')},
  {id: 'ten', hat: 'cap', group: 'Collecting', how: 'Catch 10 creatures', test: caught(10)},
  {id: 'twentyfive', hat: 'chef', group: 'Collecting', how: 'Catch 25 creatures', test: caught(25)},
  {id: 'fifty', hat: 'top', group: 'Collecting', how: 'Catch 50 creatures', test: caught(50)},
  {id: 'epic', hat: 'crown', group: 'Rare finds', how: 'Find an Epic creature or rarer', test: ({entries}) => entries.some(x => RANK.indexOf(x.t.rarity) >= 3)},
  {id: 'shiny', hat: 'tiara', group: 'Rare finds', how: 'Find a shiny creature', test: ({entries}) => entries.some(x => x.t.shiny)},
  {id: 'friend', hat: 'bow', group: 'Friendship', how: 'Reach 3 hearts with a creature', test: ({entries, hearts}) => entries.some(x => hearts(x.g) >= 3)},
  {id: 'best', hat: 'beret', group: 'Friendship', how: 'Make a best friend (5 hearts)', test: ({entries, hearts}) => entries.some(x => hearts(x.g) >= 5)},
  {id: 'streak3', hat: 'sunhat', group: 'Visiting', how: 'Visit 3 days in a row', test: streak(3)},
  {id: 'streak7', hat: 'grad', group: 'Visiting', how: 'Visit 7 days in a row', test: streak(7)},
  {id: 'spooky', hat: 'pumpkin', group: 'Seasonal', how: 'Visit between October 1 and November 10', season: SPOOKY, test: ({now}) => inSeason(SPOOKY, now)},
];

let data, source = () => [];
function load(){
  if(data) return data;
  try{ data = JSON.parse(localStorage.getItem(STORE)); }catch{ data = null; }
  if(!data || data.v !== 1) data = {v: 1, got: {}, wear: {}, fresh: []};
  if(!data.visits) data.visits = {day: '', streak: 0, best: 0};
  return data;
}
const save = () => { try{ localStorage.setItem(STORE, JSON.stringify(data)); }catch{} };

const dayKey = now => { const d = new Date(now); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
/* opening the app counts as a visit, once a day; days in a row make a streak */
function visit(now = Date.now()){
  const v = load().visits, today = dayKey(now);
  if(v.day === today) return v;
  v.streak = v.day === dayKey(now - 864e5) ? v.streak + 1 : 1; v.best = Math.max(v.best, v.streak); v.day = today;
  save(); return v;
}
/* the app tells us how to list the collection: () => [{g, t}] */
function setSource(fn){ source = fn; }
/* unlock anything newly earned; returns the new rewards (empty when nothing changed) */
function check(now = Date.now()){
  const d = load(), ctx = context(now), out = [];
  for(const r of REWARDS) if(!d.got[r.id] && r.test(ctx)){ d.got[r.id] = now; d.fresh.push(r.hat); out.push(r); }
  if(out.length) save();
  return out;
}
function context(now = Date.now()){ return {entries: source(), hearts: g => root.CMBond ? root.CMBond.hearts(g) : 0, visits: load().visits, now}; }
/* for the rewards list: each reward, whether it's earned, and how far along you are */
function list(now = Date.now()){
  const ctx = context(now), d = load();
  return REWARDS.map(r => ({...r, got: d.got[r.id] || 0, have: r.test.have ? Math.min(r.test.goal, r.test.have(ctx)) : null, goal: r.test.goal || null,
    open: r.season ? inSeason(r.season, now) : null}));
}
const has = id => !!load().got[id];
/* hats you own, in reward order */
const hats = () => REWARDS.filter(r => load().got[r.id]).map(r => r.hat);
const owns = hat => hats().includes(hat);
const worn = g => { const h = load().wear[g]; return h && owns(h) ? h : null; };
function wear(g, hat){ const d = load(); if(hat && owns(hat)) d.wear[g] = hat; else delete d.wear[g]; save(); }
/* hats unlocked since you last looked, then forgets them */
function takeFresh(){ const d = load(), f = d.fresh; if(!f.length) return f; d.fresh = []; save(); return f; }

root.CMRewards = {REWARDS, setSource, check, visit, list, has, hats, owns, worn, wear, takeFresh};
})(typeof window !== 'undefined' ? window : globalThis);
