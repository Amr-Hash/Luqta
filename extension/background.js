const DEFAULT_BASE = 'https://amr-hash.github.io/Luqta'

async function getBaseUrl() {
  const { luqtaBaseUrl } = await chrome.storage.sync.get({
    luqtaBaseUrl: DEFAULT_BASE,
  })
  return String(luqtaBaseUrl || DEFAULT_BASE).replace(/\/$/, '')
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated)
      reject(new Error('Timed out loading page'))
    }, timeoutMs)

    function done() {
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(onUpdated)
      resolve()
    }

    function onUpdated(id, info) {
      if (id === tabId && info.status === 'complete') done()
    }

    chrome.tabs.onUpdated.addListener(onUpdated)
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') done()
    })
  })
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

function metaToText(meta) {
  return [
    meta.selection,
    meta.priceText && `Price: ${meta.priceText}`,
    meta.description,
    meta.bodySnippet,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Open URL in a background tab, scrape DOM, close tab — bypasses page CORS. */
async function scrapeUrl(url) {
  const tab = await chrome.tabs.create({ url, active: false })
  try {
    await waitForTabComplete(tab.id)
    await delay(1000)
    let meta = await getPageMeta(tab.id)
    if (!meta.title && !meta.bodySnippet) {
      await chrome.tabs.update(tab.id, { active: true })
      await delay(1500)
      meta = await getPageMeta(tab.id)
    }
    return {
      ok: true,
      title: meta.title || '',
      text: metaToText(meta),
      url,
    }
  } finally {
    try {
      await chrome.tabs.remove(tab.id)
    } catch {
      /* tab may already be closed */
    }
  }
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
  const text = metaToText(meta)

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
      .then(async ([tab]) => sendResponse(await sendTabToLuqta(tab)))
      .catch((e) =>
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : 'Failed',
        }),
      )
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

  if (message?.type === 'SCRAPE_URL') {
    const url = String(message.url || '')
    if (!/^https?:\/\//i.test(url)) {
      sendResponse({ ok: false, error: 'Invalid URL' })
      return false
    }
    scrapeUrl(url)
      .then(sendResponse)
      .catch((e) =>
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : 'Scrape failed',
        }),
      )
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
