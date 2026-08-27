# لقطة (Luqta)

Fully offline wishlist & product comparison PWA. Share or paste a product URL/text; specs are extracted **on-device** from that content only (no AI CDN, no page scraping). Data stays in IndexedDB.

**Live:** https://amr-hash.github.io/Luqta/

## Stack

- React + Vite + TypeScript + Tailwind CSS v4 (RTL via `dir` + logical properties)
- Dexie.js (IndexedDB)
- Local rule-based extractor (no WebLLM / no WebGPU)
- `vite-plugin-pwa` — manifest + Web Share Target
- i18next — Arabic (default, RTL) & English (LTR)

## Browser extension

Load `extension/` as an unpacked Chrome/Edge extension to add the current tab to Luqta in one click (see `extension/README.md`).

## Develop

```bash
npm install
npm run dev
```

Production builds for GitHub Pages use `BASE_PATH=/Luqta/`.

After the first visit, the service worker caches the app shell so the PWA can run offline. Opening a saved product’s “source” link is the only intentional navigation off-site (user-initiated).

## Scripts

| Command           | Purpose                          |
| ----------------- | -------------------------------- |
| `npm run dev`     | Local development                |
| `npm run build`   | Typecheck + production build     |
| `npm run preview` | Preview production build         |
