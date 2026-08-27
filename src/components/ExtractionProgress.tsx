import { useTranslation } from 'react-i18next'

export type ExtractStepId =
  | 'readLink'
  | 'extension'
  | 'parse'
  | 'ai'
  | 'done'

export type StepState = 'pending' | 'active' | 'done' | 'error' | 'skipped'

export type ExtractStep = {
  id: ExtractStepId
  state: StepState
  detail?: string
}

interface ExtractionProgressProps {
  steps: ExtractStep[]
  error?: string | null
  visible: boolean
}

const STEP_ORDER: ExtractStepId[] = [
  'readLink',
  'extension',
  'parse',
  'ai',
  'done',
]

export function ExtractionProgress({
  steps,
  error,
  visible,
}: ExtractionProgressProps) {
  const { t } = useTranslation()
  if (!visible) return null

  const byId = new Map(steps.map((s) => [s.id, s]))

  return (
    <div
      className="rise-in space-y-3 rounded-2xl border border-mist bg-paper-raised/90 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-olive-deep">{t('progress.title')}</h2>
        {steps.some((s) => s.state === 'active') && (
          <span className="text-xs text-ink-muted">{t('progress.working')}</span>
        )}
      </div>

      <ol className="space-y-2.5">
        {STEP_ORDER.map((id, index) => {
          const step = byId.get(id)
          const state = step?.state ?? 'pending'
          return (
            <li key={id} className="flex gap-3">
              <div className="flex w-6 flex-col items-center">
                <span
                  className={[
                    'grid size-6 place-items-center rounded-full text-[11px] font-bold transition-colors duration-200',
                    state === 'done' && 'bg-olive text-paper-raised',
                    state === 'active' &&
                      'bg-saffron/25 text-olive-deep ring-2 ring-saffron/50',
                    state === 'error' && 'bg-danger/15 text-danger',
                    state === 'skipped' && 'bg-mist/60 text-ink-muted',
                    state === 'pending' && 'bg-mist/50 text-ink-muted',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden
                >
                  {state === 'done'
                    ? '✓'
                    : state === 'error'
                      ? '!'
                      : state === 'skipped'
                        ? '–'
                        : index + 1}
                </span>
                {index < STEP_ORDER.length - 1 && (
                  <span
                    className={[
                      'mt-1 w-px flex-1 min-h-3',
                      state === 'done' ? 'bg-olive/40' : 'bg-mist',
                    ].join(' ')}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-2">
                <p
                  className={[
                    'text-sm font-medium',
                    state === 'active' && 'text-olive-deep',
                    state === 'error' && 'text-danger',
                    state === 'pending' && 'text-ink-muted',
                    (state === 'done' || state === 'skipped') && 'text-ink',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {t(`progress.steps.${id}`)}
                </p>
                {step?.detail && (
                  <p
                    className={[
                      'mt-0.5 text-xs leading-relaxed',
                      state === 'error' ? 'text-danger' : 'text-ink-muted',
                    ].join(' ')}
                  >
                    {step.detail}
                  </p>
                )}
                {state === 'active' && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-mist/70">
                    <div className="extract-bar h-full w-1/3 rounded-full bg-olive" />
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {error && (
        <div
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
          role="alert"
        >
          <p className="font-medium">{t('progress.errorTitle')}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">{error}</p>
        </div>
      )}
    </div>
  )
}

export function initialExtractSteps(): ExtractStep[] {
  return STEP_ORDER.map((id) => ({ id, state: 'pending' as const }))
}

export function patchStep(
  steps: ExtractStep[],
  id: ExtractStepId,
  state: StepState,
  detail?: string,
): ExtractStep[] {
  return steps.map((s) =>
    s.id === id ? { ...s, state, detail: detail ?? s.detail } : s,
  )
}
