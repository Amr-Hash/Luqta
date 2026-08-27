# Luqta browser extension

Chrome / Edge (Manifest V3): **Add** the current product page to Luqta in one click.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Pin **Luqta**

For local Luqta use Options → `http://localhost:5174` (or your Vite port).

Paste a product URL in Luqta with the extension enabled: a mini capture browser opens and the extension loads the shop page in a background tab to read title/price (avoids CORS).

## Use

- **Toolbar:** click Luqta → **＋ Add to Luqta**
- **On the page:** floating **＋ Add to Luqta** button (bottom-right)
- Right-click → **Add to Luqta**
- Shortcut: `Alt+Shift+L`

Opens your Luqta app at `/share` with title, price hint, and page text so extraction can run (avoids CORS).
