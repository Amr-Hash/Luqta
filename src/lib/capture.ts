/** Origin + base path for this Luqta install (e.g. https://amr-hash.github.io/Luqta). */
export function getAppOrigin(): string {
  const base = import.meta.env.BASE_URL || '/'
  const path = base === '/' ? '' : base.replace(/\/$/, '')
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

/**
 * Bookmarklet: runs ON the product page (no CORS), scrapes title/price/text,
 * then navigates to Luqta /share with the payload.
 */
export function buildCaptureBookmarkletHref(): string {
  const app = getAppOrigin()
  const code = `(()=>{const A=${JSON.stringify(app)};const t=(document.querySelector('meta[property="og:title"]')?.content||document.querySelector('h1')?.innerText||document.title||'').trim();const d=document.querySelector('meta[name="description"]')?.content||document.querySelector('meta[property="og:description"]')?.content||'';const m=document.querySelector('#product,.product-info,.product-thumb,main,[itemtype*="Product"]')||document.body;const raw=(m.innerText||'').replace(/\\s+/g,' ').trim();const p=(raw.match(/(?:EGP|USD|SAR|AED|EUR|GBP|€|\\$|£|ج\\.?\\s?م\\.?|ريال|جنيه)\\s*[\\d,.]+|[\\d,.]+\\s*(?:EGP|USD|SAR|AED|ج\\.?\\s?م\\.?|ريال|جنيه)/i)||[])[0]||'';const text=[p&&('Price: '+p),d,raw.slice(0,2500)].filter(Boolean).join('\\n\\n');const u=new URL(A+'/share');u.searchParams.set('title',t);u.searchParams.set('text',text);u.searchParams.set('url',location.href);location.href=u.toString();})();`
  return `javascript:${encodeURIComponent(code)}`
}
