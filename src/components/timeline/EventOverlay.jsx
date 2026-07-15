/*
 * Full-screen event detail overlay (spec §5-②).
 * Opened by clicking a timeline item or a beat chip; also hosts the draft
 * for a brand-new event. Everything is edited on a local draft and only
 * persisted when the user hits Save (the parent calls saveEvents with the
 * full next array). Detail is markdown with a live preview.
 */
import { useMemo, useRef, useState } from 'react'
import { renderMarkdown } from '../../lib/markdown.js'
import { useConfirm } from '../../state/UXContext.jsx'
import {
  EVENT_COLORS, GROUPS, PRIORITIES, blankEvent, clampWeight, safeColor,
} from './timelineUtils.js'

const DATE_STYLE = { colorScheme: 'dark' } // dark calendar glyphs on date inputs

export default function EventOverlay({ event, seed, beats, onSave, onDelete, onClose }) {
  const isNew = !event
  const confirmDialog = useConfirm()
  // Baseline captured once so "dirty" survives re-renders of the parent
  const initialRef = useRef(null)
  if (initialRef.current === null) initialRef.current = event ? { ...event } : blankEvent(seed)

  const [draft, setDraft] = useState(initialRef.current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (patch) => {
    setError('')
    setDraft((d) => ({ ...d, ...patch }))
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(initialRef.current)

  const sortedBeats = useMemo(
    () => [...beats].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [beats],
  )

  const groupOptions = useMemo(() => {
    const opts = GROUPS.map((g) => ({ id: g.id, label: g.content }))
    if (draft.group && !opts.some((o) => o.id === draft.group)) {
      opts.push({ id: draft.group, label: draft.group })
    }
    return opts
  }, [draft.group])

  const preview = useMemo(() => renderMarkdown(draft.detail || ''), [draft.detail])
  const color = safeColor(draft.color, draft.group)

  const requestClose = async () => {
    if (dirty) {
      const ok = await confirmDialog({
        title: 'Discard unsaved changes?',
        body: 'This event has edits that have not been saved.',
        confirmLabel: 'Discard',
        danger: true,
      })
      if (!ok) return
    }
    onClose()
  }

  const save = async () => {
    if (!draft.start) {
      setError('A start date is required.')
      return
    }
    if (draft.end && draft.end < draft.start) {
      setError('The end date must be on or after the start date.')
      return
    }
    const next = {
      ...draft,
      title: (draft.title || '').trim() || 'Untitled event',
      weight: clampWeight(draft.weight),
      color,
    }
    if (!next.end) delete next.end
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-night/85 backdrop-blur-sm">
      <div className="absolute inset-2 md:inset-6 card shadow-2xl flex flex-col overflow-hidden">
        {/* header */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-edge bg-panel">
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0 border border-night"
            style={{ background: color }}
            title={`Event color ${color}`}
          />
          <input
            className="input flex-1 !text-base font-semibold"
            style={{ fontFamily: 'var(--font-serif)' }}
            value={draft.title || ''}
            placeholder={isNew ? 'New event title…' : 'Event title'}
            autoFocus={isNew}
            onChange={(e) => set({ title: e.target.value })}
          />
          <span className="hidden md:block text-xs text-ink-faint shrink-0">
            {isNew ? 'new event' : `timeline/events.json · ${event.id}`}
          </span>
          <button className="btn shrink-0" onClick={requestClose}>Close</button>
        </div>

        {/* metadata */}
        <div className="shrink-0 px-4 py-3 border-b border-edge grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div>
            <span className="label">Start</span>
            <input
              type="date" className="input" style={DATE_STYLE}
              value={draft.start || ''}
              onChange={(e) => set({ start: e.target.value })}
            />
          </div>
          <div>
            <span className="label">End · optional</span>
            <div className="flex gap-1">
              <input
                type="date" className="input" style={DATE_STYLE}
                value={draft.end || ''}
                onChange={(e) => set({ end: e.target.value })}
              />
              {draft.end ? (
                <button
                  className="btn !px-2" title="Clear the end date (point event)"
                  onClick={() => set({ end: '' })}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <span className="label">Timeline</span>
            <select
              className="input" value={draft.group || GROUPS[0].id}
              onChange={(e) => set({ group: e.target.value })}
            >
              {groupOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Priority</span>
            <select
              className="input" value={draft.priority || 'medium'}
              onChange={(e) => set({ priority: e.target.value })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Beat</span>
            <select
              className="input" value={draft.beat || ''}
              onChange={(e) => set({ beat: e.target.value })}
            >
              <option value="">— unassigned —</option>
              {sortedBeats.map((b) => (
                <option key={b.id} value={b.id}>{b.order}. {b.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Weight · 1–5</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((w) => (
                <button
                  key={w}
                  className={
                    'w-7 h-8 rounded-md border text-xs cursor-pointer transition-colors ' +
                    (clampWeight(draft.weight) === w
                      ? 'border-accent text-accent bg-accent/10'
                      : 'border-edge text-ink-dim hover:bg-panel-3')
                  }
                  title={`Narrative weight ${w} of 5 — thicker edge on the timeline`}
                  onClick={() => set({ weight: w })}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-2 md:col-span-1 xl:col-span-2">
            <span className="label">Color</span>
            <div className="flex items-center gap-1.5 h-8">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  className={
                    'w-6 h-6 rounded-full border-2 cursor-pointer shrink-0 ' +
                    (color.toLowerCase() === c ? 'border-ink' : 'border-transparent hover:border-ink-faint')
                  }
                  style={{ background: c }}
                  title={c}
                  onClick={() => set({ color: c })}
                />
              ))}
              <label
                className="relative w-6 h-6 rounded-full border border-dashed border-ink-faint cursor-pointer shrink-0 overflow-hidden"
                title="Custom color…"
                style={EVENT_COLORS.includes(color.toLowerCase()) ? undefined : { background: color, borderStyle: 'solid' }}
              >
                <input
                  type="color" value={color}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => set({ color: e.target.value })}
                />
              </label>
            </div>
          </div>
          <div className="col-span-2 md:col-span-2 xl:col-span-4">
            <span className="label">Summary · shown on hover</span>
            <input
              className="input"
              value={draft.summary || ''}
              placeholder="One line the tooltip shows…"
              onChange={(e) => set({ summary: e.target.value })}
            />
          </div>
        </div>

        {/* detail: markdown editor + live preview */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2">
          <div className="flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-edge">
            <span className="label px-4 pt-3 shrink-0">Detail — markdown</span>
            <textarea
              className="flex-1 min-h-0 w-full resize-none bg-transparent px-4 pb-4 text-[13px] leading-relaxed text-ink placeholder-ink-faint focus:outline-none"
              style={{ fontFamily: 'var(--font-mono)' }}
              value={draft.detail || ''}
              placeholder={'Scene notes, craft notes, open threads…\n\nMarkdown renders live on the right.'}
              onChange={(e) => set({ detail: e.target.value })}
            />
          </div>
          <div className="min-h-0 overflow-y-auto px-4 py-3">
            <span className="label">Preview</span>
            {draft.detail ? (
              <div className="prose-noir" dangerouslySetInnerHTML={{ __html: preview }} />
            ) : (
              <div className="text-sm text-ink-faint italic">Nothing to preview yet.</div>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-edge bg-panel">
          {!isNew && (
            <>
              <button className="btn btn-danger" onClick={() => onDelete(event.id)}>
                Delete event
              </button>
              <button
                className="btn"
                title="Save a copy of this event (including any unsaved edits here) as a new event"
                onClick={() => onSave({
                  ...draft,
                  id: '',
                  title: `${(draft.title || 'Untitled event').trim()} (copy)`,
                  weight: clampWeight(draft.weight),
                  color,
                })}
              >
                Duplicate
              </button>
            </>
          )}
          {error && <span className="text-sm text-rust">{error}</span>}
          {dirty && !error && <span className="text-xs text-ink-faint">unsaved changes</span>}
          <div className="ml-auto flex gap-2">
            <button className="btn" onClick={requestClose}>Cancel</button>
            <button className="btn btn-accent" onClick={save} disabled={saving || (!isNew && !dirty)}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
