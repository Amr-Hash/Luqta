import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { InitProgressReport } from '@/lib/llm'
import {
  clearLlmSetupChoice,
  clearModelCache,
  getEngine,
  hasUsableWebGpu,
  isGpuUnavailableError,
  isModelCachedLocally,
  isWebGpuAvailable,
  onModelProgress,
  persistLlmSetupChoice,
  readCacheMeta,
  readLlmSetupChoice,
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
  const choice = readLlmSetupChoice()
  if (choice === 'fallback') return 'fallback'
  if (choice === 'ready') return 'loading'
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
      setStore({ mode: 'fallback', loading: false, error: null })
      return
    }
    if (store.ready || store.loading) return

    preloadStarted = true
    const usable = await hasUsableWebGpu()
    if (!usable) {
      persistLlmSetupChoice('fallback')
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
      persistLlmSetupChoice('ready')
      setStore({
        ready: true,
        loading: false,
        mode: 'ready',
        error: null,
        cachedOnDevice: true,
      })
    } catch (e) {
      if (isGpuUnavailableError(e)) {
        persistLlmSetupChoice('fallback')
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

  useEffect(() => {
    if (!webGpu || readLlmSetupChoice() === 'fallback') return

    void isModelCachedLocally().then((hit) => {
      setStore({ cachedOnDevice: hit })
    })

    if (readLlmSetupChoice() === 'ready' && !preloadStarted && !store.ready) {
      void preload()
    }
  }, [webGpu, preload])

  const acceptFallback = useCallback(() => {
    persistLlmSetupChoice('fallback')
    preloadStarted = true
    setStore({
      mode: 'fallback',
      loading: false,
      error: null,
    })
  }, [])

  const clearCache = useCallback(async () => {
    await clearModelCache()
    clearLlmSetupChoice()
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
    clearCache,
    acceptFallback,
  }
}
