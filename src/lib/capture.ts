/** Origin + base path for this Luqta install (e.g. https://amr-hash.github.io/Luqta). */
export function getAppOrigin(): string {
  const base = import.meta.env.BASE_URL || '/'
  const path = base === '/' ? '' : base.replace(/\/$/, '')
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

/**
 * Runs ON the product page (what you see in the browser — no CORS).
 * Scrapes JSON-LD / Open Graph / visible text, then opens Luqta /share
 * with labeled Price / Brand / breadcrumbs (same contract as ProductSignals).
 */
export function buildCaptureBookmarkletCode(): string {
  const app = getAppOrigin()
  return `(()=>{try{const A=${JSON.stringify(app)};const q=(s,a)=>{const e=document.querySelector(s);if(!e)return'';return(a?e.getAttribute(a):e.content||e.textContent||'').trim();};const graph=[];for(const s of document.querySelectorAll('script[type="application/ld+json"]')){try{const j=JSON.parse(s.textContent||'');const arr=Array.isArray(j)?j:[j];for(const it of arr){if(!it)continue;if(Array.isArray(it['@graph']))graph.push(...it['@graph']);else graph.push(it);}}catch{}}const ld=graph.find(x=>/Product/i.test(String(x['@type']||'')))||null;const crumbLd=graph.find(x=>/BreadcrumbList/i.test(String(x['@type']||''))||x.itemListElement);let crumbs=[];if(crumbLd&&Array.isArray(crumbLd.itemListElement)){crumbs=crumbLd.itemListElement.map(el=>{if(!el)return'';if(typeof el.name==='string')return el.name;const it=el.item;return it&&it.name?String(it.name):'';}).map(s=>String(s).trim()).filter(Boolean);}if(!crumbs.length){const nav=document.querySelector('[aria-label*="breadcrumb" i],nav.breadcrumb,ol.breadcrumb,.breadcrumb');if(nav){crumbs=[...nav.querySelectorAll('a,span,[itemprop="name"]')].map(n=>(n.textContent||'').trim()).filter(t=>t&&t.length<80).slice(0,8);}}let title=String((ld&&(ld.name||ld.title))||q('meta[property="og:title"]')||q('meta[name="twitter:title"]')||(document.querySelector('h1')&&document.querySelector('h1').innerText)||document.title||'').trim().replace(/^تسوق\\s+/i,'').replace(/\\s*أونلاين في مصر\\s*$/i,'');let desc=String((ld&&ld.description)||q('meta[name="description"]')||q('meta[property="og:description"]')||'').trim();let price='';let currency='';if(ld&&ld.offers){const o=Array.isArray(ld.offers)?ld.offers[0]:ld.offers;if(o){price=String(o.price||o.lowPrice||'');currency=String(o.priceCurrency||'');}}if(!price){price=q('meta[property="og:price:amount"]')||q('meta[property="product:price:amount"]')||'';currency=currency||q('meta[property="og:price:currency"]')||q('meta[property="product:price:currency"]')||'';}const brand=ld?(typeof ld.brand==='string'?ld.brand:(ld.brand&&ld.brand.name)||''):(q('meta[property="product:brand"]')||'');const priceEl=document.querySelector('[itemprop="price"],[data-testid*="price" i],[class*="PriceNow"],[class*="priceNow"],[data-qa*="price"],[class*="ProductPrice"],.a-price .a-offscreen,.price');const visiblePrice=(priceEl&&(priceEl.getAttribute('content')||priceEl.textContent)||'').trim();const root=document.querySelector('[itemtype*="Product"],#product,.product-info,.product,#dp,#ppd,#dp-container,main,[data-testid*="product"],[class*="ProductDetails"]')||document.body;const raw=(root.innerText||'').replace(/\\s+/g,' ').trim();if(!price&&visiblePrice){const m=visiblePrice.match(/[\\d,.]+/);if(m)price=m[0];if(/جنيه|EGP/i.test(visiblePrice))currency=currency||'EGP';else if(/ريال|SAR/i.test(visiblePrice))currency=currency||'SAR';else if(/درهم|AED/i.test(visiblePrice))currency=currency||'AED';}if(!price){const m=raw.match(/(?:EGP|USD|SAR|AED|EUR|GBP|€|\\$|£|ج\\.?\\s?م\\.?|ر\\.?\\s?س\\.?|ريال|جنيه|درهم)\\s*[\\d,.]+|[\\d,.]+\\s*(?:EGP|USD|SAR|AED|EUR|GBP|ج\\.?\\s?م\\.?|ر\\.?\\s?س\\.?|ريال|جنيه|درهم)/i);if(m)price=m[0];}let pageUrl=location.href;try{const sku=(location.pathname.match(/\\/(N[A-Z0-9]+)\\b/i)||[])[1];const loc=(location.pathname.match(/^\\/([a-z]+-(?:ar|en))\\b/i)||[])[1];if(sku&&loc&&/noon\\.com/i.test(location.hostname))pageUrl=location.origin+'/'+loc+'/'+sku+'/p/';}catch{}const text=[price&&('Price: '+String(price).replace(/[^\\d.]/g,'')+(currency?' '+currency:'')),brand&&('Brand: '+brand),crumbs.length&&('Category breadcrumbs: '+crumbs.join(' › ')),desc&&desc.slice(0,600),raw.slice(0,2800)].filter(Boolean).join('\\n\\n');const u=new URL(A+'/share');u.searchParams.set('title',title.slice(0,200));u.searchParams.set('text',text.slice(0,3500));u.searchParams.set('url',pageUrl);location.href=u.toString();}catch(e){alert('Luqta capture failed: '+(e&&e.message?e.message:e));}})();`
}

export function buildCaptureBookmarkletHref(): string {
  return `javascript:${encodeURIComponent(buildCaptureBookmarkletCode())}`
}

export function isCoarsePointerDevice(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  }
}
