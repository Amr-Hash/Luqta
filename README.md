# لقطة (Luqta)

Local-first wishlist & product comparison PWA. Share or paste a product URL/text; extract specs on-device (WebLLM + WebGPU when available, rules otherwise). May fetch the product link you shared. Data stays in IndexedDB.

**Live:** https://amr-hash.github.io/Luqta/

## Stack

- React + Vite + TypeScript + Tailwind CSS v4 (RTL via `dir` + logical properties)
- Dexie.js (IndexedDB)
- `@mlc-ai/web-llm` — `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` (needs **WebGPU**; model weights from AI CDN once)
- Local rule-based fallback extractor
- `vite-plugin-pwa` — manifest + Web Share Target
- i18next — Arabic (default, RTL) & English (LTR)

## Browser extension

Load `extension/` as an unpacked Chrome/Edge extension to add the current tab to Luqta in one click (see `extension/README.md`).

## Develop

```bash
npm install
npm run dev
```

Dev/preview set COOP/COEP for WebGPU. GitHub Pages cannot set those headers, so the model may fall back to basic extraction there — use `npm run preview` or a host that allows COOP/COEP for full AI.

Production builds for GitHub Pages use `BASE_PATH=/Luqta/`.

## Scripts

| Command           | Purpose                      |
| ----------------- | ---------------------------- |
| `npm run dev`     | Local development            |
| `npm run build`   | Typecheck + production build |
| `npm run preview` | Preview production build     |
