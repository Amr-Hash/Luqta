import type {
  InitProgressCallback,
  InitProgressReport,
  MLCEngineInterface,
} from '@mlc-ai/web-llm'
import type { AppLanguage, ExtractedProduct } from '@/types/product'
import { extractProductFromText as extractHeuristic } from '@/lib/extract'
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

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
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

export type ExtractMode = 'llm' | 'heuristic'

export async function extractProductSmart(
  source: string,
): Promise<{ product: ExtractedProduct; mode: ExtractMode }> {
  if (!isWebGpuAvailable()) {
    return { product: extractHeuristic(source), mode: 'heuristic' }
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
      return { product: extractHeuristic(source), mode: 'heuristic' }
    }
    const parsed = JSON.parse(extractJsonObject(content)) as unknown
    return {
      product: coerceExtracted(parsed, fallbackLang),
      mode: 'llm',
    }
  } catch {
    return { product: extractHeuristic(source), mode: 'heuristic' }
  }
}
