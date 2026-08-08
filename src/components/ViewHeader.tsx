import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  title: string
  /** Makes the title crumb a link — used when a deeper crumb follows it. */
  titleHref?: string
  /** Extra breadcrumb rendered after the title, behind its own `›`. */
  trail?: ReactNode
  teamName?: string
  teamIcon?: string
  children?: ReactNode
  right?: ReactNode
}

/** Top bar shared by issue/project views: breadcrumb + controls. */
export function ViewHeader({
  title,
  titleHref,
  trail,
  teamName,
  teamIcon,
  children,
  right,
}: Props) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
      <div className="flex items-center gap-1.5 text-[13px]">
        {teamName && (
          <>
            <span>{teamIcon}</span>
            <span className="font-medium text-fg">{teamName}</span>
            <span className="text-faint">›</span>
          </>
        )}
        {titleHref ? (
          <Link to={titleHref} className="font-medium text-fg hover:text-accent">
            {title}
          </Link>
        ) : (
          <span className="font-medium text-fg">{title}</span>
        )}
        {trail && (
          <>
            <span className="text-faint">›</span>
            {trail}
          </>
        )}
      </div>
      {/* Flex so callers can pass sibling controls (a count plus an `ml-auto`
          control group) and still sit on one line. */}
      <div className="ml-2 flex flex-1 items-center gap-2">{children}</div>
      {right}
    </header>
  )
}
