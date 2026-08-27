import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { InitProgressReport } from '@/lib/llm'
import {
  clearModelCache,
  getEngine,
  isModelCachedLocally,
  isWebGpuAvailable,
  onModelProgress,
  readCacheMeta,
} from '@/lib/llm'

const SETUP_KEY = 'luqta-llm-setup'

export type LlmSetupMode = 'idle' | 'loading' | 'ready' | 'fallback' | 'error'

type LlmStore = {
  progress: InitProgressReport | null
  ready: boolean
  error: string | null
  loading: boolean
  mode: LlmSetupMode
  /** Weights already on device (IndexedDB) before this load */
  cachedOnDevice: boolean | null
}

function readPersistedSetup(): 'ready' | 'fallback' | null {
  try {
    const v = localStorage.getItem(SETUP_KEY)
    if (v === 'ready' || v === 'fallback') return v
    return null
  } catch {
    return null
  }
}

function persistSetup(value: 'ready' | 'fallback') {
  try {
    localStorage.setItem(SETUP_KEY, value)
  } catch {
    /* ignore */
  }
}

const persisted = readPersistedSetup()

let store: LlmStore = {
  progress: null,
  ready: false,
  error: null,
  loading: false,
  mode: persisted === 'fallback' ? 'fallback' : 'idle',
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

  useEffect(() => {
    if (!webGpu || persisted === 'fallback') return
    void isModelCachedLocally().then((hit) => {
      setStore({ cachedOnDevice: hit })
    })
  }, [webGpu])

  const acceptFallback = useCallback(() => {
    persistSetup('fallback')
    preloadStarted = true
    setStore({
      mode: 'fallback',
      loading: false,
      error: null,
    })
  }, [])

  const preload = useCallback(async () => {
    if (!webGpu) {
      setStore({ mode: 'fallback', loading: false, error: null })
      return
    }
    if (store.ready || store.loading) return

    preloadStarted = true
    const cached = await isModelCachedLocally()
    setStore({
      loading: true,
      error: null,
      mode: 'loading',
      cachedOnDevice: cached,
    })
    try {
      await getEngine()
      persistSetup('ready')
      setStore({
        ready: true,
        loading: false,
        mode: 'ready',
        error: null,
        cachedOnDevice: true,
      })
    } catch (e) {
      setStore({
        ready: false,
        loading: false,
        mode: 'error',
        error: e instanceof Error ? e.message : 'Model load failed',
      })
    }
  }, [webGpu])

  const clearCache = useCallback(async () => {
    await clearModelCache()
    preloadStarted = false
    setStore({
      ready: false,
      loading: false,
      mode: 'idle',
      error: null,
      progress: null,
      cachedOnDevice: false,
    })
    try {
      localStorage.removeItem(SETUP_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  /** Start download once in the background; never blocks the UI. */
  const ensureBackgroundPreload = useCallback(() => {
    if (!webGpu) return
    if (persisted === 'fallback') return
    if (preloadStarted || store.ready || store.loading) return
    void preload()
  }, [webGpu, preload])

  return {
    ...state,
    webGpu,
    preload,
    clearCache,
    acceptFallback,
    ensureBackgroundPreload,
  }
}
