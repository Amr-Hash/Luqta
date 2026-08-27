import { useCallback, useSyncExternalStore } from 'react'
import type { InitProgressReport } from '@/lib/llm'
import { getEngine, isWebGpuAvailable, onModelProgress } from '@/lib/llm'

type LlmStore = {
  progress: InitProgressReport | null
  ready: boolean
  error: string | null
  loading: boolean
}

let store: LlmStore = {
  progress: null,
  ready: false,
  error: null,
  loading: false,
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
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return store
}

export function useLlm() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const webGpu = isWebGpuAvailable()

  const preload = useCallback(async () => {
    if (!webGpu) return
    setStore({ loading: true, error: null })
    try {
      await getEngine()
      setStore({ ready: true, loading: false })
    } catch (e) {
      setStore({
        ready: false,
        loading: false,
        error: e instanceof Error ? e.message : 'Model load failed',
      })
    }
  }, [webGpu])

  return { ...state, webGpu, preload }
}
