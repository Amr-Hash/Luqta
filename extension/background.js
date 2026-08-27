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

        // Grab nearby price-looking text from the product area
        const main =
          document.querySelector('#product, .product-info, .product-thumb, main') ||
          document.body
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
  if (!tab?.id || !tab.url) return
  if (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('about:')
  ) {
    return
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
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: 'luqta-add-page',
    title: 'Add page to Luqta',
    contexts: ['page', 'selection', 'link'],
  })
})

chrome.action.onClicked.addListener((tab) => {
  void sendTabToLuqta(tab)
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
