import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ENVS, isEnv, type Env } from '../api/transactions'
import { useAuth } from '../auth/AuthContext'

/**
 * Console chrome: sandbox test-data banner, header with nav + env switcher.
 * The active environment lives in the URL (/:env/transactions), so reloads,
 * deep links, and browser history all preserve it — no hidden global state.
 */
export default function ConsoleLayout() {
  const { env: envParam } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  if (!isEnv(envParam)) {
    // Unknown environment segment (e.g. a typo'd URL) → land safely in sandbox.
    return <Navigate to="/sandbox/transactions" replace />
  }
  const env: Env = envParam

  function switchEnv(next: Env) {
    if (next === env) return
    // Keep the rest of the URL (route + filters) when switching environments.
    const nextPath = location.pathname.replace(`/${env}`, `/${next}`)
    navigate(nextPath + location.search)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16 md:pb-0">
      <header className="border-b border-slate-200 bg-white">
        {env === 'sandbox' && (
          <div className="bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold text-amber-950">
            You are viewing test data — no real money moves in Sandbox.
          </div>
        )}
        {/* Mobile: row 1 = brand + sign out, row 2 = full-width env switcher
            (a core control belongs in the thumb zone, not squeezed right).
            sm and up: everything collapses back into a single row. */}
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <div className="flex shrink-0 items-center gap-2">
            <span aria-hidden className="inline-block h-3.5 w-3.5 rotate-45 border-2 border-slate-900" />
            <span className="text-sm font-bold tracking-tight text-slate-900">Hopae Payments</span>
          </div>

          {/* Nav duplicates the page title on mobile — desktop only. */}
          <nav className="hidden items-center gap-4 text-sm md:flex">
            <span className="font-semibold text-slate-900">Transactions</span>
            {['Customers', 'Payouts', 'Developers'].map((item) => (
              <span
                key={item}
                title="Not part of this demo"
                className="cursor-not-allowed text-slate-500"
              >
                {item}
              </span>
            ))}
          </nav>

          <div
            role="radiogroup"
            aria-label="Environment"
            className={`order-last flex w-full rounded-full border p-0.5 text-xs font-semibold sm:order-none sm:ml-auto sm:w-auto ${
              env === 'sandbox' ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'
            }`}
          >
            {ENVS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={env === option}
                onClick={() => switchEnv(option)}
                className={`flex-1 rounded-full px-3 py-1.5 capitalize transition sm:flex-none sm:py-1 ${
                  env === option
                    ? option === 'sandbox'
                      ? 'bg-amber-400 text-amber-950'
                      : 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3 sm:ml-0">
            <span className="hidden text-xs text-slate-500 lg:inline">{user?.name}</span>
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 sm:py-1"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <Outlet context={{ env }} />

      {/* Mobile bottom tab bar — always-visible primary nav in the thumb
          zone. Desktop keeps the top nav instead (md:hidden). Only
          Transactions is functional in this demo; the rest mirror the
          wireframe chrome, muted. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <span aria-current="page" className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-slate-900">
          <TabIcon path="M4 6h16M4 10h16M4 14h10M4 18h6" />
          <span className="text-[11px] font-semibold">Transactions</span>
        </span>
        {(
          [
            ['Customers', 'M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
            ['Payouts', 'M3 8h18v9H3zM12 12.5a1.5 1.5 0 1 0 0-.01M3 8l2-3h14l2 3'],
            ['Developers', 'M8 9l-3 3 3 3M16 9l3 3-3 3M13 6l-2 12'],
          ] as const
        ).map(([label, path]) => (
          <span
            key={label}
            title="Not part of this demo"
            className="flex flex-1 cursor-not-allowed flex-col items-center gap-0.5 pb-1.5 pt-2 text-slate-400"
          >
            <TabIcon path={path} />
            <span className="text-[11px] font-medium">{label}</span>
          </span>
        ))}
      </nav>
    </div>
  )
}

function TabIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  )
}
