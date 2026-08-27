import { useEffect, useState } from 'react'
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
  /** Wall-clock start of this extraction run */
  startedAt?: number | null
}

const STEP_ORDER: ExtractStepId[] = [
  'readLink',
  'extension',
  'parse',
  'ai',
  'done',
]

function useNow(enabled: boolean, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs])
  return now
}

function formatSeconds(total: number) {
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m <= 0) return `${s}s`
  return `${m}:${String(s).padStart(2, '0')}`
}

function waitHintKey(stepId: ExtractStepId, elapsedSec: number): string | null {
  if (stepId === 'readLink') {
    if (elapsedSec >= 4) return 'progress.wait.readLinkSlow'
    return 'progress.wait.readLink'
  }
  if (stepId === 'extension') {
    if (elapsedSec >= 35) return 'progress.wait.extensionAlmostTimeout'
    if (elapsedSec >= 15) return 'progress.wait.extensionSlow'
    return 'progress.wait.extension'
  }
  if (stepId === 'ai') {
    if (elapsedSec >= 20) return 'progress.wait.aiSlow'
    if (elapsedSec >= 5) return 'progress.wait.ai'
    return null
  }
  return null
}

export function ExtractionProgress({
  steps,
  error,
  visible,
  startedAt = null,
}: ExtractionProgressProps) {
  const { t } = useTranslation()
  const byId = new Map(steps.map((s) => [s.id, s]))
  const failed = Boolean(error) || steps.some((s) => s.state === 'error')
  const active = steps.find((s) => s.state === 'active')
  const working = visible && !failed && Boolean(active)
  const succeeded =
    visible &&
    !failed &&
    steps.some((s) => s.id === 'done' && s.state === 'done')

  const now = useNow(working)
  const totalElapsed = startedAt
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : 0

  if (!visible) return null

  const finishedCount = steps.filter(
    (s) => s.state === 'done' || s.state === 'skipped',
  ).length
  const progressPct = failed
    ? Math.round((finishedCount / STEP_ORDER.length) * 100)
    : succeeded
      ? 100
      : Math.min(
          96,
          Math.round(
            ((finishedCount + (active ? 0.45 : 0)) / STEP_ORDER.length) * 100,
          ),
        )

  const hintKey = active ? waitHintKey(active.id, totalElapsed) : null

  return (
    <div
      className={[
        'surface rise-in space-y-3 rounded-2xl p-4',
        failed ? 'ring-1 ring-danger/35' : '',
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className={[
              'font-medium',
              failed ? 'text-danger' : 'text-olive-deep',
            ].join(' ')}
          >
            {failed
              ? t('progress.failedTitle')
              : succeeded
                ? t('progress.doneTitle')
                : t('progress.title')}
          </h2>
          {working && active && (
            <p className="mt-1 text-sm font-medium text-ink">
              {t('progress.nowDoing', {
                step: t(`progress.steps.${active.id}`),
              })}
            </p>
          )}
          {working && active?.detail && (
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              {active.detail}
            </p>
          )}
        </div>
        <div className="shrink-0 text-end">
          {working && (
            <p className="text-xs font-semibold tabular-nums text-saffron">
              {t('progress.elapsed', { time: formatSeconds(totalElapsed) })}
            </p>
          )}
          {failed && (
            <span className="text-xs font-semibold text-danger">
              {t('progress.failedBadge')}
            </span>
          )}
          {succeeded && (
            <span className="text-xs font-semibold text-olive">
              {t('progress.doneBadge')}
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-ink-muted">
          <span>
            {t('progress.stepCount', {
              current: Math.min(finishedCount + (active ? 1 : 0), STEP_ORDER.length),
              total: STEP_ORDER.length,
            })}
          </span>
          <span className="tabular-nums">{progressPct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-mist/70">
          <div
            className={[
              'h-full rounded-full transition-[width] duration-300 ease-out',
              failed ? 'bg-danger/70' : 'bg-olive',
            ].join(' ')}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {working && hintKey && (
        <p className="rounded-xl bg-saffron/10 px-3 py-2 text-xs leading-relaxed text-olive-deep ring-1 ring-saffron/25">
          {t(hintKey)}
        </p>
      )}

      {working && (
        <p className="text-[11px] leading-relaxed text-ink-muted">
          {t('progress.noRetry')}
        </p>
      )}

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
                      'mt-1 w-px min-h-3 flex-1',
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
                  {state === 'active' && (
                    <span className="ms-2 text-[11px] font-normal text-ink-muted">
                      {t('progress.activeLabel')}
                    </span>
                  )}
                  {state === 'pending' && working && (
                    <span className="ms-2 text-[11px] font-normal text-ink-muted">
                      {t('progress.pendingLabel')}
                    </span>
                  )}
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
          <p className="mt-2 text-xs leading-relaxed text-ink-muted opacity-100">
            {t('progress.errorHint')}
          </p>
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
