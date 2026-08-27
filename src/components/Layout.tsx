import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function IconWishlist({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4.5h12v15l-6-3.2-6 3.2v-15Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCapture({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="2.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <circle
        cx="12"
        cy="12"
        r="3.25"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <path
        d="M8 5.5 9.2 3.8h5.6L16 5.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCompare({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 7h10M7 12h6M7 17h10"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
      />
      <path
        d="M17 9.5 19.5 12 17 14.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSettings({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
      />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M4.8 7.2l1.9 1.1M17.3 15.7l1.9 1.1M4.8 16.8l1.9-1.1M17.3 8.3l1.9-1.1"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
      />
    </svg>
  )
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'pressable flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-[11px] font-medium tracking-wide transition-[color,background-color,transform] duration-150',
    isActive
      ? 'bg-olive text-paper-raised'
      : 'text-ink-muted hover:bg-paper hover:text-ink',
  ].join(' ')

export function Layout() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-20 bg-paper/70 px-4 pb-2 pt-3 backdrop-blur-md">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="brand-mark text-[1.75rem] text-olive-deep sm:text-3xl">
              {t('app.name')}
            </p>
            <p className="mt-0.5 truncate text-[0.7rem] font-medium tracking-wide text-ink-muted">
              {t('app.tagline')}
            </p>
          </div>
          <span
            className="mb-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-saffron/15 text-saffron"
            aria-hidden
            title=""
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="2.2" fill="currentColor" />
            </svg>
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 pb-32">
        <Outlet />
      </main>

      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        aria-label="Primary"
      >
        <div
          className="pointer-events-auto mx-auto flex max-w-3xl gap-1 rounded-2xl bg-paper-raised/92 p-1.5 ring-1 ring-mist/60 backdrop-blur-md"
          style={{ boxShadow: 'var(--shadow-dock)' }}
        >
          <NavLink to="/" end className={linkClass}>
            {({ isActive }) => (
              <>
                <IconWishlist active={isActive} />
                {t('app.wishlist')}
              </>
            )}
          </NavLink>
          <NavLink to="/share" className={linkClass}>
            {({ isActive }) => (
              <>
                <IconCapture active={isActive} />
                {t('app.share')}
              </>
            )}
          </NavLink>
          <NavLink to="/compare" className={linkClass}>
            {({ isActive }) => (
              <>
                <IconCompare active={isActive} />
                {t('app.compare')}
              </>
            )}
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            {({ isActive }) => (
              <>
                <IconSettings active={isActive} />
                {t('app.settings')}
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
