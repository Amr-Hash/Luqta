;(() => {
  function isLuqtaApp() {
    const host = location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return true
    if (host === 'amr-hash.github.io' && location.pathname.startsWith('/Luqta')) {
      return true
    }
    return false
  }

  /** Bridge: Luqta web app ↔ extension (paste URL → open & scrape). */
  if (isLuqtaApp()) {
    if (window.__luqtaBridgeInstalled) return
    window.__luqtaBridgeInstalled = true

    window.addEventListener('message', (event) => {
      if (event.source !== window) return
      const data = event.data
      if (!data || data.source !== 'luqta-app') return

      if (data.type === 'LUQTA_PING') {
        window.postMessage(
          { source: 'luqta-extension', type: 'LUQTA_PONG' },
          '*',
        )
        return
      }

      if (data.type === 'LUQTA_SCRAPE_URL' && data.url && data.requestId) {
        chrome.runtime.sendMessage(
          { type: 'SCRAPE_URL', url: data.url },
          (result) => {
            window.postMessage(
              {
                source: 'luqta-extension',
                type: 'LUQTA_SCRAPE_RESULT',
                requestId: data.requestId,
                result:
                  result ||
                  (chrome.runtime.lastError
                    ? {
                        ok: false,
                        error: chrome.runtime.lastError.message,
                      }
                    : { ok: false, error: 'No response' }),
              },
              '*',
            )
          },
        )
      }
    })

    window.postMessage({ source: 'luqta-extension', type: 'LUQTA_PONG' }, '*')
    return
  }

  /** Floating Add button on normal product pages. */
  if (window.__luqtaFabInstalled) return
  window.__luqtaFabInstalled = true

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.id = 'luqta-fab-add'
  btn.textContent = '＋ Add to Luqta'
  btn.setAttribute('aria-label', 'Add to Luqta')
  Object.assign(btn.style, {
    position: 'fixed',
    zIndex: '2147483646',
    right: '16px',
    bottom: '16px',
    minHeight: '44px',
    padding: '0 16px',
    border: '0',
    borderRadius: '999px',
    background: '#3d5a3a',
    color: '#f4f7f1',
    font: '600 14px system-ui, sans-serif',
    boxShadow: '0 8px 24px rgba(28, 36, 25, 0.28)',
    cursor: 'pointer',
  })

  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#2a3f28'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.background = '#3d5a3a'
  })

  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    btn.disabled = true
    btn.textContent = '…'
    chrome.runtime.sendMessage({ type: 'ADD_CURRENT_TAB' }, (result) => {
      if (!result?.ok) {
        btn.disabled = false
        btn.textContent = '＋ Add to Luqta'
        return
      }
      btn.textContent = '✓'
      setTimeout(() => {
        btn.disabled = false
        btn.textContent = '＋ Add to Luqta'
      }, 1200)
    })
  })

  document.documentElement.appendChild(btn)
})()
