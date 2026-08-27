export type ExtensionScrapeResult = {
  ok: boolean
  title?: string
  text?: string
  url?: string
  error?: string
}

function requestId() {
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** True if the Luqta extension content bridge is on this page. */
export function pingExtension(timeoutMs = 600): Promise<boolean> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      if (event.data?.source !== 'luqta-extension') return
      if (event.data?.type === 'LUQTA_PONG') {
        cleanup()
        resolve(true)
      }
    }
    const timer = window.setTimeout(() => {
      cleanup()
      resolve(false)
    }, timeoutMs)
    const cleanup = () => {
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }
    window.addEventListener('message', onMessage)
    window.postMessage({ source: 'luqta-app', type: 'LUQTA_PING' }, '*')
  })
}

/**
 * Ask the extension to open `url` in a background tab, scrape the DOM, and return
 * title/text. This is how we “call the website” without CORS.
 */
export function scrapeUrlViaExtension(
  url: string,
  timeoutMs = 45000,
): Promise<ExtensionScrapeResult> {
  return new Promise((resolve) => {
    const id = requestId()
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      const data = event.data
      if (data?.source !== 'luqta-extension') return
      if (data?.type !== 'LUQTA_SCRAPE_RESULT') return
      if (data?.requestId !== id) return
      cleanup()
      resolve((data.result as ExtensionScrapeResult) ?? { ok: false })
    }
    const timer = window.setTimeout(() => {
      cleanup()
      resolve({ ok: false, error: 'Extension scrape timed out' })
    }, timeoutMs)
    const cleanup = () => {
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }
    window.addEventListener('message', onMessage)
    window.postMessage(
      { source: 'luqta-app', type: 'LUQTA_SCRAPE_URL', url, requestId: id },
      '*',
    )
  })
}
