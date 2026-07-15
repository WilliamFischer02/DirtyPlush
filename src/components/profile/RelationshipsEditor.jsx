/*
 * Relationship rows for the Profile tab. Each row edits one
 * "Target :: label (hidden)" frontmatter string, held in the draft as
 * { target, label, hidden } (parsed/serialized through lib/markdown.js on
 * load/save). Targets that match another character's name get a ↗ link
 * straight to that profile; the datalist offers existing names while typing.
 */
import { useId } from 'react'

export default function RelationshipsEditor({ rows, onChange, characters, selfFilename, onOpenCharacter }) {
  const listId = useId()
  const others = characters.filter((c) => c.filename !== selfFilename && c.frontmatter.name)

  const matchFor = (target) => {
    const t = String(target || '').trim().toLowerCase()
    if (!t) return null
    return others.find((c) => String(c.frontmatter.name).toLowerCase() === t) || null
  }

  const setRow = (idx, patch) => onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  return (
    <div className="flex flex-col gap-1.5">
      {rows.length === 0 && (
        <div className="text-sm text-ink-dim">No relationships yet.</div>
      )}
      {rows.map((row, idx) => {
        const match = matchFor(row.target)
        return (
          <div
            key={idx}
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)_auto_auto] items-center gap-2"
          >
            <input
              className="input"
              list={listId}
              value={row.target}
              onChange={(e) => setRow(idx, { target: e.target.value })}
              placeholder="Who (character name)"
              aria-label={`Relationship ${idx + 1} — target`}
            />
            {match ? (
              <button
                className="text-teal hover:text-accent transition-colors cursor-pointer text-sm px-0.5"
                onClick={() => onOpenCharacter(match.filename)}
                title={`Open ${match.frontmatter.name}'s profile`}
                aria-label={`Open ${match.frontmatter.name}'s profile`}
              >
                ↗
              </button>
            ) : (
              <span
                className="text-ink-faint text-sm px-0.5"
                title="No character note with this exact name"
                aria-hidden="true"
              >
                ·
              </span>
            )}
            <input
              className="input"
              value={row.label}
              onChange={(e) => setRow(idx, { label: e.target.value })}
              placeholder="How (e.g. partner)"
              aria-label={`Relationship ${idx + 1} — label`}
            />
            <label
              className="flex items-center gap-1.5 text-xs text-ink-dim cursor-pointer select-none"
              title="An in-story secret — drawn dashed and dimmed in the relationship graph"
            >
              <input
                type="checkbox"
                style={{ accentColor: 'var(--color-accent)' }}
                checked={!!row.hidden}
                onChange={(e) => setRow(idx, { hidden: e.target.checked })}
              />
              hidden
            </label>
            <button
              className="btn btn-danger text-xs px-2 py-0.5"
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
              title="Remove this relationship row"
              aria-label={`Remove relationship ${idx + 1}`}
            >
              ✕
            </button>
          </div>
        )
      })}
      <datalist id={listId}>
        {others.map((c) => (
          <option key={c.filename} value={c.frontmatter.name} />
        ))}
      </datalist>
      <div>
        <button
          className="btn text-xs mt-1"
          onClick={() => onChange([...rows, { target: '', label: '', hidden: false }])}
        >
          + Add relationship
        </button>
      </div>
    </div>
  )
}
