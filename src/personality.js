/*
 * Consumonsters personality: every creature's temperament, the same for everyone who catches it.
 *
 * Rolled from its own seed (barcode + ':temper'), never from engine.js, so creature looks are untouched.
 * Like the generator, this is frozen once shipped: players get to know their creature as shy or zippy, so
 * tests/personality.test.mjs pins it. Changing a lean or a word changes personalities people already know.
 */
(function(root){
'use strict';
const {hash32, mulberry} = root.CM;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* five traits from 0 to 1, with the words for each end */
const TRAITS = {
  energy: ['Sleepy', 'Zippy'],       // how often it wanders, how long it naps, a little of its speed
  boldness: ['Shy', 'Bold'],         // whether it comes when called, whether it backs off
  sociability: ['Loner', 'Social'],  // whether it hangs around other creatures
  playfulness: ['Calm', 'Playful'],  // chasing butterflies and playing tag
  focus: ['Curious', 'Stubborn'],    // curious ones get distracted on the way; stubborn ones do their own thing
};
/* each domain leans the dice a little */
const LEANS = {
  mammal: {playfulness: .12, sociability: .05},
  reptile: {focus: .2, energy: -.08},
  bird: {sociability: .2, energy: .05},
  insect: {energy: .18, focus: -.1},
  aquatic: {playfulness: .12},
  flora: {energy: -.15, boldness: -.08},
  mineral: {energy: -.2, focus: .12},
  elemental: {boldness: .12, energy: .06},
  mythic: {boldness: .15, focus: .06},
};

function temperament(gtin, domain){
  const r = mulberry(hash32(gtin + ':temper')), lean = LEANS[domain] || {}, out = {};
  for(const k of Object.keys(TRAITS)) out[k] = Math.round(clamp((r() + r()) / 2 + (lean[k] || 0), 0, 1) * 100) / 100;
  // the one word: whichever trait is furthest from the middle
  let best = 'energy';
  for(const k of Object.keys(TRAITS)) if(Math.abs(out[k] - .5) > Math.abs(out[best] - .5)) best = k;
  out.word = TRAITS[best][out[best] >= .5 ? 1 : 0];
  return out;
}

root.CMTemper = {TRAITS, LEANS, temperament};
})(typeof window !== 'undefined' ? window : globalThis);
