const DEFAULT_BASE = 'https://amr-hash.github.io/Luqta'

const input = document.getElementById('base')
const status = document.getElementById('status')
const save = document.getElementById('save')

const { luqtaBaseUrl } = await chrome.storage.sync.get({
  luqtaBaseUrl: DEFAULT_BASE,
})
input.value = luqtaBaseUrl

save.addEventListener('click', async () => {
  const value = input.value.trim().replace(/\/$/, '') || DEFAULT_BASE
  await chrome.storage.sync.set({ luqtaBaseUrl: value })
  input.value = value
  status.hidden = false
  setTimeout(() => {
    status.hidden = true
  }, 1500)
})
