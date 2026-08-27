import type {
  AppConfig,
  InitProgressCallback,
  InitProgressReport,
  MLCEngineInterface,
} from '@mlc-ai/web-llm'
import type { AppLanguage, ExtractedProduct } from '@/types/product'
import { CANONICAL_CATEGORY_NAMES, normalizeCategory } from '@/lib/categories'
import { extractProductFromText as extractHeuristic } from '@/lib/extract'
import { detectInputLanguage } from '@/lib/similarity'

export const MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'

/** localStorage meta only — weights live in IndexedDB (too large for localStorage). */
const CACHE_META_KEY = 'luqta-llm-cache-meta'

export type { InitProgressReport }

export type ModelCacheMeta = {
  modelId: string
  backend: 'indexeddb'
  cachedAt: number
}

let enginePromise: Promise<MLCEngineInterface> | null = null
let appConfigPromise: Promise<AppConfig> | null = null
const progressListeners = new Set<InitProgressCallback>()

export function onModelProgress(cb: InitProgressCallback): () => void {
  progressListeners.add(cb)
  return () => {
    progressListeners.delete(cb)
  }
}

const notifyProgress: InitProgressCallback = (report) => {
  for (const cb of progressListeners) cb(report)
}

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

/** True only when the browser can actually request a WebGPU adapter (not just `navigator.gpu`). */
export async function hasUsableWebGpu(): Promise<boolean> {
  if (!isWebGpuAvailable()) return false
  try {
    const gpu = (
      navigator as Navigator & {
        gpu?: { requestAdapter: () => Promise<unknown> }
      }
    ).gpu
    if (!gpu?.requestAdapter) return false
    const adapter = await gpu.requestAdapter()
    return adapter != null
  } catch {
    return false
  }
}

export function isGpuUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /compatible GPU|WebGPU|requestAdapter|no adapter|GPU adapter/i.test(
    msg,
  )
}

export function readCacheMeta(): ModelCacheMeta | null {
  try {
    const raw = localStorage.getItem(CACHE_META_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ModelCacheMeta
    if (parsed.modelId !== MODEL_ID) return null
    return parsed
  } catch {
    return null
  }
}

function writeCacheMeta() {
  try {
    const meta: ModelCacheMeta = {
      modelId: MODEL_ID,
      backend: 'indexeddb',
      cachedAt: Date.now(),
    }
    localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta))
  } catch {
    /* ignore quota / private mode */
  }
}

function clearCacheMeta() {
  try {
    localStorage.removeItem(CACHE_META_KEY)
  } catch {
    /* ignore */
  }
}

async function getAppConfig(): Promise<AppConfig> {
  if (!appConfigPromise) {
    appConfigPromise = (async () => {
      const { prebuiltAppConfig } = await import('@mlc-ai/web-llm')
      return {
        ...prebuiltAppConfig,
        // IndexedDB is more durable for multi‑MB weights than Cache API alone.
        cacheBackend: 'indexeddb',
      }
    })()
  }
  return appConfigPromise
}

/** Ask the browser to keep site data (helps weights survive cleanup). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function isModelCachedLocally(): Promise<boolean> {
  try {
    const { hasModelInCache } = await import('@mlc-ai/web-llm')
    const appConfig = await getAppConfig()
    const hit = await hasModelInCache(MODEL_ID, appConfig)
    if (hit) writeCacheMeta()
    else clearCacheMeta()
    return hit
  } catch {
    return Boolean(readCacheMeta())
  }
}

export async function clearModelCache(): Promise<void> {
  try {
    const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm')
    const appConfig = await getAppConfig()
    await deleteModelAllInfoInCache(MODEL_ID, appConfig)
  } finally {
    clearCacheMeta()
    enginePromise = null
  }
}

export function getEngine(): Promise<MLCEngineInterface> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
      const appConfig = await getAppConfig()
      await requestPersistentStorage()

      let fromCache = false
      try {
        const { hasModelInCache } = await import('@mlc-ai/web-llm')
        fromCache = await hasModelInCache(MODEL_ID, appConfig)
      } catch {
        fromCache = Boolean(readCacheMeta())
      }

      notifyProgress({
        progress: fromCache ? 0.05 : 0,
        timeElapsed: 0,
        text: fromCache
          ? 'Loading model from device cache…'
          : 'Downloading model weights (saved on this device for next time)…',
      })

      const engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: notifyProgress,
        appConfig,
      })
      writeCacheMeta()
      return engine
    })().catch((err) => {
      enginePromise = null
      throw err
    })
  }
  return enginePromise
}

const SYSTEM_PROMPT = `You are a product data extractor for a wishlist app.
Extract structured product information from shared page text.
Reply with ONLY valid JSON (no markdown, no commentary) matching:
{
  "title": string,
  "brand": string | null,
  "price": number | null,
  "currency": string | null,
  "category": string | null,
  "specs": { [key: string]: string | number | boolean | null },
  "summary": string | null,
  "language": "ar" | "en"
}
Rules:
- Prefer the language of the source text for title/summary/spec keys when Arabic or English.
- category MUST be exactly one of: ${CANONICAL_CATEGORY_NAMES.join(', ')}.
- Never invent singular/plural variants (use "Perfumes" not "Perfume"/"perfumes"; same idea for other categories).
- Map عطر/عطور/مخمرية/fragrance/cologne/attar → Perfumes.
- Put comparable attributes into specs (storage, RAM, color, size, weight, screen, battery, scent notes, volume, etc.).
- Do NOT put product URLs, links, or website addresses into specs.
- price must be a number without currency symbols; currency is ISO-like (SAR, USD, EGP, AED) or null.
- If a field is unknown, use null (or {} for specs).
- Never invent prices or brands that are not implied by the text.`

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractJsonObject(text: string): string {
  const cleaned = stripCodeFences(text)
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON')
  }
  return cleaned.slice(start, end + 1)
}

function coerceExtracted(
  raw: unknown,
  fallbackLang: AppLanguage,
): ExtractedProduct {
  const obj = (raw ?? {}) as Record<string, unknown>
  const specsRaw = obj.specs
  const specs: ExtractedProduct['specs'] = {}
  if (specsRaw && typeof specsRaw === 'object' && !Array.isArray(specsRaw)) {
    for (const [k, v] of Object.entries(specsRaw as Record<string, unknown>)) {
      if (
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean' ||
        v === null
      ) {
        // Never keep full product URLs in specs — source is stored separately
        if (
          typeof v === 'string' &&
          (/^(source|url|link|website|href)$/i.test(k) ||
            /^https?:\/\//i.test(v.trim()))
        ) {
          continue
        }
        specs[k] = v
      } else if (v != null) {
        specs[k] = String(v)
      }
    }
  }

  const lang =
    obj.language === 'ar' || obj.language === 'en'
      ? obj.language
      : fallbackLang

  const price =
    typeof obj.price === 'number'
      ? obj.price
      : typeof obj.price === 'string'
        ? Number.parseFloat(obj.price.replace(/[^\d.]/g, ''))
        : null

  return {
    title:
      typeof obj.title === 'string' && obj.title.trim()
        ? obj.title.trim()
        : 'Untitled product',
    brand: typeof obj.brand === 'string' ? obj.brand : null,
    price: Number.isFinite(price) ? price : null,
    currency: typeof obj.currency === 'string' ? obj.currency : null,
    category: normalizeCategory(
      typeof obj.category === 'string' ? obj.category : null,
      lang,
      [
        typeof obj.title === 'string' ? obj.title : '',
        typeof obj.summary === 'string' ? obj.summary : '',
        typeof obj.category === 'string' ? obj.category : '',
      ].join('\n'),
    ),
    specs,
    summary: typeof obj.summary === 'string' ? obj.summary : null,
    language: lang,
  }
}

export type ExtractMode = 'llm' | 'heuristic'

export type ExtractStatus =
  | 'checking_gpu'
  | 'waiting_engine'
  | 'running_model'
  | 'using_rules'

export async function extractProductSmart(
  source: string,
  opts?: { onStatus?: (status: ExtractStatus) => void },
): Promise<{ product: ExtractedProduct; mode: ExtractMode }> {
  const onStatus = opts?.onStatus
  onStatus?.('checking_gpu')

  if (!(await hasUsableWebGpu())) {
    onStatus?.('using_rules')
    return { product: extractHeuristic(source), mode: 'heuristic' }
  }

  try {
    onStatus?.('waiting_engine')
    const engine = await getEngine()
    onStatus?.('running_model')
    const fallbackLang = detectInputLanguage(source)
    const reply = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract the product JSON from this shared content:\n\n${source.slice(0, 6000)}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 768,
    })

    const content = reply.choices[0]?.message?.content
    if (!content || typeof content !== 'string') {
      onStatus?.('using_rules')
      return { product: extractHeuristic(source), mode: 'heuristic' }
    }
    const parsed = JSON.parse(extractJsonObject(content)) as unknown
    return {
      product: coerceExtracted(parsed, fallbackLang),
      mode: 'llm',
    }
  } catch {
    onStatus?.('using_rules')
    return { product: extractHeuristic(source), mode: 'heuristic' }
  }
}
