import { Link } from 'react-router-dom'
import {
  Zap,
  Command,
  GitBranch,
  Layers,
  Target,
  ArrowRight,
  Sparkles,
  Gauge,
  Keyboard,
  Boxes,
  Inbox,
  Tag,
  BarChart3,
  Bell,
  Bookmark,
  Moon,
  IterationCw,
  Check,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth, useFeature } from '@/lib/auth'

/**
 * Marketing landing page at `/`. Multi-section product site (hero, feature
 * showcases with CSS-built product mockups, feature grid, CTA, footer) modeled
 * on the information architecture of modern product-tool homepages. Pure
 * presentational so it prerenders to static HTML for SEO/GEO.
 */
export function Landing() {
  const workspace = useAuth((s) => s.workspace)
  const user = useAuth((s) => s.user)
  const accent = workspace.accentColor || '#5e6ad2'
  const name = workspace.name || 'Flint Task'

  const primaryCta = user ? { to: '/', label: 'Open app' } : { to: '/register', label: 'Get started' }

  // w-full, not w-screen — see ApiDocs: 100vw includes the scrollbar.
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-bg text-fg" style={{ ['--accent' as string]: accent }}>
      {/* ───── Nav ───── */}
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-7">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ background: accent }}>
                <Zap size={16} />
              </span>
              <span>{name}</span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm text-muted md:flex">
              <a href="#features" className="hover:text-fg">Features</a>
              <a href="#workflow" className="hover:text-fg">Workflow</a>
              <a href="#everything" className="hover:text-fg">Capabilities</a>
              <Link to="/api-docs" className="hover:text-fg">Developers</Link>
            </nav>
          </div>
          <nav className="flex items-center gap-2">
            {user ? (
              <Link to="/" className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: accent }}>
                Open app
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-fg">
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

      {/* ───── Hero ───── */}
      <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-12 text-center">
        <div className="mx-auto mb-6 flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted">
          <Sparkles size={12} style={{ color: accent }} /> The system for modern product teams
        </div>
        <h1 className="mx-auto max-w-4xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Plan, build and ship<br />at the speed of thought
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
          {name} is a keyboard-first issue tracker and project-management platform.
          Streamline issues, cycles and projects so your team can focus on what matters — shipping.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            to={primaryCta.to}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
            style={{ background: accent }}
          >
            {primaryCta.label} <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-fg transition hover:bg-bg-hover">
            Sign in
          </Link>
        </div>

        {/* Product mockup */}
        <div className="mx-auto mt-16 max-w-5xl">
          <AppMockup accent={accent} />
        </div>
      </section>

      {/* ───── Trust band ───── */}
      <section className="border-y border-border bg-bg-secondary">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center">
          <p className="text-sm text-muted">
            Built for the way high-performance teams plan, build and ship software.
          </p>
        </div>
      </section>

      {/* ───── Three value props ───── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 md:grid-cols-3">
          <ValueProp
            icon={Target}
            accent={accent}
            title="Built for purpose"
            body="Shaped by the practices of world-class product teams. Issues, projects, cycles and initiatives that map to how you actually work."
          />
          <ValueProp
            icon={Gauge}
            accent={accent}
            title="Designed for speed"
            body="Every interaction is optimized for momentum. Instant navigation, an everywhere command menu, and zero waiting."
          />
          <ValueProp
            icon={Keyboard}
            accent={accent}
            title="Keyboard-first"
            body="Create, assign, prioritize and move work without touching the mouse. Power users fly; everyone keeps up."
          />
        </div>
      </section>

      {/* ───── Feature showcases ───── */}
      <div id="features" />
      <Showcase
        index="01"
        eyebrow="Triage"
        title="Turn signal into action"
        body="Capture incoming work in a dedicated triage queue, then accept, merge or reassign in a keystroke. Nothing falls through the cracks."
        bullets={['Dedicated triage inbox', 'Keyboard-driven speedrun mode', 'Bulk accept, merge & assign']}
        accent={accent}
        mockup={<TriageMockup accent={accent} />}
      />

      <Showcase
        index="02"
        eyebrow="Plan"
        title="Define the product direction"
        body="Group issues into projects and projects into initiatives. Plan time-boxed cycles and see the whole roadmap on one timeline."
        bullets={['Projects with health & milestones', 'Time-boxed cycles', 'Roadmap & initiatives']}
        accent={accent}
        reverse
        mockup={<RoadmapMockup accent={accent} />}
      />

      <Showcase
        index="03"
        eyebrow="Build"
        title="Move work forward"
        body="Board and list views, sub-issues, relations and a command menu that does everything. Your team stays in flow from idea to done."
        bullets={['Board & list views', 'Sub-issues & relations', '⌘K command menu']}
        accent={accent}
        mockup={<BoardMockup accent={accent} />}
      />

      <Showcase
        index="04"
        eyebrow="Track"
        title="Understand progress at scale"
        body="Insights dashboards, cycle analytics and a weekly pulse turn raw issue data into the decisions that keep you on track."
        bullets={['Insights dashboards', 'Cycle & velocity analytics', 'Weekly team pulse']}
        accent={accent}
        reverse
        mockup={<InsightsMockup accent={accent} />}
      />

      {/* ───── Capabilities grid ───── */}
      <section id="everything" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Everything in one place</h2>
          <p className="mt-3 text-muted">A complete toolkit — no add-ons, no glue code, no context-switching.</p>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Capability icon={Command} title="Command menu" body="Navigate, create and act from anywhere with ⌘K." accent={accent} />
          <Capability icon={IterationCw} title="Cycles" flag="cycles" body="Time-boxed iterations that keep the team focused." accent={accent} />
          <Capability icon={Layers} title="Projects" flag="projects" body="Health, milestones and progress at a glance." accent={accent} />
          <Capability icon={Target} title="Initiatives" flag="initiatives" body="Roll projects up into strategic bets." accent={accent} />
          <Capability icon={Boxes} title="Sub-issues & relations" body="Break work down and link what blocks what." accent={accent} />
          <Capability icon={Tag} title="Labels & filters" body="Slice your work any way you need it." accent={accent} />
          <Capability icon={Inbox} title="Notification inbox" body="Everything that needs you, in one feed." accent={accent} />
          <Capability icon={Bookmark} title="Saved views" body="Save any filter as a one-click view." accent={accent} />
          <Capability icon={BarChart3} title="Insights" flag="insights" body="Dashboards over your issue data." accent={accent} />
          <Capability icon={GitBranch} title="Releases" flag="releases" body="Plan releases and ship a changelog." accent={accent} />
          <Capability icon={Bell} title="Reminders & rules" body="Automate notifications the way you want." accent={accent} />
          <Capability icon={Moon} title="Light & dark" body="A polished theme for any time of day." accent={accent} />
        </div>
      </section>

      {/* ───── Workflow / principles band ───── */}
      <section id="workflow" className="border-y border-border bg-bg-secondary">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-3">
          <Principle stat="⌘K" label="Do anything from the command menu — no menus to hunt through." />
          <Principle stat="0ms" label="Optimistic, local-first interactions that feel instant." />
          <Principle stat="100%" label="Keyboard coverage — every action has a shortcut." />
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">Built for the future. Available today.</h2>
        <p className="mx-auto mt-4 max-w-lg text-muted">
          Join your team on {name} and feel the difference a fast, focused tool makes.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            to={primaryCta.to}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            style={{ background: accent }}
          >
            {primaryCta.label} <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-fg transition hover:bg-bg-hover">
            Sign in
          </Link>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-5">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ background: accent }}>
                  <Zap size={16} />
                </span>
                {name}
              </div>
              <p className="mt-3 max-w-xs text-sm text-faint">The issue tracker built for speed.</p>
            </div>
            <FooterCol title="Product" links={[['Features', '#features'], ['Workflow', '#workflow'], ['Capabilities', '#everything']]} />
            <FooterCol title="Get started" links={[['Sign up', '/register'], ['Sign in', '/login'], ['Open app', '/']]} internal />
            <FooterCol title="Developers" links={[['API reference', '/api-docs'], ['llms.txt', '/llms.txt']]} internal />
            <FooterCol title="Resources" links={[['Sitemap', '/sitemap.xml'], ['robots.txt', '/robots.txt']]} internal />
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-sm text-faint sm:flex-row">
            <span>© {new Date().getFullYear()} {name}</span>
            <span>Plan. Build. Ship.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ───────────────────────── building blocks ───────────────────────── */

function ValueProp({ icon: Icon, title, body, accent }: { icon: typeof Zap; title: string; body: string; accent: string }) {
  return (
    <div>
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${accent}1f`, color: accent }}>
        <Icon size={20} />
      </span>
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  )
}

function Showcase({
  index, eyebrow, title, body, bullets, mockup, accent, reverse,
}: {
  index: string; eyebrow: string; title: string; body: string; bullets: string[]; mockup: ReactNode; accent: string; reverse?: boolean
}) {
  return (
    <section className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2">
        <div className={reverse ? 'md:order-2' : ''}>
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: accent }}>
            <span className="tabular-nums opacity-60">{index}</span>
            <span>{eyebrow}</span>
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
          <p className="mt-4 max-w-md text-muted">{body}</p>
          <ul className="mt-6 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: `${accent}1f`, color: accent }}>
                  <Check size={12} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className={reverse ? 'md:order-1' : ''}>{mockup}</div>
      </div>
    </section>
  )
}

function Capability({ icon: Icon, title, body, accent, flag }: { icon: typeof Zap; title: string; body: string; accent: string; flag?: string }) {
  const enabled = useFeature(flag ?? 'projects')
  if (flag && !enabled) return null
  return (
    <div className="bg-bg p-6">
      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${accent}1f`, color: accent }}>
        <Icon size={18} />
      </span>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  )
}

function Principle({ stat, label }: { stat: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-4xl font-semibold tracking-tight">{stat}</div>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{label}</p>
    </div>
  )
}

function FooterCol({ title, links, internal }: { title: string; links: [string, string][]; internal?: boolean }) {
  return (
    <div>
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm text-faint">
        {links.map(([label, href]) => (
          <li key={label}>
            {internal && href.startsWith('/') && !href.includes('.') ? (
              <Link to={href} className="hover:text-fg">{label}</Link>
            ) : (
              <a href={href} className="hover:text-fg">{label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ───────────────────────── CSS product mockups ───────────────────────── */

function Window({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg shadow-2xl shadow-black/5">
      <div className="flex items-center gap-1.5 border-b border-border bg-bg-secondary px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#eb5da8]/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f2994a]/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#4cb782]/60" />
      </div>
      {children}
    </div>
  )
}

const STATUS = { todo: '#bec2c8', started: '#f2994a', review: '#4ea7fc', done: '#4cb782' } as const

function Row({ id, title, color, label, accent }: { id: string; title: string; color: string; label?: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0">
      <span className="h-3 w-3 shrink-0 rounded-full border-2" style={{ borderColor: color }} />
      <span className="w-12 shrink-0 text-[11px] tabular-nums text-faint">{id}</span>
      <span className="flex-1 truncate text-[13px]">{title}</span>
      {label && (
        <span className="hidden rounded px-1.5 py-0.5 text-[10px] sm:inline" style={{ background: `${accent}1f`, color: accent }}>
          {label}
        </span>
      )}
      <span className="h-5 w-5 shrink-0 rounded-full" style={{ background: accent }} />
    </div>
  )
}

function AppMockup({ accent }: { accent: string }) {
  return (
    <Window>
      <div className="flex text-left">
        <aside className="hidden w-44 shrink-0 border-r border-border bg-bg-secondary p-3 sm:block">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: accent }}>F</span>
            <span className="text-xs font-semibold">Flint Task</span>
          </div>
          {['Inbox', 'My Issues', 'Projects', 'Cycles', 'Roadmap', 'Insights'].map((x, i) => (
            <div key={x} className={'flex items-center gap-2 rounded px-2 py-1 text-[11px] ' + (i === 1 ? 'bg-bg-selected text-fg' : 'text-muted')}>
              <span className="h-2.5 w-2.5 rounded" style={{ background: i === 1 ? accent : 'var(--border-strong)' }} />
              {x}
            </div>
          ))}
        </aside>
        <div className="min-w-0 flex-1">
          <div className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted">Active Issues</div>
          <Row id="FT-128" title="Polish the command menu animations" color={STATUS.started} label="Design" accent={accent} />
          <Row id="FT-127" title="Sub-issue progress rollups" color={STATUS.review} label="Feature" accent={accent} />
          <Row id="FT-124" title="Keyboard nav in board view" color={STATUS.started} label="Bug" accent={accent} />
          <Row id="FT-121" title="Cycle carry-over rules" color={STATUS.todo} label="Feature" accent={accent} />
          <Row id="FT-118" title="Dark mode contrast pass" color={STATUS.done} label="Polish" accent={accent} />
        </div>
      </div>
    </Window>
  )
}

function TriageMockup({ accent }: { accent: string }) {
  return (
    <Window>
      <div className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted">Triage · 3 pending</div>
      <Row id="FT-130" title="Crash when filtering empty cycle" color={STATUS.todo} label="Bug" accent={accent} />
      <Row id="FT-129" title="Request: bulk re-assign from board" color={STATUS.todo} label="Customer" accent={accent} />
      <Row id="FT-126" title="Typo on the projects empty state" color={STATUS.todo} label="Polish" accent={accent} />
      <div className="flex items-center gap-2 px-4 py-3 text-[11px] text-faint">
        <kbd className="rounded border border-border px-1.5 py-0.5">A</kbd> accept
        <kbd className="rounded border border-border px-1.5 py-0.5">M</kbd> merge
        <kbd className="rounded border border-border px-1.5 py-0.5">→</kbd> next
      </div>
    </Window>
  )
}

function RoadmapMockup({ accent }: { accent: string }) {
  const bars = [
    { name: 'UI refresh', start: 0, len: 5, c: accent },
    { name: 'Cycles v2', start: 2, len: 4, c: STATUS.started },
    { name: 'Insights', start: 4, len: 5, c: STATUS.review },
    { name: 'Mobile', start: 6, len: 3, c: STATUS.done },
  ]
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
  return (
    <Window>
      <div className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted">Roadmap</div>
      <div className="p-4">
        <div className="mb-2 grid grid-cols-9 text-[9px] text-faint">
          {months.map((m) => <span key={m} className="text-center">{m}</span>)}
        </div>
        <div className="space-y-2">
          {bars.map((b) => (
            <div key={b.name} className="grid grid-cols-9 items-center gap-0">
              <div
                className="flex h-6 items-center rounded px-2 text-[10px] font-medium text-white"
                style={{ background: b.c, gridColumnStart: b.start + 1, gridColumnEnd: b.start + 1 + b.len }}
              >
                {b.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Window>
  )
}

function BoardMockup({ accent }: { accent: string }) {
  const cols = [
    { name: 'Todo', color: STATUS.todo, cards: ['Refine onboarding', 'Audit empty states'] },
    { name: 'In Progress', color: STATUS.started, cards: ['Command menu polish', 'Board keyboard nav'] },
    { name: 'Done', color: STATUS.done, cards: ['Dark mode pass'] },
  ]
  return (
    <Window>
      <div className="grid grid-cols-3 gap-3 p-4">
        {cols.map((c) => (
          <div key={c.name}>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} /> {c.name}
            </div>
            <div className="space-y-2">
              {c.cards.map((card) => (
                <div key={card} className="rounded-lg border border-border bg-bg-secondary p-2.5">
                  <p className="text-[11px] leading-snug">{card}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="rounded px-1 py-0.5 text-[9px]" style={{ background: `${accent}1f`, color: accent }}>Feature</span>
                    <span className="ml-auto h-4 w-4 rounded-full" style={{ background: accent }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Window>
  )
}

function InsightsMockup({ accent }: { accent: string }) {
  const heights = [40, 62, 48, 80, 70, 95, 88]
  return (
    <Window>
      <div className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted">Insights · Issues completed</div>
      <div className="grid grid-cols-3 gap-3 p-4">
        <Stat label="Scope" value="142" accent={accent} />
        <Stat label="Done" value="98" accent={accent} />
        <Stat label="Velocity" value="+12%" accent={accent} />
      </div>
      <div className="flex h-28 items-end gap-2 px-4 pb-5">
        {heights.map((h, i) => (
          <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === heights.length - 1 ? accent : `${accent}55` }} />
        ))}
      </div>
    </Window>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-3">
      <div className="text-[10px] uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-1 text-xl font-semibold" style={{ color: accent }}>{value}</div>
    </div>
  )
}
