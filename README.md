# لقطة (Luqta)

Fully offline-capable wishlist & product comparison PWA. Share or paste a product URL/text; specs are extracted on-device. **No AI CDNs or third-party APIs** — fetching the product link you shared is allowed.

**Live:** https://amr-hash.github.io/Luqta/

## Stack

- React + Vite + TypeScript + Tailwind CSS v4 (RTL via `dir` + logical properties)
- Dexie.js (IndexedDB)
- Local rule-based extractor (no WebLLM)
- May fetch the **product URL you shared** to read title/price (blocked by some shops via CORS — use the browser extension then)
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

After the first visit, the service worker caches the app shell. Opening a saved product’s “source” link is user-initiated. Product-page fetch is only for the URL you add — not an AI/analytics service.

## Scripts

| Command           | Purpose                          |
| ----------------- | -------------------------------- |
| `npm run dev`     | Local development                |
| `npm run build`   | Typecheck + production build     |
| `npm run preview` | Preview production build         |
