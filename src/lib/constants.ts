import type { Priority, StatusType } from './types'

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
}

/** Visual order used in pickers and sorting (urgent first, none last). */
export const PRIORITY_ORDER: Priority[] = [1, 2, 3, 4, 0]

/** Sort weight — lower sorts first. Urgent highest, none lowest. */
export const PRIORITY_SORT: Record<Priority, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  0: 4,
}

export const STATUS_TYPE_ORDER: Record<StatusType, number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  completed: 3,
  canceled: 4,
}

export const LABEL_COLORS = [
  '#95a2b3',
  '#eb5757',
  '#f2994a',
  '#f2c94c',
  '#4cb782',
  '#5e9aa8',
  '#4ea7fc',
  '#5e6ad2',
  '#9b51e0',
  '#eb5da8',
  '#a17c5b',
] as const

export const ESTIMATE_SCALE = [0, 1, 2, 3, 5, 8] as const

export const STORAGE_KEY = 'linear-clone-store-v1'
