import type { User } from '@/lib/types'
import { initials } from '@/lib/utils'

interface Props {
  user?: User
  size?: number
}

export function Avatar({ user, size = 18 }: Props) {
  if (!user) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full border border-dashed border-border-strong text-faint"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
        aria-hidden
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5z" opacity="0.5" />
        </svg>
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-medium text-white select-none"
      style={{
        width: size,
        height: size,
        background: user.avatarColor,
        fontSize: size * 0.46,
      }}
      title={user.name}
    >
      {initials(user.name)}
    </span>
  )
}
