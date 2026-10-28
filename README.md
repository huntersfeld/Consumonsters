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
| `vendor/zxing-library-0.21.3.min.js` | Barcode decoding for browsers without the built-in BarcodeDetector, such as iPhone Safari. Apache 2.0. |
| `sw.js`, `manifest.webmanifest`, `icons/` | What makes it installable and work offline. |
| `tests/` | Locks the generator so creatures can't change by accident. |

A barcode is normalized to a 14-digit GTIN (UPC-E is expanded first), checked against its check digit, then each trait rolls from its own seeded random stream. Rarity is rolled in the app for now. The collection is saved in the phone's browser.

## The generator is frozen

Changing any weight, option or palette in `src/engine.js` changes creatures people have already caught. The tests fail if that happens. New content should ship under a new seed version (`cm-v2`) rather than by editing `cm-v1`. Only regenerate `tests/golden.json` (`node tests/make-golden.mjs`) as part of a deliberate new seed version.

When you change any shipped file, bump `VERSION` in `sw.js` so installed copies update.
