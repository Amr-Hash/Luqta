import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { InitProgressReport } from '@/lib/llm'
import {
  clearLlmConsent,
  clearModelCache,
  getEngine,
  hasUsableWebGpu,
  isGpuUnavailableError,
  isModelCachedLocally,
  isWebGpuAvailable,
  onModelProgress,
  persistLlmConsent,
  readCacheMeta,
  readLlmConsent,
} from '@/lib/llm'

export type LlmSetupMode =
  | 'prompt'
  | 'loading'
  | 'ready'
  | 'fallback'
  | 'error'

type LlmStore = {
  progress: InitProgressReport | null
  ready: boolean
  error: string | null
  loading: boolean
  mode: LlmSetupMode
  /** Weights already on device (IndexedDB) before this load */
  cachedOnDevice: boolean | null
}

function initialMode(): LlmSetupMode {
  const consent = readLlmConsent()
  if (consent === 'declined') return 'fallback'
  if (consent === 'granted') return 'loading'
  return 'prompt'
}

let store: LlmStore = {
  progress: null,
  ready: false,
  error: null,
  loading: false,
  mode: initialMode(),
  cachedOnDevice: readCacheMeta() ? true : null,
}

let preloadStarted = false

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function setStore(partial: Partial<LlmStore>) {
  store = { ...store, ...partial }
  emit()
}

onModelProgress((report) => {
  setStore({ progress: report })
})

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot() {
  return store
}

export function useLlm() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const webGpu = isWebGpuAvailable()

  const preload = useCallback(async () => {
    if (!webGpu) {
      persistLlmConsent('declined')
      setStore({ mode: 'fallback', loading: false, error: null })
      return
    }
    if (store.ready || store.loading) return

    preloadStarted = true
    const usable = await hasUsableWebGpu()
    if (!usable) {
      persistLlmConsent('declined')
      setStore({
        mode: 'fallback',
        loading: false,
        error: null,
        ready: false,
      })
      return
    }

    const cached = await isModelCachedLocally()
    setStore({
      loading: true,
      error: null,
      mode: 'loading',
      cachedOnDevice: cached,
    })
    try {
      await getEngine()
      setStore({
        ready: true,
        loading: false,
        mode: 'ready',
        error: null,
        cachedOnDevice: true,
      })
    } catch (e) {
      if (isGpuUnavailableError(e)) {
        persistLlmConsent('declined')
        setStore({
          ready: false,
          loading: false,
          mode: 'fallback',
          error: null,
        })
        return
      }
      setStore({
        ready: false,
        loading: false,
        mode: 'error',
        error: 'load_failed',
      })
    }
  }, [webGpu])

  const grantConsentAndPreload = useCallback(() => {
    persistLlmConsent('granted')
    void preload()
  }, [preload])

  useEffect(() => {
    if (!webGpu || readLlmConsent() === 'declined') return

    void isModelCachedLocally().then((hit) => {
      setStore({ cachedOnDevice: hit })
    })

    // Only auto-load for users who already granted consent on a prior visit.
    if (
      readLlmConsent() === 'granted' &&
      !preloadStarted &&
      !store.ready &&
      !store.loading
    ) {
      void preload()
    }
  }, [webGpu, preload])

  const acceptFallback = useCallback(() => {
    persistLlmConsent('declined')
    preloadStarted = true
    setStore({
      mode: 'fallback',
      loading: false,
      error: null,
    })
  }, [])

  const clearCache = useCallback(async () => {
    await clearModelCache()
    clearLlmConsent()
    preloadStarted = false
    setStore({
      ready: false,
      loading: false,
      mode: 'prompt',
      error: null,
      progress: null,
      cachedOnDevice: false,
    })
  }, [])

  return {
    ...state,
    webGpu,
    preload,
    grantConsentAndPreload,
    clearCache,
    acceptFallback,
    needsConsent: readLlmConsent() === null,
  }
}
