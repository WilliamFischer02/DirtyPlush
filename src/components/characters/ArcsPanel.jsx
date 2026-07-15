/*
 * Character Arcs — the arcs.csv rows as editable Beginning → End pairs.
 * Edits are typed into local state and committed on blur through
 * useVault().saveArcs, which persists the CSV AND syncs each character's
 * frontmatter (contract — never touch frontmatter manually from here).
 */
import { useEffect, useRef, useState } from 'react'

function AutoTextarea({ value, onChange, onBlur, placeholder, ariaLabel }) {
  const ref = useRef(null)
  // autosize-ish: grow to fit content whenever the value changes
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      className="input resize-none leading-snug overflow-hidden"
      rows={2}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={onChange}
      onBlur={onBlur}
    />
  )
}

export default function ArcsPanel({ arcs, saveArcs, characters, onOpen }) {
  const [rows, setRows] = useState(arcs)
  // Re-sync when the vault changes underneath us (reload, frontmatter sync)
  useEffect(() => { setRows(arcs) }, [arcs])

  const commit = async () => {
    if (JSON.stringify(rows) === JSON.stringify(arcs)) return
    await saveArcs(rows)
  }

  const setField = (idx, field, value) => {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  const removeRow = async (idx) => {
    const next = rows.filter((_, i) => i !== idx)
    setRows(next)
    await saveArcs(next)
  }

  const addCharacter = async (name) => {
    if (!name) return
    const ch = characters.find((c) => (c.frontmatter.name || '') === name)
    const next = [...rows, {
      character: name,
      arc_begin: ch?.frontmatter?.arc_begin || '',
      arc_end: ch?.frontmatter?.arc_end || '',
    }]
    setRows(next)
    await saveArcs(next)
  }

  const available = characters.filter(
    (c) => c.frontmatter.name &&
      !rows.some((r) => String(r.character).toLowerCase() === c.frontmatter.name.toLowerCase()),
  )

  return (
    <section className="card flex flex-col min-w-0">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-edge">
        <h2 className="text-sm font-semibold text-ink">Character arcs</h2>
        <span className="text-xs text-ink-faint hidden sm:inline">arcs.csv · synced to frontmatter</span>
        <select
          className="input ml-auto"
          style={{ width: 'auto' }} /* .input's width:100% would win over w-auto */
          value=""
          onChange={(e) => addCharacter(e.target.value)}
          disabled={available.length === 0}
          aria-label="Add a character to the arcs table"
        >
          <option value="">{available.length ? 'Add character…' : 'All characters added'}</option>
          {available.map((c) => (
            <option key={c.filename} value={c.frontmatter.name}>{c.frontmatter.name}</option>
          ))}
        </select>
      </div>
      <div className="p-3 flex flex-col gap-2.5">
        {rows.length === 0 && (
          <div className="text-sm text-ink-dim">No arc rows yet — add a character above.</div>
        )}
        {rows.map((row, idx) => (
          <div key={row.character} className="rounded-md border border-edge bg-panel/60 p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <button
                className="text-sm text-ink hover:text-accent transition-colors cursor-pointer truncate"
                onClick={() => onOpen(row.character)}
                title="Open profile"
              >
                {row.character}
              </button>
              <button
                className="btn btn-danger ml-auto text-xs px-2 py-0.5 shrink-0"
                onClick={() => removeRow(idx)}
                title="Remove this arc row (the character note keeps its own frontmatter)"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div>
                <span className="label">Beginning</span>
                <AutoTextarea
                  value={row.arc_begin}
                  onChange={(e) => setField(idx, 'arc_begin', e.target.value)}
                  onBlur={commit}
                  placeholder="who they are when we meet them"
                  ariaLabel={`${row.character} — arc beginning`}
                />
              </div>
              <span className="text-accent text-lg pt-4" aria-hidden="true">→</span>
              <div>
                <span className="label">End</span>
                <AutoTextarea
                  value={row.arc_end}
                  onChange={(e) => setField(idx, 'arc_end', e.target.value)}
                  onBlur={commit}
                  placeholder="who the story leaves them as"
                  ariaLabel={`${row.character} — arc end`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
