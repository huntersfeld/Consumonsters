/* Consumonsters places: which pastures you've opened and who lives where.
   The meadow is always open. Every other place belongs to a domain and opens when you've caught three creatures
   from it. A creature lives in its own domain's place once that's open (the meadow until then), unless you've moved
   it somewhere else. Saved in this browser under its own key. */
(function(root){
'use strict';
const STORE = 'consumonsters.places.v1';
const NEED = 3;
/* the places that are built so far, in signpost order; swatch is the signpost's two colours */
const PLACES = [
  {id: 'meadow', domain: 'mammal', name: 'The meadow', sign: 'Meadow', swatch: ['#8CC85A', '#5DA6D8']},
  {id: 'lagoon', domain: 'aquatic', name: 'The lagoon', sign: 'Lagoon', swatch: ['#F1DC9C', '#2FB5C9']},
  {id: 'cliffs', domain: 'bird', name: 'The cliffs', sign: 'Cliffs', swatch: ['#9DC46B', '#8C929C']},
  {id: 'rocks', domain: 'reptile', name: 'The red rocks', sign: 'Red rocks', swatch: ['#E8B77A', '#C0583A']},
  {id: 'garden', domain: 'insect', name: 'The undergrowth', sign: 'Undergrowth', swatch: ['#6FA33C', '#D9473B']},
  {id: 'glade', domain: 'flora', name: 'The glade', sign: 'Glade', swatch: ['#F4E59A', '#3F7A3A']},
  {id: 'cave', domain: 'mineral', name: 'The crystal cave', sign: 'Cave', swatch: ['#B58CE8', '#3C4256']},
];
const byId = Object.fromEntries(PLACES.map(p => [p.id, p]));

let data, source = () => [];
function load(){
  if(data) return data;
  try{ data = JSON.parse(localStorage.getItem(STORE)); }catch{ data = null; }
  if(!data || data.v !== 1) data = {v: 1, home: {}, at: 'meadow', open: {meadow: 1}};
  return data;
}
const save = () => { try{ localStorage.setItem(STORE, JSON.stringify(data)); }catch{} };
/* the app tells us how to list the collection: () => [{g, t}] */
function setSource(fn){ source = fn; }

const caughtFrom = (domain, entries = source()) => entries.filter(x => x.t.domain === domain).length;
const isOpen = (id, entries) => id === 'meadow' || (!!byId[id] && caughtFrom(byId[id].domain, entries) >= NEED);
/* where a creature lives: where you moved it, else its own domain's place if that's open, else the meadow */
function homeOf(g, t, entries = source()){
  const moved = load().home[g];
  if(moved && isOpen(moved, entries)) return moved;
  const own = PLACES.find(p => p.domain === t.domain);
  return own && isOpen(own.id, entries) ? own.id : 'meadow';
}
function move(g, id){ const d = load(); if(byId[id]) d.home[g] = id; save(); }
/* the place on screen, remembered between visits */
function current(){ const at = load().at; return isOpen(at) ? at : 'meadow'; }
function go(id){ if(isOpen(id)){ load().at = id; save(); } }
/* every place, whether it's open, and how close you are */
function list(entries = source()){
  return PLACES.map(p => ({...p, open: isOpen(p.id, entries), have: Math.min(NEED, caughtFrom(p.domain, entries)), need: NEED,
    residents: entries.filter(x => homeOf(x.g, x.t, entries) === p.id).length}));
}
/* places that opened since we last looked; returns them once */
function check(now = Date.now()){
  const d = load(), entries = source(), out = [];
  for(const p of PLACES) if(!d.open[p.id] && isOpen(p.id, entries)){ d.open[p.id] = now; out.push(p); }
  if(out.length) save();
  return out;
}

root.CMPlaces = {PLACES, NEED, byId, setSource, isOpen, homeOf, move, current, go, list, check};
})(typeof window !== 'undefined' ? window : globalThis);
