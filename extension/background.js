const DEFAULT_BASE = 'https://amr-hash.github.io/Luqta'

async function getBaseUrl() {
  const { luqtaBaseUrl } = await chrome.storage.sync.get({
    luqtaBaseUrl: DEFAULT_BASE,
  })
  return String(luqtaBaseUrl || DEFAULT_BASE).replace(/\/$/, '')
}

async function getPageMeta(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const ogTitle =
          document
            .querySelector('meta[property="og:title"]')
            ?.getAttribute('content') || ''
        const description =
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute('content') ||
          document
            .querySelector('meta[property="og:description"]')
            ?.getAttribute('content') ||
          ''
        const h1 = document.querySelector('h1')?.innerText?.trim() || ''
        const selection = window.getSelection()?.toString()?.trim() || ''

        const main =
          document.querySelector(
            '#product, .product-info, .product-thumb, main, [itemtype*="Product"]',
          ) || document.body
        const priceText =
          main.innerText.match(
            /(?:EGP|USD|SAR|AED|€|\$|£|ج\.?\s?م\.?|ريال|جنيه)\s*[\d,.]+|[\d,.]+\s*(?:EGP|USD|SAR|AED|ج\.?\s?م\.?|ريال|جنيه)/i,
          )?.[0] || ''

        const bodySnippet = (main.innerText || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 2500)

        return {
          title: ogTitle || h1 || document.title || '',
          description,
          selection,
          priceText,
          bodySnippet,
        }
      },
    })
    return (
      result ?? {
        title: '',
        description: '',
        selection: '',
        priceText: '',
        bodySnippet: '',
      }
    )
  } catch {
    return {
      title: '',
      description: '',
      selection: '',
      priceText: '',
      bodySnippet: '',
    }
  }
}

function buildShareUrl(base, { title, text, url }) {
  const share = new URL(`${base}/share`)
  if (title) share.searchParams.set('title', title)
  if (text) share.searchParams.set('text', text)
  if (url) share.searchParams.set('url', url)
  return share.toString()
}

async function sendTabToLuqta(tab) {
  if (!tab?.id || !tab.url) {
    return { ok: false, error: 'No active tab' }
  }
  if (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('about:') ||
    tab.url.startsWith('chrome-extension://')
  ) {
    return { ok: false, error: 'Open a product page first' }
  }

  const base = await getBaseUrl()
  const meta = await getPageMeta(tab.id)
  const title = meta.title || tab.title || ''
  const text = [
    meta.selection,
    meta.priceText && `Price: ${meta.priceText}`,
    meta.description,
    meta.bodySnippet,
  ]
    .filter(Boolean)
    .join('\n\n')

  const target = buildShareUrl(base, {
    title,
    text,
    url: tab.url,
  })

  await chrome.tabs.create({ url: target, active: true })
  return { ok: true, title }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: 'luqta-add-page',
    title: 'Add to Luqta',
    contexts: ['page', 'selection', 'link'],
  })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ADD_CURRENT_TAB') {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        const result = await sendTabToLuqta(tab)
        sendResponse(result)
      })
      .catch((e) => {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : 'Failed',
        })
      })
    return true
  }

  if (message?.type === 'GET_TAB_PREVIEW') {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.id) {
          sendResponse({ title: '', url: '' })
          return
        }
        const meta = await getPageMeta(tab.id)
        sendResponse({
          title: meta.title || tab.title || '',
          url: tab.url || '',
        })
      })
      .catch(() => sendResponse({ title: '', url: '' }))
    return true
  }

  return false
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'luqta-add-page') return

  if (info.linkUrl) {
    const base = await getBaseUrl()
    const target = buildShareUrl(base, {
      title: info.selectionText || '',
      text: info.selectionText || '',
      url: info.linkUrl,
    })
    await chrome.tabs.create({ url: target, active: true })
    return
  }

  if (tab) void sendTabToLuqta(tab)
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'add-to-luqta') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab) void sendTabToLuqta(tab)
})
