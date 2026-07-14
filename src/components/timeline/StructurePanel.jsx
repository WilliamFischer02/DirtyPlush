/*
 * Structure-arc panel (bottom half of tab ②).
 * The craft beats from structure/beats.json rendered as a horizontal track
 * whose columns rise and fall along a dramatic arc (peaking near the
 * climax). Hovering or focusing a beat shows its full craft explanation in
 * the detail strip below; each beat lists its assigned timeline events as
 * clickable chips, and a small "+" assigns any unassigned event. Beat text
 * is editable and persists via saveBeats.
 */
import { useEffect, useMemo, useState } from 'react'
import { renderMarkdown } from '../../lib/markdown.js'
import { safeColor } from './timelineUtils.js'

const ARC_RISE = 36 // px the track climbs toward the climax
const COL_MIN = 158 // min column width before the track scrolls

/** 0..1 dramatic-arc height at position t (0..1); peaks near t ≈ 0.8. */
function arcHeight(t) {
  return Math.sin(Math.PI * Math.pow(t, 3))
}

function columnOffset(i, n) {
  if (n < 2) return ARC_RISE
  return Math.round((1 - arcHeight((i + 0.5) / n)) * ARC_RISE)
}

function ArcCurve({ n }) {
  if (n < 2) return null
  const h = ARC_RISE + 14
  const steps = 48
  const pts = []
  for (let s = 0; s <= steps; s++) {
    const t = 0.5 / n + (s / steps) * ((n - 0.5) / n - 0.5 / n)
    pts.push(`${(t * 1000).toFixed(1)},${((1 - arcHeight(t)) * ARC_RISE + 7).toFixed(1)}`)
  }
  return (
    <svg
      className="absolute inset-x-3 top-1.5 pointer-events-none"
      style={{ width: 'calc(100% - 24px)', height: h }}
      viewBox={`0 0 1000 ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--color-accent-dim)"
        strokeOpacity="0.45"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function StructurePanel({ beats, events, saveBeats, onOpenEvent, onAssign }) {
  const sorted = useMemo(
    () => [...beats].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [beats],
  )
  const [activeId, setActiveId] = useState(null)
  const active = sorted.find((b) => b.id === activeId) || sorted[0] || null

  const [menu, setMenu] = useState(null) // { beatId, x, y } for the "+" assign popover
  const [editDraft, setEditDraft] = useState(null) // beat edit form state
  const [saving, setSaving] = useState(false)

  const eventsByBeat = useMemo(() => {
    const map = new Map()
    for (const e of events) {
      const key = e.beat || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e)
    }
    for (const list of map.values()) {
      list.sort((a, b) => String(a.start).localeCompare(String(b.start)))
    }
    return map
  }, [events])
  const unassigned = eventsByBeat.get('') || []

  // Close the assign popover on any click outside it
  useEffect(() => {
    if (!menu) return undefined
    const onDown = (e) => {
      if (e.target instanceof Element && e.target.closest('[data-assign-menu]')) return
      setMenu(null)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menu])

  const openMenu = (beatId, e) => {
    if (menu?.beatId === beatId) {
      setMenu(null)
      return
    }
    const r = e.currentTarget.getBoundingClientRect()
    setMenu({
      beatId,
      x: Math.min(r.left, window.innerWidth - 268),
      y: r.bottom + 4,
    })
  }

  const startEdit = () => {
    if (!active) return
    setEditDraft({
      id: active.id,
      label: active.label || '',
      chapter: active.chapter ?? '',
      chapterTitle: active.chapterTitle || '',
      summary: active.summary || '',
      craft: active.craft || '',
    })
  }

  const saveBeat = async () => {
    const d = editDraft
    if (!d) return
    setSaving(true)
    try {
      const chapter = Number(d.chapter)
      await saveBeats(beats.map((b) => (
        b.id === d.id
          ? {
              ...b,
              label: d.label.trim() || b.label,
              chapter: Number.isFinite(chapter) && d.chapter !== '' ? chapter : b.chapter,
              chapterTitle: d.chapterTitle,
              summary: d.summary,
              craft: d.craft,
            }
          : b
      )))
      setEditDraft(null)
    } finally {
      setSaving(false)
    }
  }

  const n = sorted.length

  return (
    <div className="flex-1 min-h-0 flex flex-col border-t border-edge">
      {/* panel header */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-1.5 border-b border-edge bg-panel">
        <span className="text-[11px] uppercase tracking-wider text-ink-faint">Structure arc</span>
        <span className="hidden md:block text-[11px] text-ink-faint">
          hover a beat for craft notes · click a chip to open its event · + assigns an unassigned event
        </span>
        <span className="ml-auto text-[11px] text-ink-faint">
          {unassigned.length} unassigned event{unassigned.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* beat track */}
      <div className="shrink-0 overflow-x-auto overflow-y-hidden bg-panel">
        <div
          className="relative flex items-start gap-2 px-3 pt-1.5 pb-2.5"
          style={{ minWidth: n * COL_MIN }}
        >
          <ArcCurve n={n} />
          {sorted.map((b, i) => {
            const assigned = eventsByBeat.get(b.id) || []
            const isActive = active?.id === b.id
            return (
              <div
                key={b.id}
                className="relative flex-1 min-w-0 z-10"
                style={{ paddingTop: columnOffset(i, n) }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  className={
                    'card px-2.5 py-1.5 cursor-pointer transition-colors outline-none ' +
                    (isActive
                      ? 'border-accent-dim bg-panel-3'
                      : 'hover:bg-panel-3 focus:border-accent-dim')
                  }
                  onMouseEnter={() => setActiveId(b.id)}
                  onFocus={() => setActiveId(b.id)}
                  onClick={() => setActiveId(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveId(b.id)
                    }
                  }}
                >
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span
                      className="text-[10px] text-ink-faint shrink-0"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {b.order}
                    </span>
                    <span className={'text-[13px] font-medium truncate ' + (isActive ? 'text-accent' : 'text-ink')}>
                      {b.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-dim truncate">
                    ch. {b.chapter} · {b.chapterTitle}
                  </div>
                </div>

                {/* assigned event chips + assign button */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {assigned.map((e) => (
                    <span
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      className="inline-flex items-center gap-1 max-w-full rounded-full border border-edge bg-panel-2 pl-1.5 pr-0.5 py-0.5 text-[11px] text-ink-dim hover:text-ink hover:border-accent-dim cursor-pointer"
                      title={e.summary || e.title}
                      onClick={() => onOpenEvent(e.id)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') onOpenEvent(e.id)
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: safeColor(e.color, e.group) }}
                      />
                      <span className="truncate max-w-28">{e.title}</span>
                      <button
                        className="px-1 text-ink-faint hover:text-rust cursor-pointer"
                        title="Unassign from this beat"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          onAssign(e.id, '')
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    data-assign-menu
                    className="w-5 h-5 rounded-full border border-edge text-ink-faint text-xs leading-none hover:text-accent hover:border-accent-dim cursor-pointer shrink-0"
                    title="Assign an unassigned event to this beat"
                    onClick={(e) => openMenu(b.id, e)}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
          {n === 0 && (
            <div className="text-sm text-ink-faint px-1 py-3">
              No beats found — structure/beats.json is empty.
            </div>
          )}
        </div>
      </div>

      {/* assign popover (fixed so the scrolling track can't clip it) */}
      {menu && (
        <div
          data-assign-menu
          className="fixed z-40 w-64 card shadow-2xl p-1 overflow-y-auto"
          style={{ left: menu.x, top: menu.y, maxHeight: Math.max(120, window.innerHeight - menu.y - 12) }}
        >
          <div className="label px-2 pt-1.5">Assign to {sorted.find((b) => b.id === menu.beatId)?.label || 'beat'}</div>
          {unassigned.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-ink-faint">
              No unassigned events. Open an event and change its Beat to move it here.
            </div>
          ) : (
            unassigned.map((e) => (
              <button
                key={e.id}
                className="w-full flex items-center gap-1.5 text-left px-2 py-1.5 rounded text-xs text-ink-dim hover:bg-panel-3 hover:text-ink cursor-pointer"
                onClick={() => {
                  onAssign(e.id, menu.beatId)
                  setMenu(null)
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: safeColor(e.color, e.group) }}
                />
                <span className="truncate">{e.title}</span>
                <span className="ml-auto shrink-0 text-ink-faint">{String(e.start || '').slice(0, 4)}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* detail strip: full craft explanation / beat editor */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 bg-panel">
        {!active ? (
          <div className="text-sm text-ink-faint">Nothing to show.</div>
        ) : editDraft && editDraft.id === active.id ? (
          <div className="max-w-3xl space-y-2.5">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5">
              <div className="md:col-span-3">
                <span className="label">Beat label</span>
                <input
                  className="input" value={editDraft.label}
                  onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                />
              </div>
              <div className="md:col-span-1">
                <span className="label">Chapter</span>
                <input
                  className="input" type="number" min="1" value={editDraft.chapter}
                  onChange={(e) => setEditDraft((d) => ({ ...d, chapter: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <span className="label">Chapter title</span>
                <input
                  className="input" value={editDraft.chapterTitle}
                  onChange={(e) => setEditDraft((d) => ({ ...d, chapterTitle: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <span className="label">Summary · one-liner</span>
              <input
                className="input" value={editDraft.summary}
                onChange={(e) => setEditDraft((d) => ({ ...d, summary: e.target.value }))}
              />
            </div>
            <div>
              <span className="label">Craft explanation · markdown</span>
              <textarea
                className="input !leading-relaxed resize-y"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                rows={9}
                value={editDraft.craft}
                onChange={(e) => setEditDraft((d) => ({ ...d, craft: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-accent" onClick={saveBeat} disabled={saving}>
                {saving ? 'Saving…' : 'Save beat'}
              </button>
              <button className="btn" onClick={() => setEditDraft(null)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className="text-accent font-semibold"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    {active.order}. {active.label}
                  </span>
                  <span className="text-xs text-ink-dim">
                    Chapter {active.chapter} — {active.chapterTitle}
                  </span>
                </div>
                {active.summary ? (
                  <p className="mt-0.5 text-sm italic text-ink-dim">{active.summary}</p>
                ) : null}
              </div>
              <button className="btn shrink-0" onClick={startEdit}>Edit beat</button>
            </div>
            {active.craft ? (
              <div
                className="prose-noir mt-2 max-w-3xl"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(active.craft) }}
              />
            ) : (
              <div className="mt-2 text-sm text-ink-faint italic">No craft notes yet — Edit beat to add some.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
