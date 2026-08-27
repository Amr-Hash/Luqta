import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-xs font-medium transition-colors duration-150',
    isActive
      ? 'bg-olive text-paper-raised'
      : 'text-ink-muted hover:bg-paper-raised hover:text-ink',
  ].join(' ')

export function Layout() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-20 border-b border-mist/60 bg-paper/85 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="brand-mark text-2xl text-olive-deep">{t('app.name')}</p>
            <p className="truncate text-xs text-ink-muted">{t('app.tagline')}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 pb-28">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-mist/70 bg-paper-raised/95 px-3 py-2 backdrop-blur-md"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-3xl gap-1">
          <NavLink to="/" end className={linkClass}>
            <span aria-hidden>◆</span>
            {t('app.wishlist')}
          </NavLink>
          <NavLink to="/share" className={linkClass}>
            <span aria-hidden>＋</span>
            {t('app.share')}
          </NavLink>
          <NavLink to="/compare" className={linkClass}>
            <span aria-hidden>⇄</span>
            {t('app.compare')}
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            <span aria-hidden>⚙</span>
            {t('app.settings')}
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
