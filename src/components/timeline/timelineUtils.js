/*
 * Tab ② helpers — pure functions between vault events (timeline/events.json)
 * and vis-timeline items. No React, no vis imports.
 *
 * Dates: the vault stores plain 'YYYY-MM-DD' strings (human-readable,
 * Obsidian-friendly). We parse them as LOCAL dates and serialize back from
 * local components, so a drag on the timeline never shifts a date across
 * midnight because of the UTC offset.
 */
import { slugify } from '../../lib/markdown.js'

export const GROUPS = [
  { id: 'case-1994', content: 'The Case — 1994', order: 1 },
  { id: 'frame-2024', content: 'The Frame — 2024', order: 2 },
]

export const DEFAULT_COLORS = {
  'case-1994': '#b5533c', // rust — the case
  'frame-2024': '#4fa3a5', // teal — present day
}

export const PRIORITIES = ['high', 'medium', 'low']

// Swatch presets for the event color picker (noir palette + case/frame hues)
export const EVENT_COLORS = [
  '#b5533c', '#c96a4f', '#8f4230', '#d9a441',
  '#4fa3a5', '#7d9471', '#7b6ca8', '#8b919c',
]

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/** Event color, validated (colors end up in inline style strings). */
export function safeColor(color, group) {
  const c = String(color || '').trim()
  return HEX_RE.test(c) ? c : (DEFAULT_COLORS[group] || '#d9a441')
}

export function clampWeight(w) {
  const n = Math.round(Number(w))
  if (!Number.isFinite(n)) return 3
  return Math.min(5, Math.max(1, n))
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

/** 'YYYY-MM-DD' → local-midnight Date; Dates pass through; else null. */
export function parseISODate(value) {
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim())
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (value == null || value === '') return null
  const d = new Date(value)
  return Number.isNaN(d.valueOf()) ? null : d
}

/** Date (or parseable value) → 'YYYY-MM-DD' from LOCAL components. */
export function toISODate(value) {
  const d = parseISODate(value)
  if (!d) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Weight → border-left thickness, priority low → slightly dimmed. */
export function itemStyle(event) {
  const color = safeColor(event.color, event.group)
  const width = 2 + clampWeight(event.weight)
  const dim = event.priority === 'low' ? ' opacity: 0.75;' : ''
  return `border-left: ${width}px solid ${color};${dim}`
}

/** Vault event → vis-timeline item (title attr = summary, for hover). */
export function eventToItem(event) {
  const tooltip = event.summary || event.title || ''
  return {
    id: event.id,
    content: escapeHtml(event.title || 'Untitled'),
    start: parseISODate(event.start),
    end: event.end ? parseISODate(event.end) : null, // null (not undefined) so DataSet.update clears a removed end
    group: event.group || GROUPS[0].id,
    title: tooltip ? escapeHtml(tooltip) : null,
    style: itemStyle(event),
  }
}

/**
 * Events → vis items, skipping entries the timeline cannot place (no id or
 * unparseable start). Skipped events still appear in the structure panel.
 */
export function eventsToItems(events) {
  return events.filter((e) => e.id && parseISODate(e.start)).map(eventToItem)
}

/** The two canonical groups plus a row for any unknown group id in the data. */
export function buildGroups(events) {
  const groups = GROUPS.map((g) => ({ ...g }))
  const known = new Set(groups.map((g) => g.id))
  for (const e of events) {
    if (e.group && !known.has(e.group)) {
      known.add(e.group)
      groups.push({ id: e.group, content: escapeHtml(e.group), order: groups.length + 1 })
    }
  }
  return groups
}

const DAY = 1000 * 60 * 60 * 24

const PRESET_FALLBACKS = {
  'case-1994': ['1994-01-01', '1995-01-01'],
  'frame-2024': ['2024-01-01', '2025-01-01'],
  all: ['1993-06-01', '2025-06-01'],
}

/** Visible window for the [1994 Case] [2024 Frame] [All] preset buttons. */
export function presetRange(events, preset) {
  const scoped = preset === 'all' ? events : events.filter((e) => e.group === preset)
  const times = []
  for (const e of scoped) {
    const s = parseISODate(e.start)
    if (s) times.push(s.valueOf())
    const en = e.end ? parseISODate(e.end) : null
    if (en) times.push(en.valueOf())
  }
  if (times.length === 0) {
    const [a, b] = PRESET_FALLBACKS[preset] || PRESET_FALLBACKS.all
    return { start: parseISODate(a), end: parseISODate(b) }
  }
  const min = Math.min(...times)
  const max = Math.max(...times)
  const pad = Math.max((max - min) * 0.06, 10 * DAY)
  return { start: new Date(min - pad), end: new Date(max + pad) }
}

/** Group of the event nearest to `date` — sensible default for a new event. */
export function nearestGroup(events, date) {
  const t = date.valueOf()
  let best = null
  let bestDist = Infinity
  for (const e of events) {
    const s = parseISODate(e.start)
    if (!s) continue
    const d = Math.abs(s.valueOf() - t)
    if (d < bestDist) {
      bestDist = d
      best = e.group
    }
  }
  return best || GROUPS[0].id
}

/** Unique slug id for a new event. */
export function makeEventId(title, events) {
  const base = slugify(title || 'event')
  const ids = new Set(events.map((e) => e.id))
  let id = base
  let i = 2
  while (ids.has(id)) id = `${base}-${i++}`
  return id
}

/** Fresh event draft for the overlay (id assigned at save time). */
export function blankEvent(seed = {}) {
  const group = seed.group || GROUPS[0].id
  return {
    id: '',
    title: '',
    start: seed.start || toISODate(new Date()),
    group,
    color: DEFAULT_COLORS[group] || '#d9a441',
    weight: 3,
    priority: 'medium',
    beat: '',
    summary: '',
    detail: '',
  }
}
