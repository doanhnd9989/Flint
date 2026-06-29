import { Link } from 'react-router-dom'
import {
  Zap,
  Command,
  GitBranch,
  Layers,
  Target,
  CircleDot,
  ArrowRight,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import { useAuth, useFeature } from '@/lib/auth'

/**
 * Public marketing landing page shown at `/welcome`. Feature cards are gated by
 * the same admin feature flags that gate the in-app sidebar, so disabling a
 * feature hides it everywhere.
 */
export function Landing() {
  const workspace = useAuth((s) => s.workspace)
  const user = useAuth((s) => s.user)
  const accent = workspace.accentColor || '#5e6ad2'
  const name = workspace.name || 'Flint'
  const tagline = workspace.tagline || 'The issue tracker built for speed.'

  const features = [
    { flag: 'projects', icon: Layers, title: 'Projects', body: 'Group work into projects with health, milestones and progress at a glance.' },
    { flag: 'cycles', icon: CircleDot, title: 'Cycles', body: 'Time-boxed iterations that keep the team focused on what ships next.' },
    { flag: 'initiatives', icon: Target, title: 'Initiatives', body: 'Roll projects up into strategic initiatives and track the big picture.' },
    { flag: 'insights', icon: Sparkles, title: 'Insights', body: 'Dashboards and analytics that turn issue data into decisions.' },
    { flag: 'releases', icon: GitBranch, title: 'Releases', body: 'Plan releases, link issues, and ship a polished changelog.' },
    { flag: '__always', icon: Command, title: 'Command menu', body: 'Everything is one keystroke away. ⌘K to navigate, create and act.' },
  ]

  return (
    <div className="h-screen w-screen overflow-y-auto bg-bg text-fg" style={{ ['--accent' as string]: accent }}>
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-white"
              style={{ background: accent }}
            >
              <Zap size={16} />
            </span>
            <span>{name}</span>
          </div>
          <nav className="flex items-center gap-2">
            {user ? (
              <Link
                to="/"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
                style={{ background: accent }}
              >
                Open app
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-fg"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white"
                  style={{ background: accent }}
                >
                  Get started <ArrowRight size={14} />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div
          className="mx-auto mb-6 flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted"
        >
          <Sparkles size={12} style={{ color: accent }} /> Built for high-performance teams
        </div>
        <h1 className="text-balance text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
          {tagline}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
          {name} is a keyboard-first issue tracker and project-management platform.
          Plan cycles, track projects, and ship faster — all at the speed of thought.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            to={user ? '/' : '/register'}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
            style={{ background: accent }}
          >
            {user ? 'Open app' : 'Start now'} <ArrowRight size={16} />
          </Link>
          <Link
            to="/api-docs"
            className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-fg transition hover:bg-bg-hover"
          >
            <BookOpen size={16} /> API docs
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} accent={accent} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-bg-secondary">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Ready to move faster?</h2>
          <p className="mt-3 text-muted">Sign in to your {name} workspace and get to work.</p>
          <Link
            to={user ? '/' : '/login'}
            className="mt-8 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            style={{ background: accent }}
          >
            {user ? 'Open app' : 'Sign in'} <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-faint sm:flex-row">
          <span>© {new Date().getFullYear()} {name}</span>
          <span>Built for high-performance teams.</span>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  flag,
  icon: Icon,
  title,
  body,
  accent,
}: {
  flag: string
  icon: typeof Zap
  title: string
  body: string
  accent: string
}) {
  // `__always` is never gated; real flags hide the card when disabled.
  const enabled = useFeature(flag === '__always' ? 'projects' : flag)
  if (flag !== '__always' && !enabled) return null
  return (
    <div className="rounded-xl border border-border bg-bg p-5 transition hover:border-border-strong">
      <span
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: `${accent}1f`, color: accent }}
      >
        <Icon size={18} />
      </span>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  )
}
