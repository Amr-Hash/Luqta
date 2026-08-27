;(() => {
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
