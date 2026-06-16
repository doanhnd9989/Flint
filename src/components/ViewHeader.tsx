import type { ReactNode } from 'react'

interface Props {
  title: string
  teamName?: string
  teamIcon?: string
  children?: ReactNode
  right?: ReactNode
}

/** Top bar shared by issue/project views: breadcrumb + controls. */
export function ViewHeader({ title, teamName, teamIcon, children, right }: Props) {
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
        <span className="font-medium text-fg">{title}</span>
      </div>
      <div className="ml-2 flex-1">{children}</div>
      {right}
    </header>
  )
}
