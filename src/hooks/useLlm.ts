import { useCallback, useSyncExternalStore } from 'react'
import type { InitProgressReport } from '@/lib/llm'
import { getEngine, isWebGpuAvailable, onModelProgress } from '@/lib/llm'

const SETUP_KEY = 'luqta-llm-setup'

export type LlmSetupMode = 'pending' | 'loading' | 'ready' | 'fallback'

type LlmStore = {
  progress: InitProgressReport | null
  ready: boolean
  error: string | null
  loading: boolean
  mode: LlmSetupMode
  canUseApp: boolean
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
  mode: persisted === 'fallback' ? 'fallback' : 'pending',
  canUseApp: persisted === 'fallback',
}

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
    setStore({
      mode: 'fallback',
      canUseApp: true,
      loading: false,
    })
  }, [])

  const preload = useCallback(async () => {
    if (!webGpu) {
      setStore({ mode: 'fallback', loading: false, error: null })
      return
    }

    setStore({
      loading: true,
      error: null,
      mode: 'loading',
      canUseApp: false,
    })
    try {
      await getEngine()
      persistSetup('ready')
      setStore({
        ready: true,
        loading: false,
        mode: 'ready',
        canUseApp: true,
        error: null,
      })
    } catch (e) {
      setStore({
        ready: false,
        loading: false,
        mode: 'pending',
        canUseApp: false,
        error: e instanceof Error ? e.message : 'Model load failed',
      })
    }
  }, [webGpu])

  return { ...state, webGpu, preload, acceptFallback }
}
