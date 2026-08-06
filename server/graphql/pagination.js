// Relay-style connections and comparator filtering, matching Linear's contract
// (https://linear.app/developers/pagination, /filtering).

/** Linear returns the first 50 results when no page arguments are given. */
export const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 250

const encodeCursor = (id) => Buffer.from(String(id)).toString('base64')
const decodeCursor = (c) => {
  try {
    return Buffer.from(String(c), 'base64').toString('utf8')
  } catch {
    return null
  }
}

/**
 * Slice an already-sorted array into a connection.
 * Honours first/last/after/before exactly as Linear documents them.
 */
export function connect(all, args = {}) {
  const { first, last, after, before } = args
  let rows = all

  if (after) {
    const id = decodeCursor(after)
    const idx = rows.findIndex((r) => String(r.id) === id)
    if (idx >= 0) rows = rows.slice(idx + 1)
  }
  if (before) {
    const id = decodeCursor(before)
    const idx = rows.findIndex((r) => String(r.id) === id)
    if (idx >= 0) rows = rows.slice(0, idx)
  }

  const totalAfterCursors = rows.length
  let hasNextPage = false
  let hasPreviousPage = !!after

  if (typeof last === 'number') {
    const size = Math.min(Math.max(last, 1), MAX_PAGE_SIZE)
    hasPreviousPage = rows.length > size
    rows = rows.slice(-size)
  } else {
    const size = Math.min(Math.max(typeof first === 'number' ? first : DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
    hasNextPage = totalAfterCursors > size
    rows = rows.slice(0, size)
  }

  const edges = rows.map((node) => ({ node, cursor: encodeCursor(node.id) }))
  return {
    nodes: rows,
    edges,
    totalCount: all.length,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor: edges.length ? edges[0].cursor : null,
      endCursor: edges.length ? edges[edges.length - 1].cursor : null,
    },
  }
}

/** Linear orders by createdAt unless `orderBy: updatedAt` is passed. */
export function sortRows(rows, orderBy) {
  const key = orderBy === 'updatedAt' ? 'updatedAt' : 'createdAt'
  return [...rows].sort((a, b) => String(b[key] ?? '').localeCompare(String(a[key] ?? '')))
}

const lower = (v) => (v == null ? v : String(v).toLowerCase())

/** Evaluate one comparator object ({ eq, contains, gt, … }) against a value. */
export function matchComparator(value, cmp) {
  if (cmp == null || typeof cmp !== 'object') return true
  for (const [op, want] of Object.entries(cmp)) {
    if (want === undefined) continue
    switch (op) {
      case 'eq':
        if (value !== want) return false
        break
      case 'neq':
        if (value === want) return false
        break
      case 'in':
        if (!Array.isArray(want) || !want.includes(value)) return false
        break
      case 'nin':
        if (Array.isArray(want) && want.includes(value)) return false
        break
      case 'null':
        if (want === true && value != null) return false
        if (want === false && value == null) return false
        break
      case 'lt':
        if (!(value != null && value < want)) return false
        break
      case 'lte':
        if (!(value != null && value <= want)) return false
        break
      case 'gt':
        if (!(value != null && value > want)) return false
        break
      case 'gte':
        if (!(value != null && value >= want)) return false
        break
      case 'eqIgnoreCase':
        if (lower(value) !== lower(want)) return false
        break
      case 'neqIgnoreCase':
        if (lower(value) === lower(want)) return false
        break
      case 'startsWith':
        if (!String(value ?? '').startsWith(want)) return false
        break
      case 'notStartsWith':
        if (String(value ?? '').startsWith(want)) return false
        break
      case 'endsWith':
        if (!String(value ?? '').endsWith(want)) return false
        break
      case 'notEndsWith':
        if (String(value ?? '').endsWith(want)) return false
        break
      case 'contains':
        if (!String(value ?? '').includes(want)) return false
        break
      case 'notContains':
        if (String(value ?? '').includes(want)) return false
        break
      case 'containsIgnoreCase':
        if (!lower(value ?? '').includes(lower(want))) return false
        break
      case 'notContainsIgnoreCase':
        if (lower(value ?? '').includes(lower(want))) return false
        break
      default:
        // Unknown operators are ignored rather than failing the whole query,
        // which keeps clients written against a newer schema working.
        break
    }
  }
  return true
}

/**
 * Apply a filter object to a row.
 *
 * `fields` maps each filter key to either a scalar getter (compared with
 * `matchComparator`) or `{ relation: getterReturningRelatedRow, filter: fieldsForThatType }`
 * for nested relation filters, or `{ collection: getterReturningRows, filter }`
 * for many-to-many filters (which honour `every` / `some`).
 * `and` / `or` are handled here so every filter type gets them for free.
 */
export function matchFilter(row, filter, fields, ctx) {
  if (!filter || typeof filter !== 'object') return true

  for (const [key, cond] of Object.entries(filter)) {
    if (cond === undefined) continue

    if (key === 'and') {
      if (!cond.every((f) => matchFilter(row, f, fields, ctx))) return false
      continue
    }
    if (key === 'or') {
      if (!cond.some((f) => matchFilter(row, f, fields, ctx))) return false
      continue
    }

    const spec = fields[key]
    if (!spec) continue

    if (typeof spec === 'function') {
      if (!matchComparator(spec(row, ctx), cond)) return false
      continue
    }

    if (spec.relation) {
      const related = spec.relation(row, ctx)
      if (!related) return false
      if (!matchFilter(related, cond, spec.filter, ctx)) return false
      continue
    }

    if (spec.collection) {
      const items = spec.collection(row, ctx) || []
      const { every, some, ...direct } = cond
      if (every && !items.every((i) => matchFilter(i, every, spec.filter, ctx))) return false
      if (some && !items.some((i) => matchFilter(i, some, spec.filter, ctx))) return false
      // Bare comparators on a collection mean "some related record matches",
      // which is Linear's default for many-to-many filters.
      if (Object.keys(direct).length && !items.some((i) => matchFilter(i, direct, spec.filter, ctx))) {
        return false
      }
    }
  }
  return true
}
