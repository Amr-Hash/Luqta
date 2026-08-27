import type {
  InitProgressCallback,
  InitProgressReport,
  MLCEngineInterface,
} from '@mlc-ai/web-llm'
import type { AppLanguage, ExtractedProduct } from '@/types/product'
import { detectInputLanguage } from '@/lib/similarity'

export const MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'

export type { InitProgressReport }

let enginePromise: Promise<MLCEngineInterface> | null = null
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

export function getEngine(): Promise<MLCEngineInterface> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
      return CreateMLCEngine(MODEL_ID, {
        initProgressCallback: notifyProgress,
      })
    })().catch((err) => {
      enginePromise = null
      throw err
    })
  }
  return enginePromise
}

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
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
- Put comparable attributes into specs (storage, RAM, color, size, weight, screen, battery, etc.).
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
    category: typeof obj.category === 'string' ? obj.category : null,
    specs,
    summary: typeof obj.summary === 'string' ? obj.summary : null,
    language: lang,
  }
}

/** Heuristic fallback when WebGPU / model is unavailable. */
export function extractHeuristic(source: string): ExtractedProduct {
  const language = detectInputLanguage(source)
  const lines = source
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
  const urlLine = lines.find((l) => l.startsWith('URL:'))
  const titleLine =
    lines.find((l) => l.startsWith('Title:'))?.replace(/^Title:\s*/i, '') ||
    lines.find((l) => !l.startsWith('URL:') && !l.startsWith('Shared')) ||
    'Untitled product'

  const priceMatch = source.match(
    /(?:SAR|USD|EGP|AED|€|\$|£|ر\.?\s?س\.?|ج\.?\s?م\.?)\s*([\d,.]+)|([\d,.]+)\s*(?:SAR|USD|EGP|AED|ريال|جنيه)/i,
  )
  const priceRaw = priceMatch?.[1] ?? priceMatch?.[2]
  const price = priceRaw
    ? Number.parseFloat(priceRaw.replace(/,/g, ''))
    : null

  let currency: string | null = null
  if (/SAR|ر\.?\s?س|ريال/i.test(source)) currency = 'SAR'
  else if (/EGP|ج\.?\s?م|جنيه/i.test(source)) currency = 'EGP'
  else if (/AED|درهم/i.test(source)) currency = 'AED'
  else if (/USD|\$/.test(source)) currency = 'USD'

  return {
    title: titleLine.slice(0, 160),
    brand: null,
    price: Number.isFinite(price) ? price : null,
    currency,
    category: null,
    specs: urlLine ? { source: urlLine.replace(/^URL:\s*/i, '') } : {},
    summary: lines.slice(0, 3).join(' · ').slice(0, 240) || null,
    language,
  }
}

export async function extractProductFromText(
  source: string,
): Promise<ExtractedProduct> {
  if (!isWebGpuAvailable()) {
    return extractHeuristic(source)
  }

  try {
    const engine = await getEngine()
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
      return extractHeuristic(source)
    }
    const parsed = JSON.parse(extractJsonObject(content)) as unknown
    return coerceExtracted(parsed, fallbackLang)
  } catch {
    return extractHeuristic(source)
  }
}
