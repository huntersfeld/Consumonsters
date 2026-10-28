/*
 * Consumonsters creature generator, seed version cm-v1.
 *
 * Copied verbatim from the design spec's hatcher. Everything between the
 * markers is frozen: changing a weight, adding an option or reordering a
 * table silently changes creatures people already caught. tests/engine.test.mjs
 * pins a set of barcodes to their exact traits so an accidental change fails CI.
 * New content ships under a new seed version instead.
 */
(function(root){
'use strict';
/* ---- frozen: begin ---- */
const F = 36, CX = (F - 1) / 2, GY = F - 3, GEN = 'cm-v1';

/* ---------- deterministic randomness ---------- */
function hash32(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);}
  h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;}
function mulberry(a){return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const stream = (key, name) => mulberry(hash32(GEN + '|' + key + '|' + name));
const weighted = (r, list) => {let tot=0;for(const [,w] of list) tot+=w;let x=r()*tot;for(const [v,w] of list){x-=w;if(x<0) return v;}return list[list.length-1][0];};
const pick = (r, arr) => arr[Math.floor(r()*arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- barcode handling ---------- */
function checkDigit(body){let s=0;for(let i=0;i<body.length;i++){s+=(+body[body.length-1-i])*(i%2===0?3:1);}return (10-s%10)%10;}
function normalize(raw){
  const d = String(raw).replace(/\D/g,'');
  if(!d) return {error:'Type or scan a barcode number.'};
  let full = d;
  if(d.length===11) full = d + checkDigit(d);
  else if(![8,12,13,14].includes(d.length)) return {error:`A UPC has 12 digits. This one has ${d.length}.`};
  const want = checkDigit(full.slice(0,-1));
  if(+full.slice(-1)!==want) return {error:`Check digit doesn't match. The last digit should be ${want}.`};
  return {gtin: full.padStart(14,'0'), input: full};
}
function randomUPC(r){const ns=pick(r,['0','0','0','0','1','6','7','8','8','4']);let b=ns;for(let i=0;i<10;i++) b+=Math.floor(r()*10);return b+checkDigit(b);}
const upcOf = g => g.startsWith('00') ? g.slice(2) : g;

/* ---------- data ---------- */
const SIZES = {S:{label:'Small',n:14,w:30},M:{label:'Medium',n:20,w:38},L:{label:'Large',n:26,w:22},XL:{label:'Extra large',n:32,w:10}};
const SIZE_W = Object.entries(SIZES).map(([k,v])=>[k,v.w]);
const RARITY = {
  common:{label:'Common',w:55,chimera:0,slots:0,text:'One domain, natural palette. Pattern optional.'},
  uncommon:{label:'Uncommon',w:27,chimera:.05,slots:1,patterned:true,text:'Always patterned. 5% chance of one borrowed part.'},
  rare:{label:'Rare',w:12,chimera:.2,slots:1,patterned:true,text:'20% chance of one borrowed part.'},
  epic:{label:'Epic',w:4.5,chimera:.5,slots:1,patterned:true,accentOutline:true,sparkles:2,text:'50% chimera, accent-colored outline, 2 sparkles.'},
  legendary:{label:'Legendary',w:1.2,chimera:.8,slots:2,patterned:true,accentOutline:true,prismatic:true,sparkles:4,text:'80% chimera with two borrowed parts, named prismatic palette, 4 sparkles.'},
  mythic:{label:'Mythic',w:.3,chimera:1,slots:2,patterned:true,accentOutline:true,prismatic:true,glow:true,sparkles:6,text:'Always a two-part chimera, prismatic palette, glowing aura, 6 sparkles.'}
};
const RARITY_W = Object.entries(RARITY).map(([k,v])=>[k,v.w]);
const PRISM = [
  {name:'Glacier',base:[195,70,76],accent:[262,80,70]},{name:'Gilded',base:[45,85,56],accent:[0,0,97]},
  {name:'Obsidian',base:[265,25,20],accent:[300,95,66]},{name:'Rose quartz',base:[340,60,78],accent:[190,80,62]},
  {name:'Nebula',base:[250,55,44],accent:[178,95,60]},{name:'Ember',base:[12,85,50],accent:[48,100,62]}];

const DOMAINS = {
 mammal:{label:'Mammal',w:15,plan:'headed',anchor:'Foxes, bears, rodents, cats, deer',sig:'Ears, antlers, paws, hooves, fluffy tails, manes',
  body:[['round',3],['long',2],['pear',2],['squat',2]],head:[['round',3],['wide',2],['big',2]],
  topper:[['ears_pointed',4],['ears_round',4],['horns',1],['antlers',2],['longears',3],['cowlick',2]],sides:[['arms',5],['armsup',2],['none',2]],feet:[['stubby',5],['claws',3],['hooves',2]],
  tail:[['fluffy',4],['whip',3],['curly',2],['none',2]],eyes:[['big',4],['dot',4],['sleepy',2],['happy',2],['tiny',2]],mouth:[['smile',4],['fangs',2],['open',2],['tongue',2],['buck',2]],
  pattern:[['belly',4],['spots',2],['stripes',2],['patches',2],['centerline',1],['none',2]],back:[['mane',3],['spikes',1],['none',5]],cheeks:[['blush',3],['whiskers',3],['mask',2],['cheekdots',2],['none',4]],
  hues:[[28,48,50],[18,55,42],[35,30,62],[210,8,55],[42,62,66],[0,0,40]],accents:[[350,60,74],[30,40,78],[20,35,32]],
  bone:[40,30,84],syl:['Mof','Bur','Pud','Snuf','Wom','Tib','Gro','Fen']},
 reptile:{label:'Reptile',w:13,plan:'headed',anchor:'Lizards, turtles, snakes, dinosaurs',sig:'Frills, horns, shells, slit eyes, scales, coils',
  body:[['long',4],['round',2],['squat',2],['pear',1]],head:[['wide',4],['round',1],['big',1]],
  topper:[['horns',3],['frill',3],['spines',3],['unicorn',1],['none',1]],sides:[['arms',4],['armsup',1],['stubwings',1],['none',2]],feet:[['claws',5],['stubby',2],['coil',2],['webbed',1]],
  tail:[['spiked',3],['whip',4],['none',1]],eyes:[['slit',5],['dot',2],['tiny',1],['happy',1]],mouth:[['fangs',3],['smile',2],['none',2],['tongue',2]],
  pattern:[['scales',5],['belly',3],['stripes',2],['spots',1],['chevrons',2],['centerline',1]],back:[['shell',3],['spikes',3],['none',3]],cheeks:[['warpaint',2],['cheekdots',1],['mask',1],['none',5]],
  hues:[[110,40,42],[140,45,38],[80,45,45],[170,40,40],[40,45,55],[15,50,40]],accents:[[50,75,60],[0,65,50],[20,80,55],[270,40,55]],
  bone:[40,35,80],iris:[55,95,55],syl:['Skal','Zib','Rax','Kro','Sli','Gek','Ig']},
 bird:{label:'Bird',w:13,plan:'merged',anchor:'Owls, parrots, songbirds, ducks, penguins',sig:'Beaks, crests, feathered wings, collars, webbed or thin legs',
  body:[['egg',5],['round',2],['pear',2],['squat',1],['tall',1]],
  topper:[['crest',5],['tufts',3],['cowlick',2],['none',2]],sides:[['wings_feather',7],['stubwings',3],['none',1]],feet:[['thin',6],['webbed',2],['float',1]],
  tail:[['fan',3],['none',4]],eyes:[['big',4],['dot',4],['happy',2],['tiny',2]],mouth:[['beak',9]],
  pattern:[['belly',5],['stripes',2],['freckles',2],['chevrons',2],['none',1]],back:[['cape',3],['none',4]],cheeks:[['blush',3],['mask',2],['cheekdots',1],['none',4]],
  hues:[[210,70,55],[0,70,52],[48,85,58],[280,45,55],[160,55,45],[25,85,55]],accents:[[40,90,55],[200,70,70],[350,75,60],[0,0,95]],
  bone:[38,90,55],syl:['Pip','Kee','Chir','Wren','Fla','Tuu','Cor']},
 insect:{label:'Insect',w:12,plan:'headed',anchor:'Beetles, ants, moths, mantises, scorpions',sig:'Antennae, compound eyes, six legs, see-through wings, stingers',
  body:[['segment',6],['round',2],['pear',1],['tall',1]],head:[['narrow',4],['round',2],['big',1]],
  topper:[['antennae',7],['horns',2],['unicorn',1]],sides:[['wings_insect',5],['pincers',2],['armsup',1],['none',3]],feet:[['insect_legs',7],['thin',2]],
  tail:[['none',6],['stinger',3]],eyes:[['compound',6],['big',2],['tiny',1],['visor',1]],mouth:[['mandibles',6],['none',2],['tongue',1]],
  pattern:[['stripes',5],['spots',3],['chevrons',2],['centerline',1],['none',2]],back:[['carapace',4],['spikes',1],['none',3]],cheeks:[['mask',2],['warpaint',1],['none',6]],
  hues:[[35,80,50],[80,60,45],[270,45,45],[340,60,50],[220,25,34],[190,60,40]],accents:[[50,90,55],[0,75,50],[180,70,60],[120,60,50]],
  bone:'chitin',syl:['Biz','Klik','Zit','Mand','Chit','Vex','Skit']},
 aquatic:{label:'Aquatic',w:13,plan:'merged',anchor:'Fish, axolotls, octopuses, crabs, anglerfish',sig:'Fins, gill fronds, lures, tentacles, pincers, fish tails',
  body:[['blob',5],['round',3],['squat',2],['tall',1]],
  topper:[['fin_dorsal',4],['fronds',3],['lure',2],['cowlick',1],['none',2]],sides:[['fins',7],['pincers',2],['arms',1]],feet:[['tentacles',4],['float',4],['webbed',2]],
  tail:[['none',4],['fishtail',4]],eyes:[['big',4],['dot',3],['tiny',2],['happy',1]],mouth:[['smile',3],['open',3],['fangs',1],['tongue',1]],
  pattern:[['spots',3],['stripes',3],['belly',3],['gradient',2],['chevrons',1]],back:[['spikes',2],['shell',1],['none',5]],cheeks:[['gillslits',3],['blush',2],['none',4]],
  hues:[[195,65,50],[215,60,45],[175,55,45],[345,65,72],[15,75,62],[245,45,55]],accents:[[175,70,70],[50,85,60],[330,70,70],[200,80,80]],
  bone:[30,40,75],syl:['Blub','Glo','Nep','Kel','Squi','Ora','Mur']},
 flora:{label:'Flora',w:12,plan:'merged',anchor:'Mushrooms, sprouts, cacti, flowers, moss',sig:'Leaves, caps, blooms, sprouts, roots, moss',
  body:[['egg',4],['round',3],['pear',3],['squat',1]],
  topper:[['leaves',5],['mushroom',3],['bloom',3],['sprout',3]],sides:[['leaves',5],['arms',2],['armsup',1],['none',2]],feet:[['roots',6],['stubby',2],['float',1]],
  tail:[['none',5],['leafy',3]],eyes:[['dot',4],['sleepy',3],['big',2],['happy',2]],mouth:[['smile',5],['none',2],['open',1],['tongue',1]],
  pattern:[['freckles',3],['spots',3],['none',3],['gradient',2],['patches',1]],back:[['moss',3],['none',4]],cheeks:[['blush',3],['cheekdots',2],['none',4]],
  hues:[[100,45,42],[130,40,38],[80,50,48],[25,35,45],[150,30,40]],accents:[[330,70,68],[50,85,60],[280,50,65],[0,70,58],[20,80,60]],
  bone:[28,40,34],iris:[50,95,62],syl:['Spro','Fern','Moss','Bud','Thi','Lumi','Pet']},
 mineral:{label:'Mineral',w:11,plan:'merged',anchor:'Geodes, crystals, river stones, ore',sig:'Crystal shards, block bodies, facets, visors, gems',
  body:[['block',7],['round',1],['squat',2],['tall',1]],
  topper:[['crystals',7],['horns',2],['unicorn',1]],sides:[['arms',5],['armsup',1],['none',3]],feet:[['stubby',5],['float',3],['hooves',1]],
  tail:[['none',5],['shard',3]],eyes:[['dot',3],['cyclops',3],['slit',1],['big',2],['visor',2]],mouth:[['none',4],['smile',2],['grill',2],['buck',1]],
  pattern:[['facets',6],['spots',2],['patches',1],['centerline',1],['none',2]],back:[['geode',4],['none',3]],cheeks:[['gem',3],['warpaint',1],['none',5]],
  hues:[[220,15,55],[200,20,48],[260,15,50],[30,15,55],[0,0,52]],accents:[[175,75,60],[290,60,65],[200,85,65],[340,70,65],[50,85,60]],
  bone:'crystal',iris:[175,90,60],syl:['Geo','Quar','Obs','Fel','Pyr','Cob','Ag']},
 elemental:{label:'Elemental',w:6,plan:'split',anchor:'Fire, water, earth and air, held together as a body',sig:'Three floating body pieces, element textures, motes, auras',
  body:[['stacked',3],['trio',2]],head:[['round',3],['big',1]],
  topper:[['flame',1],['horns',1],['droplet',1],['fronds',1],['crystals',1],['sprout',1],['wisps',1],['halo',1],['none',1]],
  sides:[['motes',3],['fists',3],['none',2]],feet:[['float',1]],tail:[['none',4],['wisp',2]],
  eyes:[['big',2],['slit',2],['visor',1],['cyclops',2],['dot',2]],mouth:[['none',4],['open',2],['fangs',1],['smile',2]],
  pattern:[['flicker',1],['gradient',1],['waves',1],['spots',1],['cracks',1],['facets',1],['freckles',1],['swirl',1],['none',1]],back:[['aura',2],['none',3]],cheeks:[['gem',2],['warpaint',1],['none',4]],
  hues:[[12,85,52],[200,70,55],[30,30,42],[195,30,88],[40,95,55],[215,65,50]],accents:[[48,100,62],[180,80,80],[110,45,48],[260,50,75]],
  bone:[40,30,80],syl:['Pyr','Aqu','Terr','Zep'],
  elements:{
   fire:{topper:[['flame',5],['horns',1],['none',1]],pattern:[['flicker',4],['gradient',2]],hues:[[12,85,52],[25,90,55],[0,75,48],[40,95,55]],accents:[[48,100,62],[20,100,60],[200,90,65]],iris:[50,100,65],syl:['Pyr','Ign','Cin','Blaz']},
   water:{topper:[['droplet',4],['fronds',2],['none',2]],pattern:[['waves',4],['spots',2]],hues:[[200,70,55],[215,65,50],[185,60,50],[230,55,60]],accents:[[180,80,80],[200,90,85],[170,70,65]],iris:[190,100,85],syl:['Aqu','Tid','Ripp','Mer']},
   earth:{topper:[['crystals',3],['sprout',2],['horns',2],['none',2]],pattern:[['cracks',4],['facets',2],['freckles',1]],hues:[[30,30,42],[25,40,35],[45,25,50],[90,25,38]],accents:[[110,45,48],[45,80,58],[175,60,55]],iris:[45,95,60],syl:['Terr','Grav','Bould','Tor']},
   air:{topper:[['wisps',4],['halo',2],['none',2]],pattern:[['swirl',4],['none',1]],hues:[[195,30,88],[210,25,82],[180,25,85],[260,20,86]],accents:[[195,70,70],[260,50,75],[170,60,70]],iris:[200,90,60],ghost:true,syl:['Zep','Gal','Ae','Wisp']}
  }},
 mythic:{label:'Mythic',w:6,plan:'either',anchor:'Dragons, spirits, imps, unicorns, remixed from every domain',sig:'Halos, flames, third eyes, membrane wings, tusks, gems',
  body:[['round',3],['egg',2],['long',2],['pear',1],['tall',1]],head:[['round',2],['wide',1],['big',1]],
  topper:[['halo',3],['horns',4],['flame',3],['ears_pointed',2],['antlers',2],['unicorn',2]],sides:[['wings_membrane',4],['wings_feather',3],['stubwings',2],['armsup',1],['none',2]],feet:[['stubby',3],['claws',3],['float',3],['hooves',1],['coil',1]],
  tail:[['whip',3],['fluffy',2],['spiked',2],['flametail',3],['none',2]],eyes:[['cyclops',3],['big',3],['slit',3],['triclops',2],['visor',1]],mouth:[['fangs',3],['smile',2],['none',2],['tusks',2]],
  pattern:[['spots',2],['stripes',2],['gradient',3],['facets',1],['chevrons',1],['none',2]],back:[['mane',2],['spikes',2],['cape',1],['none',3]],cheeks:[['gem',3],['warpaint',2],['mask',1],['none',3]],
  hues:[[265,50,50],[300,45,52],[190,55,65],[45,70,55],[0,0,88],[230,40,30]],accents:[[45,90,60],[175,80,60],[320,80,65],[200,90,70]],
  bone:[45,80,62],iris:[330,90,62],syl:['Aeth','Nyx','Sera','Drak','Vol','Eld','Zeph']}
};
const DOMAIN_W = Object.entries(DOMAINS).map(([k,d])=>[k,d.w]);
const SLOTS = ['topper','sides','feet','tail','eyes','mouth','pattern','back','cheeks'];
const LABELS = {headed:'Headed',merged:'Merged',round:'Round',long:'Long',egg:'Egg',block:'Block',blob:'Blob',segment:'Segmented',wide:'Wide',narrow:'Narrow',
  ears_pointed:'Pointed ears',ears_round:'Round ears',horns:'Horns',antennae:'Antennae',crest:'Crest',tufts:'Ear tufts',frill:'Frill',spines:'Spines',fin_dorsal:'Dorsal fin',lure:'Lure',fronds:'Gill fronds',leaves:'Leaves',mushroom:'Mushroom cap',bloom:'Bloom',crystals:'Crystals',halo:'Halo',flame:'Flame',none:'None',
  arms:'Arms',wings_feather:'Feathered wings',wings_membrane:'Membrane wings',wings_insect:'Insect wings',fins:'Fins',
  stubby:'Stubby feet',claws:'Clawed feet',thin:'Thin legs',insect_legs:'Six legs',tentacles:'Tentacles',roots:'Roots',float:'Floats',
  fluffy:'Fluffy',whip:'Whip',spiked:'Spiked',fan:'Tail fan',
  dot:'Dot',big:'Big',slit:'Slit',sleepy:'Sleepy',compound:'Compound',cyclops:'Cyclops',
  smile:'Smile',fangs:'Fangs',open:'Open',beak:'Beak',mandibles:'Mandibles',grill:'Grill',
  belly:'Belly patch',spots:'Spots',stripes:'Stripes',scales:'Scales',facets:'Facets',freckles:'Freckles',gradient:'Two-tone',
  pear:'Pear',squat:'Squat',tall:'Tall',big:'Big',antlers:'Antlers',unicorn:'Single horn',longears:'Long ears',cowlick:'Cowlick',sprout:'Sprout',
  armsup:'Raised arms',stubwings:'Stub wings',pincers:'Pincers',hooves:'Hooves',webbed:'Webbed feet',coil:'Coiled tail base',
  fishtail:'Fish tail',leafy:'Leaf tail',stinger:'Stinger',shard:'Crystal shard',flametail:'Flame tip',curly:'Curly',
  happy:'Happy',tiny:'Wide-eyed',visor:'Visor',triclops:'Third eye',tongue:'Tongue out',buck:'Buck teeth',tusks:'Tusks',
  patches:'Patches',chevrons:'Chevrons',centerline:'Center stripe',mane:'Mane',shell:'Shell',spikes:'Back spikes',cape:'Feather collar',carapace:'Carapace',moss:'Moss',geode:'Geode clusters',
  stacked:'Stacked pieces',trio:'Split pieces',split:'Floating pieces',motes:'Motes',fists:'Floating fists',wisp:'Wisp trail',aura:'Aura',droplet:'Droplet',wisps:'Wisps',
  flicker:'Flicker core',waves:'Waves',cracks:'Cracks',swirl:'Swirl',fire:'Fire',water:'Water',earth:'Earth',air:'Air',
  blush:'Blush',whiskers:'Whiskers',mask:'Eye mask',cheekdots:'Cheek dots',warpaint:'War paint',gillslits:'Gill slits',gem:'Forehead gem'};
const lab = k => LABELS[k] || k;
const ENDS = {S:['let','bit','kin','pip','ix'],M:['o','y','ble','ster','pup'],L:['ra','don','ox','gor','mus'],XL:['goth','zar','moth','titan','krag']};
const MIDS = ['a','i','o','u','ar','el'];

/* ---------- trait roll ---------- */
function jit(r,c,dh,ds,dl){return [((c[0]+(r()*2-1)*dh)+360)%360, clamp(c[1]+(r()*2-1)*ds,0,100), clamp(c[2]+(r()*2-1)*dl,5,95)];}
function makePalette(r, D, t){
  let base = jit(r, pick(r,D.hues), 8, 6, 5), accent = jit(r, pick(r,D.accents), 6, 5, 4), prismName = null;
  const R = RARITY[t.rarity];
  if(R.prismatic){const p = pick(r, PRISM); base=[...p.base]; accent=[...p.accent]; prismName=p.name;}
  if(t.shiny){base[0]=(base[0]+150+r()*60)%360; accent[0]=(accent[0]+150+r()*60)%360; base[1]=Math.min(90,base[1]+18);}
  let bone = D.bone==='chitin' ? [base[0],25,20] : D.bone==='crystal' ? [accent[0],accent[1],Math.min(85,accent[2]+12)] : [...D.bone];
  return palFrom(base, accent, bone, [...(D.iris||[52,90,58])], R, prismName);
}
function palFrom(base, accent, bone, iris, R = {}, prismName = null){
  let outline = [base[0], Math.min(60, base[1]*0.7+10), 13];
  if(R.accentOutline) outline = [accent[0], 70, 18];
  if(base[2] < 30) outline = R.prismatic ? [accent[0], 85, 50] : [base[0], Math.min(60, base[1]*0.7+10), Math.max(5, base[2]-20)];
  return {base, accent, bone, iris, outline, prismName,
    light:[base[0], base[1]*0.7, Math.min(90, base[2]+22)], dark:[base[0], Math.min(100, base[1]+8), Math.max(9, base[2]-16)],
    eyeW:[base[0],15,96], pupil:[base[0],35,9], glow:[accent[0],95,78], blush:[350,75,72]};
}
function roll(gtin, o = {}){
  const t = {gtin};
  t.rarity = o.rarity || weighted(stream(gtin,'rarity'), RARITY_W);
  t.size = o.size || weighted(stream(gtin,'size'), SIZE_W);
  t.famHit = false;
  if(o.domain) t.domain = o.domain;
  else if(o.families && stream(gtin,'family')() < 0.7){t.domain = weighted(stream(gtin.slice(0,8),'domain'), DOMAIN_W); t.famHit = true;}
  else t.domain = weighted(stream(gtin,'domain'), DOMAIN_W);
  let D = DOMAINS[t.domain];
  if(D.elements){t.element = weighted(stream(gtin,'element'), Object.keys(D.elements).map(k=>[k,1])); D = Object.assign({}, D, D.elements[t.element]);}
  const rp = stream(gtin,'part:plan');
  t.plan = D.plan==='either' ? (rp()<0.65?'headed':'merged') : D.plan;
  t.body = weighted(stream(gtin,'part:body'), D.body);
  t.head = D.head ? weighted(stream(gtin,'part:head'), D.head) : 'round';
  for(const s of SLOTS) t[s] = weighted(stream(gtin,'part:'+s), D[s]);
  const R = RARITY[t.rarity];
  if(R.patterned && t.pattern==='none'){const rr=stream(gtin,'part:pattern2');for(let i=0;i<6&&t.pattern==='none';i++) t.pattern=weighted(rr,D.pattern);if(t.pattern==='none') t.pattern=D.pattern[0][0];}
  t.patMat = weighted(stream(gtin,'part:patcolor'), [[3,4],[10,3],[2,3]]);
  t.stripeFull = stream(gtin,'part:stripe')() < 0.5;
  const rs = stream(gtin,'shape'); t.jw = 0.92 + rs()*0.16; t.jh = 0.92 + rs()*0.16;
  const rc = stream(gtin,'chimera'); t.donor = null; t.donated = [];
  if(rc() < R.chimera){
    t.donor = weighted(rc, DOMAIN_W.filter(([k]) => k!==t.domain));
    const pool = ['topper','sides','feet','tail','eyes','pattern','back','cheeks'];
    for(let i=0;i<R.slots;i++){
      const slot = pool.splice(Math.floor(rc()*pool.length),1)[0];
      let v = 'none';
      for(let k=0;k<6;k++){v = weighted(rc, DOMAINS[t.donor][slot]); if(v!=='none' && v!==t[slot]) break;}
      if(v!=='none' && v!==t[slot]){t[slot]=v; t.donated.push(slot);}
    }
    if(!t.donated.length) t.donor = null;
  }
  const rcol = stream(gtin,'color');
  t.shiny = rcol() < 1/64;
  t.pal = makePalette(rcol, D, t); t.pal.ghost = !!D.ghost;
  const rn = stream(gtin,'name');
  t.name = pick(rn, D.syl) + (rn()<0.35 ? pick(rn, MIDS) : '') + pick(rn, ENDS[t.size]);
  return t;
}

/* ---------- sprite builder ---------- */
// materials: 1 body, 2 accent, 3 light pattern, 4 eye white, 5 pupil, 7 horn/beak, 8 glow part, 9 ground shadow,
// 10 dark pattern, 11 sparkle, 12 outline, 13 aura, 14 iris, 15 sparkle arm
function build(t, stage = 9){
  const G = new Uint8Array(F*F);
  const inb = (x,y) => x>=0 && y>=0 && x<F && y<F;
  const get = (x,y) => inb(x,y) ? G[y*F+x] : 0;
  const put = (x,y,v) => {x=Math.round(x);y=Math.round(y);if(inb(x,y)) G[y*F+x]=v;};
  const putM = (x,y,v) => {x=Math.round(x);y=Math.round(y);put(x,y,v);put(F-1-x,y,v);};
  const fill = (x0,y0,x1,y1,test,v,o={}) => {
    const mir = o.mirror!==false;
    for(let y=Math.floor(y0);y<=Math.ceil(y1);y++) for(let x=Math.floor(x0);x<=Math.ceil(x1);x++){
      if(!inb(x,y) || !test(x,y)) continue;
      if(!o.only || o.only(get(x,y))) G[y*F+x]=v;
      if(mir){const mx=F-1-x; if(!o.only || o.only(get(mx,y))) G[y*F+mx]=v;}
    }};
  const ell = (cx,cy,rx,ry,v,o) => {rx=Math.max(rx,.55);ry=Math.max(ry,.55);fill(cx-rx-1,cy-ry-1,cx+rx+1,cy+ry+1,(x,y)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1,v,o);};
  const rell = (cx,cy,rx,ry,a,v,o) => {rx=Math.max(rx,.55);ry=Math.max(ry,.55);const c=Math.cos(a),s=Math.sin(a),R=Math.max(rx,ry)+1;
    fill(cx-R,cy-R,cx+R,cy+R,(x,y)=>{const dx=x-cx,dy=y-cy,u=dx*c+dy*s,w=-dx*s+dy*c;return (u/rx)**2+(w/ry)**2<=1;},v,o);};
  const tri = (ax,ay,bx,by,qx,qy,v,o) => {const sg=(px,py,x1,y1,x2,y2)=>(px-x2)*(y1-y2)-(x1-x2)*(py-y2);
    fill(Math.min(ax,bx,qx)-1,Math.min(ay,by,qy)-1,Math.max(ax,bx,qx)+1,Math.max(ay,by,qy)+1,(x,y)=>{const d1=sg(x,y,ax,ay,bx,by),d2=sg(x,y,bx,by,qx,qy),d3=sg(x,y,qx,qy,ax,ay);return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));},v,o);};
  const line = (x0,y0,x1,y1,v,mir=true) => {const st=Math.max(1,Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))));
    for(let i=0;i<=st;i++){const k=i/st,x=x0+(x1-x0)*k,y=y0+(y1-y0)*k; mir?putM(x,y,v):put(x,y,v);}};
  const rect = (x0,y0,w,h,v) => {for(let y=y0;y<y0+h;y++) for(let x=x0;x<x0+w;x++) putM(x,y,v);};
  const onSolid = m => m!==0 && m!==9;

  const n = SIZES[t.size].n, th = Math.max(2, Math.round(n*(t.plan==='split'?0.12:0.16)));
  const floating = t.feet==='float';
  const tall = ['thin','insect_legs','roots','tentacles'].includes(t.feet);
  const feetH = floating ? 0 : Math.max(2, Math.round(n*(tall?0.17:0.12)));
  const lift = t.plan==='split' ? 1 : floating ? Math.max(2, Math.round(n*0.1)) : 0;
  const L = {}, BW = {long:1.22, segment:0.82, squat:1.15, tall:0.82}, BH = {long:0.82, squat:0.78, tall:1.18};
  L.bottom = GY - lift - (feetH ? feetH-1 : 0);
  if(t.plan==='headed'){
    L.rx = n*0.29*(BW[t.body]||1)*t.jw; L.h = n*0.38*(BH[t.body]||1)*t.jh;
    const hw = {wide:1.22, narrow:0.86, big:1.12}[t.head] || 1, hh = {wide:0.86, big:1.1}[t.head] || 1;
    L.hrx = n*0.23*hw; L.hry = n*0.23*hh;
    L.top = L.bottom - L.h; L.cy = L.bottom - L.h/2;
    L.hcy = L.top - L.hry*0.4; L.htop = L.hcy - L.hry;
  } else if(t.plan==='split'){
    const gap = n>=20 ? 2.2 : 2, hw = {big:1.12}[t.head] || 1;
    if(t.body==='trio'){
      L.rx = n*0.32*t.jw; L.h = n*0.3*t.jh; L.top = L.bottom - L.h; L.cy = L.bottom - L.h/2;
      L.hrx = n*0.21*hw; L.hry = n*0.19*hw;
    } else {
      L.bry = n*0.085; L.brx = n*0.17*t.jw; L.bcy = GY - lift - L.bry; L.patBottom = L.bcy + L.bry;
      L.rx = n*0.23*t.jw; L.h = n*0.3*t.jh; L.bottom = L.bcy - L.bry - gap; L.top = L.bottom - L.h; L.cy = L.bottom - L.h/2;
      L.hrx = n*0.18*hw; L.hry = n*0.14*hw;
    }
    L.hcy = L.top - gap - L.hry; L.htop = L.hcy - L.hry;
  } else {
    L.rx = n*0.31*(t.body==='block'?0.95:(BW[t.body]||1))*t.jw; L.h = n*0.6*Math.min(1.08, BH[t.body]||1)*t.jh;
    L.top = L.bottom - L.h; L.cy = L.bottom - L.h/2;
    L.hrx = L.rx*0.82; L.hry = L.h*0.3; L.hcy = L.top + L.h*0.36; L.htop = L.top;
  }
  const HT = L.htop, hx = L.hrx, hy = L.hry, EL = t.element;
  const piece = (cx,cy,rx,ry,v,o={}) => {
    rx=Math.max(rx,.8); ry=Math.max(ry,.8);
    if(EL==='fire'){const tip=ry*(o.tip||0.45); fill(cx-rx-1,cy-ry-tip-1,cx+rx+1,cy+ry+1,(x,y)=>{const dx=x-cx; if(y>=cy) return (dx/rx)**2+((y-cy)/ry)**2<=1; const k=(cy-y)/tip; return k<=1 && Math.abs(dx)<=rx*Math.pow(1-k,0.75);},v,o);}
    else if(EL==='earth') fill(cx-rx-1,cy-ry-1,cx+rx+1,cy+ry+1,(x,y)=>{const a=Math.abs(x-cx)/rx, b=Math.abs(y-cy)/ry; return a<=1&&b<=1&&a+b<=1.55;},v,o);
    else if(EL==='air') fill(cx-rx-1,cy-ry-1,cx+rx+1,cy+ry+1,(x,y)=>{if(y>cy+ry*0.8) return false; const c=(px,py,r)=>(x-px)**2+(y-py)**2<=r*r, sr=Math.min(rx*0.55,ry*0.75);
      return c(cx,cy-ry*0.2,ry*0.85)||c(cx-rx*0.5,cy+ry*0.15,sr)||c(cx+rx*0.5,cy+ry*0.15,sr);},v,o);
    else {ell(cx,cy,rx,ry,v,o); if(EL==='water' && v===1 && rx>=2) put(cx-rx*0.45,cy-ry*0.45,11);}
  };

  ell(CX, GY+1, L.rx*0.85, 0.6, 9);

  // back layer
  if(stage>=2){
    if(t.sides==='wings_feather'){const off=L.rx+n*0.04, cy=L.top+L.h*0.3; rell(CX-off,cy,n*0.17,n*0.08,0.55,2); rell(CX-off+n*0.04,cy+n*0.02,n*0.1,n*0.045,0.55,3);}
    if(t.sides==='wings_membrane'){const sx=CX-L.rx*0.5, sy=L.top+1, tx=CX-L.rx-n*0.2, ty=L.top-n*0.14, bx=CX-L.rx-n*0.12, by=L.cy+n*0.06;
      tri(sx,sy,tx,ty,bx,by,2); line(sx,sy,tx,ty,7); line(sx,sy+1,bx,by,7);}
    if(t.sides==='wings_insect'){rell(CX-L.rx-n*0.06,L.top+n*0.02,n*0.18,n*0.08,0.6,8); rell(CX-L.rx-n*0.02,L.cy+n*0.06,n*0.13,n*0.055,-0.4,8);}
    if(t.back==='aura'){const cy=L.cy-L.h*0.15, rx=L.rx*1.45, ry=L.h*0.95+n*0.1;
      fill(CX-rx-1,cy-ry-1,CX+rx+1,cy+ry+1,(x,y)=>((x-CX)/rx)**2+((y-cy)/ry)**2<=1&&((x-CX)/(rx-1.3))**2+((y-cy)/(ry-1.3))**2>1,8);}
    if(t.tail==='wisp') for(let i=0;i<3;i++){const r=Math.max(.6,n*(0.06-0.015*i)); ell(CX+L.rx+n*(0.05+0.08*i),L.cy+L.h*0.25-i*n*0.08,r,r,2,{mirror:false});}
    if(t.back==='mane'){ if(t.plan==='headed') ell(CX,L.hcy+hy*0.45,hx*1.32,hy*1.05,2); else ell(CX,L.hcy+hy*0.4,L.rx*1.14,hy*1.1,2); }
    if(t.back==='shell'){ ell(CX,L.cy-0.5,L.rx*1.22,L.h*0.62,10); ell(CX,L.cy-0.5,L.rx*1.08,L.h*0.54,2); }
    if(t.back==='spikes'){ for(const k of [0.5,0.85]){const bx=CX-L.rx*k, by=L.top+L.h*(0.15+0.25*(k-0.5)); tri(bx-1.4,by+1,bx+1.4,by+1,bx-n*0.06,by-n*0.13,7);} }
    if(t.back==='cape') tri(CX-L.rx*0.3,L.top+0.5,CX-L.rx*1.18,L.top+L.h*0.6,CX-L.rx*0.7,L.top-n*0.07,2);
    if(t.back==='carapace') rell(CX-L.rx*0.5,L.cy-L.h*0.05,L.rx*0.72,L.h*0.56,0.18,2);
    if(t.topper==='frill'){ell(CX,L.hcy-hy*0.15,hx*1.65,hy*1.3,3); ell(CX,L.hcy-hy*0.15,hx*1.38,hy*1.06,2);}
    if(t.tail==='fluffy'){const tx=CX+L.rx*0.92; ell(tx,L.cy-L.h*0.1,n*0.12,n*0.15,1,{mirror:false}); ell(tx+n*0.03,L.cy-L.h*0.1-n*0.09,n*0.07,n*0.06,3,{mirror:false});}
    if(['whip','spiked','stinger','flametail'].includes(t.tail)){const x0=CX+L.rx*0.7, y0=L.bottom-1, len=Math.min(n*0.3, F-3-x0), st=Math.ceil(len*2), thick=(t.tail==='spiked'||n>=26)?2:1; let ex=x0,ey=y0;
      for(let i=0;i<=st;i++){const k=i/st, x=x0+k*len, y=y0-k*k*n*0.32; for(let j=0;j<thick;j++) put(x,y+j,1); if(t.tail==='spiked' && i%3===1) put(x,y-1,7); ex=x;ey=y;}
      if(t.tail==='whip') ell(ex,ey,Math.max(.7,n*0.05),Math.max(.7,n*0.05),2,{mirror:false});
      if(t.tail==='stinger') tri(ex-1,ey+0.5,ex+1,ey+0.5,ex+n*0.06,ey-n*0.1-0.5,7,{mirror:false});
      if(t.tail==='flametail'){ell(ex,ey-0.5,n*0.07+0.4,n*0.09+0.4,8,{mirror:false}); ell(ex,ey,Math.max(.6,n*0.035),Math.max(.6,n*0.045),14,{mirror:false});}}
    if(t.tail==='fishtail') tri(CX+L.rx*0.75,L.cy+L.h*0.15,CX+L.rx+n*0.2,L.cy-n*0.05,CX+L.rx+n*0.2,L.cy+L.h*0.42,2,{mirror:false});
    if(t.tail==='leafy'){line(CX+L.rx*0.8,L.bottom-1,CX+L.rx+n*0.06,L.cy+L.h*0.1,7,false); rell(CX+L.rx+n*0.1,L.cy-L.h*0.05,n*0.12,n*0.055,-0.9,2,{mirror:false});}
    if(t.tail==='shard') tri(CX+L.rx*0.75,L.bottom-1,CX+L.rx*0.85,L.bottom-1-n*0.14,CX+L.rx+n*0.22,L.bottom-n*0.24,2,{mirror:false});
    if(t.tail==='curly'){const cx=CX+L.rx+n*0.07, cy=L.cy+L.h*0.12, r=Math.max(1.5,n*0.075); line(CX+L.rx*0.8,cy+r*0.6,cx,cy+r,1,false);
      for(let a=0;a<5.4;a+=0.2){const rr=r*(1-a/9); put(cx+Math.cos(a+1.57)*rr, cy+Math.sin(a+1.57)*rr, 1);}}
    if(t.tail==='fan'){for(const a of [0.35,0.95]) rell(CX-L.rx*0.7,L.bottom-L.h*0.15,n*0.2,n*0.055,-a,2);}
  }
  // feet
  if(stage>=2){
    const fx = L.rx*0.45;
    if(t.feet==='stubby'||t.feet==='claws'||t.feet==='hooves'){const frx=Math.max(1.1,n*0.085), fry=feetH*0.55+0.5, fcy=GY-fry+0.45; ell(CX-fx,fcy,frx,fry,1);
      if(t.feet==='hooves') for(let y=GY-1;y<=GY;y++) for(let x=0;x<17;x++) if(get(x,y)===1 && Math.abs(x-(CX-fx))<=frx+0.5) putM(x,y,10);
      if(t.feet==='claws'){putM(CX-fx-frx*0.55,GY,7); putM(CX-fx+frx*0.55,GY,7); if(n>=26) putM(CX-fx,GY,7);}}
    if(t.feet==='thin'){const lx=CX-L.rx*0.35; line(lx,L.bottom-1,lx,GY,7); if(n>=26) line(lx+1,L.bottom-1,lx+1,GY,7); putM(lx-1,GY,7); putM(lx+(n>=26?2:1),GY,7);}
    if(t.feet==='insect_legs'){for(let k=0;k<3;k++){const sy=L.cy-L.h*0.15+k*L.h*0.22, sx=CX-L.rx*0.7, kx=CX-L.rx-n*(0.08+0.05*k), ky=sy-n*0.06, ex=CX-L.rx-n*(0.03+0.07*k);
      line(sx,sy,kx,ky,7); line(kx,ky,ex,GY,7);}}
    if(t.feet==='tentacles'){const cnt=n<20?2:3, w=n>=20?2:1; for(let k=0;k<cnt;k++){const off=L.rx*(0.25+0.55*k/Math.max(1,cnt-1));
      for(let y=Math.floor(L.bottom-2);y<=GY;y++){const x=Math.round(CX-off+Math.sin(y*0.9+k*1.7)*0.7); for(let j=0;j<w;j++) putM(x+j,y,y>=GY-1?2:1);}}}
    if(t.feet==='webbed'){const lx=CX-fx; line(lx,L.bottom-1,lx,GY-1,1); line(lx+1,L.bottom-1,lx+1,GY-1,1); ell(lx-0.3,GY-0.2,Math.max(1.5,n*0.1),1,2);}
    if(t.feet==='coil'){const cy=GY-feetH*0.5; ell(CX,cy,L.rx*1.12,feetH*0.6+0.4,1); for(let x=0;x<F;x++) if(get(x,Math.round(cy))===1 && Math.abs(x-CX)>L.rx*0.5) put(x,Math.round(cy),10); ell(CX+L.rx*1.18,GY-0.4,Math.max(1,n*0.05),0.8,1,{mirror:false});}
    if(t.feet==='roots'){line(CX-L.rx*0.3,L.bottom-1,CX-L.rx*0.6,GY,7); line(CX-L.rx*0.1,L.bottom-1,CX-L.rx*0.15,GY,7); line(CX-L.rx*0.48,GY-1,CX-L.rx*0.82,GY,7);}
  }
  // body
  const cyB = L.cy + 0.3, ryB = L.h/2;
  if(t.plan==='split'){
    if(t.body==='trio'){const off=L.rx*0.55, crx=Math.min(L.rx*0.42, off-1.3); piece(CX-off,L.cy,crx,L.h/2,1);}
    else {piece(CX,L.bcy,L.brx,L.bry,1); piece(CX,L.cy,L.rx,L.h/2,1);}
  }
  else if(t.body==='egg'||t.body==='pear'){const a0=t.body==='pear'?0.56:0.74; fill(CX-L.rx-1,L.top-1,CX+L.rx+1,L.bottom+1,(x,y)=>{const k=clamp((y-L.top)/L.h,0,1), rx=L.rx*(a0+(1-a0)*Math.sqrt(k));return ((x-CX)/rx)**2+((y-cyB)/ryB)**2<=1;},1);}
  else if(t.body==='block'){const c=Math.max(1,Math.round(L.rx*0.38)); fill(CX-L.rx-1,L.top-1,CX+L.rx+1,L.bottom+1,(x,y)=>{const dx=Math.abs(x-CX); if(dx>L.rx||y<L.top||y>L.bottom) return false;
      const a=dx-(L.rx-c), b=(L.top+c)-y; if(a>0&&b>0&&a+b>c) return false; const b2=y-(L.bottom-1); if(a>0&&b2>0&&a+b2>1.2) return false; return true;},1);}
  else if(t.body==='blob'){fill(CX-L.rx-1,L.top-1,CX+L.rx+1,L.bottom+1,(x,y)=>{if(((x-CX)/L.rx)**2+((y-cyB)/ryB)**2>1) return false; return !(y>=Math.round(L.bottom)-0 && Math.floor(Math.abs(x-CX))%3===1);},1);}
  else if(t.body==='segment'){ell(CX,L.cy+L.h*0.18,L.rx,L.h*0.36,1); const ty=L.top+L.h*0.26; ell(CX,ty,L.rx*0.8+1,L.h*0.3+1,12,{only:onSolid}); ell(CX,ty,L.rx*0.8,L.h*0.3,1);}
  else ell(CX,cyB,L.rx,ryB,1);

  // side parts over the body
  if(stage>=2){
    if(t.sides==='arms'){const ax=CX-L.rx*0.92, ay=L.cy+L.h*(t.plan==='merged'?0.12:0.05), arx=Math.max(1,n*0.07), ary=Math.max(1.3,n*0.11);
      ell(ax,ay,arx+1,ary+1,12,{only:onSolid}); ell(ax,ay,arx,ary,1);}
    if(t.sides==='armsup'){const ax=CX-L.rx*0.98, ay=L.top+L.h*0.12, ra=Math.max(1.4,n*0.13), rb=Math.max(0.8,n*0.06); rell(ax,ay,ra+1,rb+1,1.1,12,{only:onSolid}); rell(ax,ay,ra,rb,1.1,1);}
    if(t.sides==='stubwings') rell(CX-L.rx-n*0.01,L.top+L.h*0.28,n*0.1,n*0.05,0.9,2);
    if(t.sides==='pincers'){const cx=CX-L.rx-n*0.08, cy=L.cy-L.h*0.12, r=Math.max(1.2,n*0.085); line(CX-L.rx*0.8,L.cy,cx+r*0.3,cy+r*0.5,2); ell(cx,cy,r,r*0.95,2); tri(cx+0.3,cy,cx-r*1.5,cy-r*1.3,cx+r*0.5,cy-r*1.5,0);}
    if(t.sides==='motes'){const a=Math.max(.8,n*0.045), b=Math.max(.6,n*0.03); ell(CX-L.rx-n*0.12,L.cy,a,a,2); ell(CX-L.rx-n*0.05,L.top-n*0.04,b,b,8);}
    if(t.sides==='fists') piece(CX-L.rx-n*0.13,L.cy+L.h*0.05,Math.max(1,n*0.075),Math.max(1,n*0.075),1,{tip:0.4});
    if(t.sides==='fins') rell(CX-L.rx-n*0.02,L.cy+L.h*0.05,n*0.13,n*0.055,-0.6,2);
    if(t.sides==='leaves') rell(CX-L.rx-n*0.04,L.cy,n*0.15,n*0.065,0.35,2);
  }
  // pattern
  if(stage>=3 && t.pattern!=='none'){
    const p=t.pattern, mat={belly:3,scales:10,facets:3,freckles:10,flicker:14,waves:3,cracks:10,swirl:3}[p] || t.patMat;
    const rs=stream(t.gtin,'spots'), spots=[];
    const patches=[]; if(p==='patches'){const k=n<20?2:3; for(let i=0;i<k;i++) patches.push([CX+(rs()*2-1)*L.rx*0.7, L.top+L.h*(0.2+rs()*0.65), 1.2+rs()*n/12]);}
    if(p==='spots'){const k=n<20?2:n<28?3:4; for(let i=0;i<k;i++) spots.push([rs()*L.rx*0.85, L.top+L.h*(0.15+rs()*0.7), 0.7+rs()*(n/26)]);}
    for(let y=Math.floor(L.top-1);y<=Math.ceil((L.patBottom||L.bottom)+1);y++) for(let x=0;x<F;x++){
      if(get(x,y)!==1) continue; const dx=Math.abs(x-CX), fy=(y-L.top)/L.h; let hit=false;
      if(p==='belly') hit=(dx/(L.rx*0.58))**2+((y-(L.cy+L.h*0.15))/(L.h*0.4))**2<=1;
      else if(p==='stripes') hit=(Math.round(y-L.top)%3===1)&&(t.stripeFull||dx>L.rx*0.4);
      else if(p==='spots') hit=spots.some(s=>(dx-s[0])**2+(y-s[1])**2<=s[2]**2);
      else if(p==='scales') hit=(y%2===0)&&((Math.floor(dx)+Math.floor(y/2))%2===0);
      else if(p==='facets') hit=((Math.floor(dx)+y)%4===0);
      else if(p==='freckles') hit=hash32(t.gtin+':f:'+Math.floor(dx)+','+y)%100<14;
      else if(p==='gradient') hit=fy>0.55;
      else if(p==='patches') hit=patches.some(s=>(x-s[0])**2+(y-s[1])**2<=s[2]**2);
      else if(p==='chevrons') hit=((Math.floor(y+dx*0.9-L.top))%4+4)%4===0;
      else if(p==='flicker') hit=(dx/(L.rx*0.45))**2+((y-(L.cy+L.h*0.15))/(L.h*0.38))**2<=1;
      else if(p==='waves') hit=((y+Math.round(Math.sin(dx*1.1)))%4+4)%4===0;
      else if(p==='cracks'){const z=((y%4)+4)%4, zz=z<2?z:4-z; hit=Math.abs(dx-(L.rx*0.35+zz))<0.6;}
      else if(p==='swirl'){const a=Math.atan2(y-L.cy,dx), d=Math.hypot(dx,y-L.cy); hit=((Math.floor(a*1.6+d*0.8))%3+3)%3===0;}
      else if(p==='centerline') hit=dx<Math.max(1,L.rx*0.2)&&fy>0.1;
      if(hit) G[y*F+x]=mat;
    }
  }
  if(stage>=2){
    if(t.back==='moss'){ell(CX-L.rx*0.55,L.top+L.h*0.12,Math.max(1,n*0.09),Math.max(.8,n*0.055),2); ell(CX-L.rx*0.2,L.top+L.h*0.04,Math.max(.8,n*0.06),Math.max(.6,n*0.04),2);}
    if(t.back==='geode'){const gx=CX-L.rx*0.72, gy=L.top+L.h*(t.plan==='merged'?0.5:0.22); tri(gx-1.5,gy+1,gx+1.5,gy+1,gx-n*0.05,gy-n*0.14,2); tri(gx+0.5,gy+1,gx+2.5,gy+1,gx+1.8,gy-n*0.08,2);}
  }
  // head
  if(t.plan==='headed'){ell(CX,L.hcy,hx+1,hy+1,12,{only:onSolid}); ell(CX,L.hcy,hx,hy,1);}
  else if(t.plan==='split') piece(CX,L.hcy,hx,hy,1,{tip:1});

  // toppers
  if(stage>=2){
    switch(t.topper){
      case 'ears_pointed':{const ax=CX-hx*0.95, ay=HT+hy*0.55, bx=CX-hx*0.2, by=HT+hy*0.3, px=CX-hx*0.8, py=HT-th;
        tri(ax,ay,bx,by,px,py,1); const gx=(ax+bx+px)/3, gy=(ay+by+py)/3, s=0.5; tri(gx+(ax-gx)*s,gy+(ay-gy)*s,gx+(bx-gx)*s,gy+(by-gy)*s,gx+(px-gx)*s,gy+(py-gy)*s+0.4,2); break;}
      case 'ears_round':{const ex=CX-hx*0.72, ey=HT+hy*0.02; ell(ex,ey,hx*0.36,hx*0.36,1); ell(ex,ey,hx*0.2,hx*0.2,2); break;}
      case 'horns':{const x0=CX-hx*0.45, y0=HT+1, len=th+1; for(let i=0;i<=len;i++){const k=i/len, x=x0-k*k*hx*0.55, y=y0-i; putM(x,y,7); if(k<0.55) putM(x+1,y,7);} break;}
      case 'antennae':{const x0=CX-hx*0.3, y0=HT+1, x1=CX-hx*0.85, y1=HT-th; line(x0,y0,x1,y1,5); const r=n>=20?1.1:.6; ell(x1,y1,r,r,2); break;}
      case 'crest':{const k2=n>=20?2:1; for(let k=0;k<=k2;k++){const x=17-k, h=th+1-k*Math.max(1,Math.round(th/3)); for(let y=HT+1;y>=HT+1-h;y--) putM(x,y,2);} break;}
      case 'antlers':{const x0=CX-hx*0.35, y0=HT+1, x1=CX-hx*0.95, y1=HT-th; line(x0,y0,x1,y1,7); const mx=(x0+x1)/2, my2=(y0+y1)/2; line(mx,my2,mx+hx*0.15,y1-0.5,7); if(n>=26) line(x1,y1,x1-1,y1-1,7); break;}
      case 'unicorn': tri(CX-1.6,HT+1.5,CX+1.6,HT+1.5,CX,HT-th*1.2,7); if(n>=20) for(let y=Math.round(HT-1);y>HT-th;y-=2) putM(17,y,3); break;
      case 'longears':{const ex=CX-hx*0.45, ey=HT-th*0.3; rell(ex,ey,th*0.85,Math.max(0.9,n*0.055),1.35,1); rell(ex,ey+0.5,th*0.6,Math.max(0.55,n*0.025),1.35,2); break;}
      case 'cowlick':{ell(CX,HT+0.3,1.4,1.1,1); const tx=18+Math.max(1,th*0.4); line(18,HT-0.5,tx,HT-th*0.75,1,false); put(tx-1,HT-th*0.75-1,1); break;}
      case 'sprout':{line(17,HT+1,17,HT-th*0.6,7); rell(CX-1.8,HT-th*0.75,Math.max(1.2,th*0.4),Math.max(0.6,th*0.18),0.45,2); break;}
      case 'droplet':{const cy=HT-th*0.35, r=th*0.32+0.3; ell(CX,cy,r,r,2); tri(CX-r*0.85,cy-0.2,CX+r*0.85,cy-0.2,CX,cy-r-th*0.5,2); break;}
      case 'wisps': line(CX-hx*0.3,HT+0.5,CX-hx*0.75,HT-th*0.6,3); line(CX-hx*0.75,HT-th*0.6,CX-hx*0.45,HT-th,3); break;
      case 'tufts': tri(CX-hx*0.95,HT+hy*0.4,CX-hx*0.45,HT+hy*0.1,CX-hx*1.0,HT-th*0.7,1); break;
      case 'spines': tri(CX-1.5,HT+1,CX+1.5,HT+1,CX,HT-th*0.8,7); tri(CX-hx*0.65,HT+hy*0.25,CX-hx*0.25,HT+1,CX-hx*0.5,HT-th*0.45,7); break;
      case 'fin_dorsal': tri(CX-hx*0.4,HT+2,CX+hx*0.4,HT+2,CX,HT-th,2); break;
      case 'lure': line(17,HT+1,17,HT-th+1,7); ell(CX,HT-th,1.3,1.1,8); break;
      case 'fronds': for(let k=0;k<3;k++){const a=-0.9+k*0.55, sx=CX-hx*0.85, sy=HT+hy*0.6, len=th*0.9, ex=sx-Math.cos(a)*len, ey=sy+Math.sin(a)*len; line(sx,sy,ex,ey,2); putM(ex,ey,3);} break;
      case 'leaves': rell(CX-hx*0.38,HT-th*0.35,th*0.6,Math.max(0.8,th*0.28),1.0,2); putM(17,HT,10); break;
      case 'mushroom':{const cy=HT+hy*0.4, rx=hx*1.35, ry=hy*0.8+th*0.4, cut=HT+hy*0.42;
        fill(CX-rx-1,cy-ry-1,CX+rx+1,cut,(x,y)=>((x-CX)/rx)**2+((y-cy)/ry)**2<=1&&y<=cut,2);
        ell(CX-rx*0.5,cy-ry*0.45,0.8+n/40,0.7+n/50,4); ell(CX,cy-ry*0.82,0.8+n/40,0.6+n/60,4); break;}
      case 'bloom':{const cy=HT-th*0.15; ell(CX,cy-th*0.45,th*0.42,th*0.42,2); ell(CX-th*0.6,cy,th*0.4,th*0.36,2); ell(CX,cy,th*0.32,th*0.32,14); break;}
      case 'crystals':{for(let y=HT+2;y>=HT-th;y--) putM(17,y,2); if(n>=26) for(let y=HT+2;y>=HT-th+2;y--) putM(16,y,2);
        line(CX-hx*0.55,HT+hy*0.3,CX-hx*0.85,HT-th*0.55,2); if(n>=20) line(CX-hx*0.55+1,HT+hy*0.3,CX-hx*0.85+1,HT-th*0.55,2); break;}
      case 'halo':{const cy=HT-th*0.6, rx=hx*0.75, ry=Math.max(1,th*0.28);
        fill(CX-rx-1,cy-ry-1,CX+rx+1,cy+ry+1,(x,y)=>((x-CX)/rx)**2+((y-cy)/ry)**2<=1&&((x-CX)/(rx-1.2))**2+((y-cy)/Math.max(.4,ry-.9))**2>1,8); break;}
      case 'flame': tri(CX-hx*0.42,HT+2,CX+hx*0.42,HT+2,CX,HT-th*1.1,8); tri(CX-hx*0.5,HT+1,CX-hx*0.25,HT+1,CX-hx*0.58,HT-th*0.5,8); tri(CX-hx*0.2,HT+2,CX+hx*0.2,HT+2,CX,HT-th*0.45,14); break;
    }
  }
  // face
  if(stage>=3){
    const e = n<=14?1:n<=26?2:3;
    let eyeY = Math.round(L.hcy - L.hry*0.35), eyeH = e+1;
    const w = t.eyes==='dot' ? e : e+1;
    let lx = Math.round(CX - hx*0.5 - (w-1)/2); const inner = 16 - (n>=26?1:0); if(lx+w-1>inner) lx = inner-w+1;
    if(t.cheeks==='mask') for(let y=eyeY-1;y<=eyeY+e+1;y++) for(let x=0;x<F;x++){const m=get(x,y); if((m===1||m===3||m===10) && Math.abs(x-CX)<=hx*0.95) G[y*F+x]=10;}
    switch(t.eyes){
      case 'happy': for(let i=0;i<e+1;i++) putM(lx+i,eyeY+((i===0||i===e)?1:0),5); eyeH=e; break;
      case 'tiny': rect(lx,eyeY,e+1,e+1,4); putM(lx+e,eyeY+Math.floor((e+1)/2),5); break;
      case 'visor': for(let y=eyeY;y<eyeY+e;y++) for(let x=lx-1;x<=17;x++) putM(x,y,14); putM(lx,eyeY,11); eyeH=e; break;
      case 'triclops': rect(lx,eyeY+1,e,e,5); ell(CX,eyeY-1.2,1.3,1.0,4); putM(17,Math.round(eyeY-1.2),5); eyeH=e+1; break;
      case 'dot': rect(lx,eyeY,e,e,5); eyeH=e; break;
      case 'big': rect(lx,eyeY,e+1,e+1,4); rect(lx+1,eyeY+1,e,e,5); if(e>=2) putM(lx+1,eyeY+1,11); break;
      case 'slit':{rect(lx,eyeY,e+1,e+1,14); const col=lx+Math.floor((e+1)/2); for(let y=eyeY;y<eyeY+e+1;y++) putM(col,y,5); break;}
      case 'sleepy': rect(lx,eyeY+Math.floor(e/2),e+1,1,5); eyeH=Math.floor(e/2)+1; break;
      case 'compound':{const ex=CX-hx*0.68, cy=eyeY+e/2; ell(ex,cy,e*0.6+0.5,e*0.85+0.6,5); putM(ex-e*0.3,cy-e*0.45,11); eyeH=e+2; break;}
      case 'cyclops':{const cr=e+0.9, cy=eyeY+e/2; ell(CX,cy,cr+0.3,cr,4); ell(CX,cy+0.3,cr*0.55,cr*0.6,5); if(e>=2) putM(17,cy-cr*0.35,11); eyeY=Math.round(cy-cr); eyeH=Math.ceil(cr*2); break;}
    }
    let my = Math.max(Math.round(L.hcy + L.hry*0.45), eyeY + eyeH + 2);
    const mw = Math.max(1, Math.round(n/11));
    const smileLine = () => {for(let i=0;i<mw;i++) putM(17-i,my,5); putM(17-mw,my-1,5);};
    switch(t.mouth){
      case 'tongue': smileLine(); putM(17,my+1,16); break;
      case 'buck': smileLine(); putM(17,my+1,4); if(n>=20) putM(17,my+2,4); break;
      case 'tusks': smileLine(); putM(17-mw-1,my,4); putM(17-mw-1,my-1,4); if(n>=20) putM(17-mw-1,my-2,4); break;
      case 'smile': for(let i=0;i<mw;i++) putM(17-i,my,5); putM(17-mw,my-1,5); break;
      case 'fangs': for(let i=0;i<mw;i++) putM(17-i,my,5); putM(17-mw,my-1,5); putM(17-mw+1,my+1,4); break;
      case 'open': ell(CX,my+0.3,mw*0.8+0.2,0.9+(n>=26?0.4:0),5); break;
      case 'beak':{const bw=Math.max(1.2,hx*0.32); tri(CX-bw,my-1.5,CX+bw,my-1.5,CX,my+bw*0.9,7); break;}
      case 'mandibles':{const y0=Math.round(L.hcy+L.hry*0.75); line(CX-mw-1.5,y0,CX-1.5,y0+Math.max(2,Math.round(n/9)),7); break;}
      case 'grill': rect(17-mw,my,mw+1,2,4); for(let i=1;i<=mw;i+=2){putM(17-i,my,5); putM(17-i,my+1,5);} break;
    }
    const skin = m => m===1||m===3||m===10;
    const putS = (x,y,v) => {x=Math.round(x);y=Math.round(y); if(skin(get(x,y))) put(x,y,v); const mx=F-1-x; if(skin(get(mx,y))) put(mx,y,v);};
    const cy2 = eyeY + eyeH + (n>=20?1:0), bx = CX-hx*0.66;
    switch(t.cheeks){
      case 'blush': putS(bx,cy2,16); if(n>=20) putS(bx+1,cy2,16); if(n>=26) putS(bx-1,cy2,16); break;
      case 'whiskers': line(CX-hx*0.55,my-1,CX-hx*1.2,my-2,5); if(n>=20) line(CX-hx*0.55,my,CX-hx*1.2,my+1,5); break;
      case 'warpaint': putS(lx,cy2,2); putS(lx,cy2+1,2); if(n>=20){putS(lx+2,cy2,2); putS(lx+2,cy2+1,2);} break;
      case 'cheekdots': putS(bx,cy2,10); if(n>=20){putS(bx+2,cy2,10); putS(bx+1,cy2+1,10);} break;
      case 'gillslits': for(let k=0;k<(n>=20?3:2);k++){const gx=CX-hx*0.95+k*1.6; putS(gx,my-1,10); putS(gx,my,10);} break;
      case 'gem': putS(17,eyeY-2,14); if(n>=20){putS(17,eyeY-3,14); putS(16,eyeY-2,14);} break;
    }
  }
  // outline
  if(stage>=4){
    const add=[];
    for(let y=0;y<F;y++) for(let x=0;x<F;x++){const m=G[y*F+x]; if(m!==0&&m!==9) continue;
      if(onSolid(get(x-1,y))||onSolid(get(x+1,y))||onSolid(get(x,y-1))||onSolid(get(x,y+1))) add.push(y*F+x);}
    for(const i of add) G[i]=12;
  }
  // rarity effects
  if(stage>=5){
    const R = RARITY[t.rarity];
    if(R.glow){const add=[]; for(let y=0;y<F;y++) for(let x=0;x<F;x++){const m=G[y*F+x]; if(m!==0&&m!==9) continue;
      let near=false; for(let dy=-1;dy<=1&&!near;dy++) for(let dx=-1;dx<=1;dx++) if(get(x+dx,y+dy)===12){near=true;break;} if(near) add.push(y*F+x);} for(const i of add) G[i]=13;}
    if(R.sparkles){const rs=stream(t.gtin,'sparkle'); let placed=0;
      for(let tries=0;tries<400&&placed<R.sparkles;tries++){const x=1+Math.floor(rs()*(F-2)), y=1+Math.floor(rs()*(GY-2));
        let ok=true, near=false; for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){const m=get(x+dx,y+dy); if(m!==0) {ok=false;}}
        for(let dy=-5;dy<=5&&!near;dy++) for(let dx=-5;dx<=5;dx++) if(onSolid(get(x+dx,y+dy))&&get(x+dx,y+dy)!==11&&get(x+dx,y+dy)!==15){near=true;break;}
        if(!ok||!near) continue; put(x,y,11); if(n>=20){put(x-1,y,15);put(x+1,y,15);put(x,y-1,15);put(x,y+1,15);} placed++;}}
  }
  return G;
}

/* ---------- rendering ---------- */
const towards = (h,tg,amt) => {const d=((tg-h+540)%360)-180; return (h+Math.sign(d)*Math.min(Math.abs(d),amt)+360)%360;};
const css = c => `hsl(${c[0].toFixed(1)}, ${clamp(c[1],0,100).toFixed(1)}%, ${clamp(c[2],2,98).toFixed(1)}%)`;
const hiC = c => css([towards(c[0],55,10), c[1]+4, c[2]+13]);
const loC = c => css([towards(c[0],245,12), c[1]+6, c[2]-14]);
function render(cv, t, {stage=9, scale=6} = {}){
  const G = build(t, stage), P = t.pal, shade = stage>=4;
  cv.width = cv.height = F*scale;
  const ctx = cv.getContext('2d'); ctx.clearRect(0,0,cv.width,cv.height);
  const ramp = {1:[css(P.base),hiC(P.base),loC(P.base)], 2:[css(P.accent),hiC(P.accent),loC(P.accent)], 7:[css(P.bone),hiC(P.bone),loC(P.bone)]};
  const flat = {16:css(P.blush),3:css(P.light),4:css(P.eyeW),5:css(P.pupil),8:css(P.glow),9:css(P.outline),10:css(P.dark),11:'#FFFBEA',12:css(P.outline),13:css(P.glow),14:css(P.iris),15:css(P.glow)};
  const alpha = {8:.82,9:.28,13:.45,15:.75,16:.9};
  const empty = m => m===0||m===9||m===12||m===13;
  for(let y=0;y<F;y++) for(let x=0;x<F;x++){
    const m = G[y*F+x]; if(!m) continue;
    let col;
    if(ramp[m]){
      const r = ramp[m];
      if(!shade) col = r[0];
      else {const up=y>0?G[(y-1)*F+x]:0, dn=y<F-1?G[(y+1)*F+x]:0, lf=x>0?G[y*F+x-1]:0, rt=x<F-1?G[y*F+x+1]:0;
        col = empty(up)?r[1] : empty(dn)?r[2] : empty(lf)?r[1] : empty(rt)?r[2] : r[0];}
    } else col = flat[m];
    ctx.globalAlpha = alpha[m] || ((P.ghost && (m===1||m===3)) ? 0.85 : 1); ctx.fillStyle = col; ctx.fillRect(x*scale,y*scale,scale,scale);
  }
  ctx.globalAlpha = 1;
}
/* ---- frozen: end ---- */

root.CM = {GEN, F, hash32, mulberry, stream, checkDigit, normalize, randomUPC, upcOf,
  SIZES, RARITY, DOMAINS, LABELS, lab, roll, build, palFrom, render};
})(typeof window !== 'undefined' ? window : globalThis);
