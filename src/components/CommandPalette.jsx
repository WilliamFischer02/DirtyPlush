/*
 * Command palette — Ctrl/Cmd+K anywhere.
 * One search box over everything in the vault: characters (→ Profile),
 * events (→ Timeline, overlay open), map locations (→ Map, pin selected),
 * beats (→ Timeline), resources (→ new tab), plus plain tab navigation.
 * Substring matching on words, ranked: prefix > word-start > anywhere.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVault } from '../state/VaultContext.jsx'
import { TABS, useUI } from '../state/UIContext.jsx'

const KIND_META = {
  character: { label: 'Character', color: 'var(--color-accent)' },
  event: { label: 'Event', color: 'var(--color-rust)' },
  location: { label: 'Place', color: 'var(--color-sage)' },
  beat: { label: 'Beat', color: 'var(--color-teal)' },
  resource: { label: 'Link', color: 'var(--color-ink-dim)' },
  tab: { label: 'Go to', color: 'var(--color-ink-dim)' },
}

function score(haystack, query) {
  const h = haystack.toLowerCase()
  const q = query.toLowerCase()
  const idx = h.indexOf(q)
  if (idx === -1) return -1
  if (idx === 0) return 0
  if (/\s/.test(h[idx - 1])) return 1
  return 2
}

export default function CommandPalette() {
  const { characters, events, beats, locations, resources } = useVault()
  const { setActiveTab, openProfile, openEvent, openLocation } = useUI()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Ctrl/Cmd+K toggles from anywhere (including inside text fields)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        setQuery('')
        setCursor(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const entries = useMemo(() => {
    if (!open) return []
    const out = []
    for (const c of characters) {
      out.push({
        kind: 'character',
        title: c.frontmatter.name || c.filename,
        sub: c.frontmatter.role || '',
        run: () => openProfile(c.filename),
      })
    }
    for (const e of events) {
      out.push({
        kind: 'event',
        title: e.title || e.id,
        sub: `${e.start || ''}${e.summary ? ` · ${e.summary}` : ''}`,
        run: () => openEvent(e.id),
      })
    }
    for (const f of locations?.features || []) {
      const p = f.properties || {}
      if (p.role !== 'pin') continue
      out.push({
        kind: 'location',
        title: p.name || p.id,
        sub: p.summary || '',
        run: () => openLocation(p.id),
      })
    }
    for (const b of beats) {
      out.push({
        kind: 'beat',
        title: `${b.order}. ${b.label}`,
        sub: b.chapterTitle ? `ch. ${b.chapter} · ${b.chapterTitle}` : '',
        run: () => setActiveTab('timeline'),
      })
    }
    for (const r of resources) {
      if (!r.url) continue
      out.push({
        kind: 'resource',
        title: r.title || r.url,
        sub: r.note || '',
        run: () => window.open(r.url, '_blank', 'noopener'),
      })
    }
    for (const t of TABS) {
      out.push({ kind: 'tab', title: t.label, sub: '', run: () => setActiveTab(t.id) })
    }
    return out
  }, [open, characters, events, beats, locations, resources,
    openProfile, openEvent, openLocation, setActiveTab])

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) {
      // Empty query: tabs first, then characters — the two most common jumps
      return [...entries.filter((e) => e.kind === 'tab'),
        ...entries.filter((e) => e.kind === 'character')].slice(0, 12)
    }
    return entries
      .map((e) => {
        const s1 = score(e.title, q)
        const s2 = e.sub ? score(e.sub, q) : -1
        const s = s1 === -1 ? (s2 === -1 ? -1 : s2 + 3) : s1
        return { ...e, _score: s }
      })
      .filter((e) => e._score >= 0)
      .sort((a, b) => a._score - b._score)
      .slice(0, 12)
  }, [entries, query])

  useEffect(() => setCursor(0), [query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const runEntry = useCallback((entry) => {
    close()
    entry.run()
  }, [close])

  const onInputKey = (e) => {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter' && results[cursor]) {
      e.preventDefault()
      runEntry(results[cursor])
    }
  }

  // Keep the highlighted row in view
  useEffect(() => {
    listRef.current?.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-night/60 backdrop-blur-[2px] flex items-start justify-center pt-[12vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div className="dp-dialog card w-[min(600px,92vw)] shadow-2xl overflow-hidden">
        <input
          ref={inputRef}
          className="w-full bg-transparent px-4 py-3 text-base text-ink placeholder-ink-faint outline-none border-b border-edge"
          placeholder="Jump to a character, event, place, beat, or link…"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKey}
        />
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-ink-faint">No matches in the vault.</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.kind}:${r.title}:${i}`}
                className={
                  'w-full flex items-baseline gap-2.5 text-left px-4 py-2 cursor-pointer ' +
                  (i === cursor ? 'bg-panel-3' : 'hover:bg-panel-3/60')
                }
                onMouseEnter={() => setCursor(i)}
                onClick={() => runEntry(r)}
              >
                <span
                  className="shrink-0 text-[10px] uppercase tracking-wider w-16"
                  style={{ color: KIND_META[r.kind].color }}
                >
                  {KIND_META[r.kind].label}
                </span>
                <span className="text-sm text-ink truncate">{r.title}</span>
                {r.sub && <span className="text-xs text-ink-faint truncate">{r.sub}</span>}
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-1.5 border-t border-edge text-[11px] text-ink-faint flex gap-3">
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  )
}
