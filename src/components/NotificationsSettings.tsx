import { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageSquare,
  Monitor,
  Smartphone,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_GROUPS,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import { NotificationRulesSettings } from './NotificationRulesSettings'
import { Toggle as UIToggle } from './ui/Toggle'
import type {
  ChannelSettings,
  NotificationChannel,
  NotificationEvent,
  NotificationSettings,
} from '@/lib/types'

// ── Settings → Notifications (mirrors Linear's account Notifications page) ────

const CHANNEL_ICON: Record<NotificationChannel, LucideIcon> = {
  desktop: Monitor,
  mobile: Smartphone,
  email: Mail,
  slack: MessageSquare,
}

/** Linear prints a subtitle under the channel title only where the channel
 *  spans more than one device; its Email page has none. */
const CHANNEL_SUBTITLE: Partial<Record<NotificationChannel, string>> = {
  desktop: 'Applies across all your desktop devices with notifications enabled',
  mobile: 'Applies across all your mobile devices with notifications enabled',
}

const ALL_EVENTS = NOTIFICATION_EVENT_GROUPS.flatMap((g) => g.events)
const EVENT_COUNT = ALL_EVENTS.length

/** Persisted channel settings predate the newer event ids, so a missing key
 *  reads as "on" rather than `undefined` — otherwise a stored value from an
 *  older schema renders the row as an uncontrolled toggle. */
function eventOn(ch: ChannelSettings, id: NotificationEvent): boolean {
  return ch.events[id] ?? true
}

/** The grey status line under a channel name on the overview. Linear names the
 *  first two enabled categories and counts the rest — "Enabled for assignments,
 *  status changes, 12 others" — rather than printing a bare N-of-M. */
function channelStatus(ch: ChannelSettings): { label: string; on: boolean } {
  if (!ch.enabled) return { label: 'Disabled', on: false }
  const on = ALL_EVENTS.filter((e) => eventOn(ch, e.id))
  if (on.length === EVENT_COUNT)
    return { label: 'Enabled for all notifications', on: true }
  if (on.length === 0) return { label: 'No notifications enabled', on: false }
  const named = on.slice(0, 2).map((e) => e.label.toLowerCase())
  const rest = on.length - named.length
  const list = rest > 0 ? [...named, `${rest} others`] : named
  return { label: `Enabled for ${list.join(', ')}`, on: true }
}

// ── primitives ───────────────────────────────────────────────────────────────
function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <UIToggle checked={checked} onChange={onChange} />
}

/** A label + optional helper-text row with a trailing control — Linear's setting
 *  row. Several of Linear's rows (the two email-digest ones) carry no hint at
 *  all, so `hint` is optional and the second line is dropped entirely. */
function SettingRow({
  label,
  hint,
  control,
  disabled,
}: {
  label: string
  hint?: string
  control: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-6 py-3',
        disabled && 'opacity-50',
      )}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg">{label}</div>
        {hint && <div className="text-[12px] text-muted">{hint}</div>}
      </div>
      {control}
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <SettingRow
      label={label}
      hint={hint}
      disabled={disabled}
      control={
        <Switch checked={checked} onChange={(v) => !disabled && onChange(v)} />
      }
    />
  )
}

function GroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-7 mb-1 text-[12px] font-medium text-muted">{children}</div>
  )
}

// ── channel detail page (Desktop / Mobile / Email / Slack) ────────────────────
function ChannelDetail({
  channel,
  settings,
  onBack,
}: {
  channel: NotificationChannel
  settings: NotificationSettings
  onBack: () => void
}) {
  const {
    setNotificationChannelEnabled,
    setNotificationEvent,
    updateNotificationSettings,
    me,
  } = useStoreShallow((s) => ({
    setNotificationChannelEnabled: s.setNotificationChannelEnabled,
    setNotificationEvent: s.setNotificationEvent,
    updateNotificationSettings: s.updateNotificationSettings,
    me: s.users.find((u) => u.id === s.currentUserId),
  }))
  const meta = NOTIFICATION_CHANNELS.find((c) => c.id === channel)!
  const ch = settings.channels[channel]
  const on = ch.enabled

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <button
        onClick={onBack}
        className="-ml-1 flex items-center gap-0.5 text-[13px] text-muted hover:text-fg"
      >
        <ChevronLeft size={14} /> Notifications
      </button>
      <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-fg">
        {meta.label}
      </h1>
      {CHANNEL_SUBTITLE[channel] && (
        <p className="mt-1 text-[13px] text-muted">
          {CHANNEL_SUBTITLE[channel]}
        </p>
      )}

      {/* Master enable */}
      <div className="mt-7 border-b border-border">
        <ToggleRow
          label={`Enable ${meta.label.toLowerCase()} notifications`}
          hint={
            channel === 'email' && me
              ? `${meta.label} notifications to ${me.email}`
              : `Receive ${meta.label.toLowerCase()} notifications for workspace activity`
          }
          checked={on}
          onChange={(v) => setNotificationChannelEnabled(channel, v)}
        />

        {/* Linear keeps "Notification format" in the same card as the master
            enable, and it is a Digest/Immediate dropdown — not a toggle. */}
        {channel === 'email' && (
          <>
            <div className="border-t border-border" />
            <SettingRow
              label="Notification format"
              hint="Choose whether to group email notifications"
              disabled={!on}
              control={
                <select
                  value={settings.emailDigest ? 'digest' : 'immediate'}
                  disabled={!on}
                  onChange={(e) =>
                    updateNotificationSettings({
                      emailDigest: e.target.value === 'digest',
                    })
                  }
                  className="rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-fg outline-none"
                >
                  <option value="digest">Digest</option>
                  <option value="immediate">Immediate</option>
                </select>
              }
            />
          </>
        )}
      </div>

      {/* Email-only digest options, matching Linear's Email page. Linear prints
          no helper line under either row — the label is the whole sentence. */}
      {channel === 'email' && (
        <>
          <GroupHeader>Email digest settings</GroupHeader>
          <div className="border-b border-border">
            <ToggleRow
              label="Delay low priority emails outside of work hours until next work day"
              checked={settings.emailDelayLowPriority}
              onChange={(v) =>
                updateNotificationSettings({ emailDelayLowPriority: v })
              }
              disabled={!on}
            />
            <div className="border-t border-border" />
            <ToggleRow
              label="Immediately notify if an issue assigned to you is marked urgent or breaches SLA"
              checked={settings.emailUrgentImmediate}
              onChange={(v) =>
                updateNotificationSettings({ emailUrgentImmediate: v })
              }
              disabled={!on}
            />
          </div>
        </>
      )}

      {/* Per-event matrix */}
      {NOTIFICATION_EVENT_GROUPS.map((group) => (
        <div key={group.header}>
          <GroupHeader>{group.header}</GroupHeader>
          <div className="border-b border-border">
            {group.events.map((ev, i) => (
              <div key={ev.id}>
                {i > 0 && <div className="border-t border-border" />}
                <ToggleRow
                  label={ev.label}
                  hint={ev.hint}
                  checked={eventOn(ch, ev.id)}
                  onChange={(v) => setNotificationEvent(channel, ev.id, v)}
                  disabled={!on}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── overview (channels + "Updates from Linear") ───────────────────────────────
function Overview({
  settings,
  onOpenChannel,
}: {
  settings: NotificationSettings
  onOpenChannel: (c: NotificationChannel) => void
}) {
  const { updateNotificationSettings } = useStoreShallow((s) => ({
    updateNotificationSettings: s.updateNotificationSettings,
  }))

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">
        Notifications
      </h1>

      {/* Notification channels */}
      <section className="mt-7">
        <h2 className="text-[13px] font-semibold text-fg">Push notifications</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          Choose which notifications are pushed to your devices. All
          notifications will still appear in your inbox.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          {NOTIFICATION_CHANNELS.map((c, i) => {
            const Icon = CHANNEL_ICON[c.id]
            const status = channelStatus(settings.channels[c.id])
            return (
              <button
                key={c.id}
                onClick={() => onOpenChannel(c.id)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover',
                  i > 0 && 'border-t border-border',
                )}
              >
                <Icon size={18} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-fg">{c.label}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                    <span
                      className="h-[7px] w-[7px] rounded-full"
                      style={{
                        background: status.on
                          ? 'var(--c-green)'
                          : 'var(--c-red)',
                      }}
                    />
                    {status.label}
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-faint" />
              </button>
            )
          })}
        </div>
      </section>

      {/* Updates from Flint Task */}
      <section className="mt-10">
        <h2 className="text-[13px] font-semibold text-fg">Updates from Flint Task</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          Subscribe to product announcements and important changes from the
          Flint Task team
        </p>

        <GroupHeader>Changelog</GroupHeader>
        <div className="border-b border-border">
          <ToggleRow
            label="Show updates in sidebar"
            hint="Highlight new features and improvements in the app sidebar"
            checked={settings.showUpdatesInSidebar}
            onChange={(v) => updateNotificationSettings({ showUpdatesInSidebar: v })}
          />
          <div className="border-t border-border" />
          <ToggleRow
            label="Changelog newsletter"
            hint="Receive an email twice a month highlighting new features and improvements"
            checked={settings.changelogNewsletter}
            onChange={(v) => updateNotificationSettings({ changelogNewsletter: v })}
          />
        </div>

        <GroupHeader>Marketing</GroupHeader>
        <div className="border-b border-border">
          <ToggleRow
            label="Marketing and onboarding"
            hint="Occasional updates to help you get the most of out of Flint Task"
            checked={settings.marketingOnboarding}
            onChange={(v) => updateNotificationSettings({ marketingOnboarding: v })}
          />
        </div>

        <GroupHeader>Other updates</GroupHeader>
        <div className="border-b border-border">
          <ToggleRow
            label="Invite accepted"
            hint="Email when invitees accept an invite"
            checked={settings.inviteAccepted}
            onChange={(v) => updateNotificationSettings({ inviteAccepted: v })}
          />
          <div className="border-t border-border" />
          <ToggleRow
            label="Privacy and legal updates"
            hint="Email when privacy policies or terms of service change"
            checked={settings.privacyLegal}
            onChange={(v) => updateNotificationSettings({ privacyLegal: v })}
          />
          <div className="border-t border-border" />
          <ToggleRow
            label="Data processing agreement (DPA)"
            hint="Email when our DPA changes"
            checked={settings.dpa}
            onChange={(v) => updateNotificationSettings({ dpa: v })}
          />
        </div>
      </section>

      {/* Advanced if-then notification rules */}
      <NotificationRulesSettings />
    </div>
  )
}

export function NotificationsSettings() {
  const settings = useStoreShallow((s) => s.notificationSettings)
  const [channel, setChannel] = useState<NotificationChannel | null>(null)

  return channel ? (
    <ChannelDetail
      channel={channel}
      settings={settings}
      onBack={() => setChannel(null)}
    />
  ) : (
    <Overview settings={settings} onOpenChannel={setChannel} />
  )
}
