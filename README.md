# Consumonsters

Scan a product barcode and it hatches a pixel creature. Every barcode always hatches the same creature, for everyone who scans it. Catch them all from your pantry.

The app is a static web page with no build step and no server. It installs to a phone's home screen and works offline.

## Play it

Once GitHub Pages is on (see below), open the site on your phone and tap **Scan a barcode**.

- **iPhone:** open it in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open it in Chrome and tap **Install app** (or the menu, then **Add to Home screen**).

The camera needs HTTPS, which GitHub Pages provides. If the live camera isn't allowed, the app falls back to taking a photo of the barcode, and you can always type the number.

## Turn on GitHub Pages

1. Go to **Settings → Pages** in this repo.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**, pick `main` and `/ (root)`, and save.
3. After a minute the site is live at `https://huntersfeld.github.io/Consumonsters/`.

## Run it locally

```sh
npm run serve        # then open http://localhost:8080
npm test             # checks that the generator hasn't changed
```

Phones only allow the camera over HTTPS, so to test scanning on a phone use the Pages site.

## How it works

| File | What it does |
| --- | --- |
| `src/engine.js` | The creature generator from the design spec: barcode to traits to sprite. Seed version `cm-v1`. |
| `src/app.js` | Scanning (live camera, photo or typed), the hatch screen and the collection. |
| `src/personality.js` | Each creature's temperament (energy, boldness, sociability, playfulness, focus, and one word such as Shy or Zippy), rolled from its own seed so looks never change. Frozen once shipped, like the generator. |
| `src/bond.js` | Friendship: 0 to 5 hearts per creature, earned by petting, answering calls, being watched and being scanned again, each capped per day. Saved in this browser under its own key; hearts never drain. |
| `src/hats.js` | Sixteen pixel hats, drawn in the sprites' style and sized to each creature's head so one hat fits a Small and an XL. A hat is drawn on top of the sprite, never baked in. A few toppers get in the way (a mushroom cap only takes a bow or flowers; halos and flames block tall hats). |
| `src/rewards.js` | The hats you've earned and who's wearing what. Hats unlock from collecting (your first creature, the first of each domain, 10/25/50 caught), rare finds (an Epic or rarer) and friendship (3 hearts, a best friend). Earned once and kept; saved in this browser under its own key. |
| `src/pasture-scene.js` | The Home tab's scenery: a wide pixel meadow (640 × 200) with a winding stream, two trees, a fence and grass that blows in the wind. It follows the phone's clock through dawn, day, dusk and night (around 6am and 7pm), with a painted sky for each; night brings stars, a moon on the stream and fireflies. Add `?hour=21` to the URL to preview any time of day. |
| `src/pasture.js` | The creatures in the meadow and the view onto it. Creatures get around in a way that fits their feet (six legs scurry, hooves bound, roots shuffle, floaters drift); tap empty grass to call them over, and they notice and arrive one by one. Whether one comes depends on its personality: shy ones back off, stubborn ones stay put, and calling again wins some over. Left alone they nap under trees (most of them doze off at night), chase butterflies (fireflies after dark), play tag and wander over to friends. Press and hold a creature (or use Pet in its label) to pet it, and use Hat in its label to dress it up; friendlier creatures answer calls more often, follow your finger after a pet, and say hello when you open the pasture. The toy tray under the pasture holds a ball to throw (playful ones chase it, and good friends bring it back) and treats to drop (earned by scanning; shy ones warm up fastest with them). Floaters drift over the stream, aquatic creatures swim it and winged ones hop across; the rest stay on their own bank. The pasture fills a desktop window; on narrower screens you drag sideways to look around, or tap a face in the row below to jump to that creature. It only draws creatures, so it never changes them. |
| `vendor/zxing-library-0.21.3.min.js` | Barcode decoding for browsers without the built-in BarcodeDetector, such as iPhone Safari. Apache 2.0. |
| `sw.js`, `manifest.webmanifest`, `icons/` | What makes it installable and work offline. |
| `tests/` | Locks the generator so creatures can't change by accident. |

A barcode is normalized to a 14-digit GTIN (UPC-E is expanded first), checked against its check digit, then each trait rolls from its own seeded random stream. Rarity is rolled in the app for now. The collection is saved in the phone's browser.

## The generator is frozen

Changing any weight, option or palette in `src/engine.js` changes creatures people have already caught. The tests fail if that happens. New content should ship under a new seed version (`cm-v2`) rather than by editing `cm-v1`. Only regenerate `tests/golden.json` (`node tests/make-golden.mjs`) as part of a deliberate new seed version. Personalities are locked the same way by `tests/personality-golden.json`.

When you change any shipped file, bump `VERSION` in `sw.js` so installed copies update.
