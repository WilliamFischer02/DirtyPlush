/*
 * The roster — right column of tab ③, visually synced with the graph
 * (same node color as a small glowing dot). Click a row to open the
 * Profile tab; "New character" creates a note and jumps straight there.
 */
import { nodeColor } from './characterUtils.js'

function roleOneLiner(role) {
  return String(role || '').split(';')[0].trim() || '—'
}

export default function CharacterList({ characters, onOpen, onCreate }) {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-edge">
        <h2 className="text-sm font-semibold text-ink">Characters</h2>
        <span className="text-xs text-ink-faint">{characters.length}</span>
        <button className="btn btn-accent ml-auto text-xs px-2 py-1" onClick={onCreate}>
          + New character
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-1.5">
        {characters.length === 0 && (
          <div className="p-3 text-sm text-ink-dim">
            No character notes yet. "New character" writes a fresh note into the vault's
            characters/ folder.
          </div>
        )}
        {characters.map((ch) => {
          const color = nodeColor(ch)
          const name = ch.frontmatter.name || ch.filename
          return (
            <button
              key={ch.filename}
              onClick={() => onOpen(ch.filename)}
              className="w-full flex items-start gap-2.5 text-left px-2.5 py-2 rounded-md
                hover:bg-panel-3 transition-colors cursor-pointer group"
              title={String(ch.frontmatter.role || name)}
            >
              <span
                className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-sm text-ink group-hover:text-accent transition-colors truncate">
                  {name}
                </span>
                <span className="block text-xs text-ink-dim truncate">
                  {roleOneLiner(ch.frontmatter.role)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
