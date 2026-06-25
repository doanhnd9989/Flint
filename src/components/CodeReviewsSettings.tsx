import { GitBranch } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ── Settings → Code & reviews (mirrors Linear's account Code & reviews page) ──

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-[18px] w-[30px] rounded-full transition-colors',
        on ? 'bg-accent' : 'bg-[var(--border)]',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform',
          on ? 'translate-x-[14px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-secondary">
      {children}
    </div>
  )
}

function Row({
  icon,
  title,
  description,
  control,
}: {
  icon?: ReactNode
  title: string
  description?: string
  control: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-fg">{title}</div>
          {description && (
            <div className="mt-0.5 text-[12px] text-muted">{description}</div>
          )}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function CodeReviewsSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)

  const get = (key: string, fallback: boolean) => featureSettings[key] ?? fallback
  const toggle = (key: string, fallback: boolean) => (
    <Toggle on={get(key, fallback)} onChange={(v) => setFeatureSetting(key, v)} />
  )

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">
        Code &amp; reviews
      </h1>
      <p className="mt-1 text-[13px] text-muted">
        Connect your code host and tune how pull requests sync with issues.
      </p>

      <div className="mt-7 space-y-9">
        {/* Connected account */}
        <Card>
          <Row
            icon={
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-tertiary text-fg">
                <GitBranch size={16} />
              </span>
            }
            title="GitHub"
            description="@you"
            control={
              <button
                type="button"
                className="text-[13px] font-medium text-muted transition-colors hover:text-fg"
              >
                Disconnect
              </button>
            }
          />
        </Card>

        {/* Pull request automation */}
        <Card>
          <Row
            title="Link pull requests to issues"
            description="Automatically attach a pull request to the issue referenced in its branch or description."
            control={toggle('code.linkPrs', true)}
          />
          <Row
            title="Move issue to In Progress when a PR is opened"
            description="Update the issue status as soon as a draft or open pull request appears."
            control={toggle('code.prInProgress', true)}
          />
          <Row
            title="Move issue to In Review when a PR is ready for review"
            description="Switch the linked issue to In Review when the pull request leaves draft."
            control={toggle('code.prInReview', true)}
          />
          <Row
            title="Move issue to Done when a PR is merged"
            description="Close the linked issue once its pull request is merged."
            control={toggle('code.prMerged', true)}
          />
          <Row
            title="Comment on the issue with PR status"
            description="Post a comment summarizing the pull request whenever its status changes."
            control={toggle('code.prComment', false)}
          />
        </Card>

        {/* Branch format */}
        <Card>
          <Row
            title="Branch name format"
            description="Branch names generated from an issue follow this pattern."
            control={
              <span className="rounded-md border border-border bg-bg-secondary px-2 py-1 text-[12px] font-mono text-muted">
                username/cla-123-issue-title
              </span>
            }
          />
          <Row
            title="Copy branch name to clipboard on issue open"
            description="Automatically copy the issue's branch name when you open it."
            control={toggle('code.copyBranch', false)}
          />
        </Card>
      </div>
    </div>
  )
}
