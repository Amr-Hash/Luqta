# لقطة (Luqta)

Local-first AI wishlist & product comparison PWA. Share a product URL into the app; it extracts specs in-browser with WebLLM, stores them in IndexedDB, and compares items side by side.

**Live:** https://amr-hash.github.io/Luqta/

## Stack

- React + Vite + TypeScript + Tailwind CSS v4 (RTL via `dir` + logical properties)
- Dexie.js (IndexedDB)
- `@mlc-ai/web-llm` — `Qwen2.5-1.5B-Instruct-q4f16_1-MLC`
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

WebGPU is required for the full on-device model. Without it, Luqta falls back to lightweight heuristic extraction so the flow still works.

> Note: “Local-first” means your wishlist data and (when WebGPU works) model inference stay on-device. The app shell and the WebLLM library still download once over the network, then cache. GitHub Pages also cannot set COOP/COEP headers, so on-device WebLLM may be limited there; heuristic extract, wishlist, and compare still work.

## PWA / Share Target

Install the app (Add to Home Screen). Shared links land on `/share?title=&text=&url=` via the manifest `share_target`.

COOP/COEP headers are enabled so SharedArrayBuffer / WebLLM can run.

## Scripts

| Command        | Purpose              |
| -------------- | -------------------- |
| `npm run dev`  | Local development    |
| `npm run build`| Typecheck + production build |
| `npm run preview` | Preview production build |
