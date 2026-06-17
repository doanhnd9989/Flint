import { useState, type ReactNode } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Popover } from './ui/Popover'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function Calendar({
  value,
  onChange,
  close,
}: {
  value?: string
  onChange: (iso?: string) => void
  close: () => void
}) {
  const selected = value ? new Date(value) : undefined
  const [view, setView] = useState(() => startOfMonth(selected ?? new Date()))

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(view)),
    end: endOfWeek(endOfMonth(view)),
  })

  return (
    <div className="w-60 p-1">
      <div className="mb-1 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setView((v) => subMonths(v, 1))}
          className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-bg-hover"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-[13px] font-medium text-fg">
          {format(view, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={() => setView((v) => addMonths(v, 1))}
          className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-bg-hover"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="py-1 text-center text-[11px] text-faint">
            {w}
          </div>
        ))}
        {days.map((day) => {
          const isSelected = selected && isSameDay(day, selected)
          const outside = !isSameMonth(day, view)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => {
                onChange(day.toISOString())
                close()
              }}
              className={cn(
                'flex h-7 items-center justify-center rounded text-[12px]',
                outside ? 'text-faint' : 'text-fg',
                isToday(day) && !isSelected && 'font-semibold text-accent',
                isSelected
                  ? 'bg-accent text-white'
                  : 'hover:bg-bg-hover',
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-border px-1 pt-1">
        <button
          type="button"
          onClick={() => {
            onChange(new Date().toISOString())
            close()
          }}
          className="rounded px-1.5 py-1 text-[12px] text-muted hover:bg-bg-hover"
        >
          Today
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(undefined)
              close()
            }}
            className="rounded px-1.5 py-1 text-[12px] text-[var(--priority-urgent)] hover:bg-bg-hover"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

export function DatePicker({
  value,
  onChange,
  trigger,
  align,
}: {
  value?: string
  onChange: (iso?: string) => void
  trigger: ReactNode
  align?: 'start' | 'end'
}) {
  return (
    <Popover trigger={trigger} align={align} width={248}>
      {(close) => <Calendar value={value} onChange={onChange} close={close} />}
    </Popover>
  )
}
