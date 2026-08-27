const titleEl = document.getElementById('title')
const urlEl = document.getElementById('url')
const addBtn = document.getElementById('add')
const statusEl = document.getElementById('status')

chrome.runtime.sendMessage({ type: 'GET_TAB_PREVIEW' }, (preview) => {
  titleEl.textContent = preview?.title || 'This page'
  urlEl.textContent = preview?.url || ''
})

addBtn.addEventListener('click', () => {
  addBtn.disabled = true
  statusEl.classList.remove('err')
  statusEl.textContent = 'Opening Luqta…'
  chrome.runtime.sendMessage({ type: 'ADD_CURRENT_TAB' }, (result) => {
    if (chrome.runtime.lastError) {
      statusEl.classList.add('err')
      statusEl.textContent = chrome.runtime.lastError.message
      addBtn.disabled = false
      return
    }
    if (!result?.ok) {
      statusEl.classList.add('err')
      statusEl.textContent = result?.error || 'Could not add page'
      addBtn.disabled = false
      return
    }
    statusEl.textContent = 'Added — Luqta opened'
    window.close()
  })
})
