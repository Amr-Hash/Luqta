import { useCallback, useSyncExternalStore } from 'react'
import type { InitProgressReport } from '@/lib/llm'
import { getEngine, isWebGpuAvailable, onModelProgress } from '@/lib/llm'

const SETUP_KEY = 'luqta-llm-setup'

export type LlmSetupMode = 'idle' | 'loading' | 'ready' | 'fallback' | 'error'

type LlmStore = {
  progress: InitProgressReport | null
  ready: boolean
  error: string | null
  loading: boolean
  mode: LlmSetupMode
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
    setStore({
      loading: true,
      error: null,
      mode: 'loading',
    })
    try {
      await getEngine()
      persistSetup('ready')
      setStore({
        ready: true,
        loading: false,
        mode: 'ready',
        error: null,
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
    acceptFallback,
    ensureBackgroundPreload,
  }
}
