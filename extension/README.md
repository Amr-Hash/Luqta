# Luqta browser extension

Chrome / Edge (Manifest V3) helper: send the current product page to Luqta.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Pin **Luqta** in the toolbar

## Use

- Click the toolbar icon on a product page
- Or right-click → **Add page to Luqta**
- Or press `Alt+Shift+L`

It opens your Luqta app at `/share` with `url`, `title`, and page description / selection so extraction can run.

## Options

Right-click the extension → **Options** to change the Luqta base URL (default: `https://amr-hash.github.io/Luqta`). For local dev use `http://localhost:5173`.
