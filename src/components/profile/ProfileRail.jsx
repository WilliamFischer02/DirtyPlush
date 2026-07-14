/*
 * Left rail of the Profile tab — a compact roster. Names only, the active
 * character highlighted; the role rides along as a tooltip to keep the
 * rail quiet. "New character" writes a fresh note and jumps to it.
 */
export default function ProfileRail({ characters, activeFilename, onSelect, onCreate }) {
  return (
    <aside className="w-56 shrink-0 h-full flex flex-col border-r border-edge bg-panel">
      <div className="shrink-0 px-3 py-2 border-b border-edge flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-ink">Characters</h2>
        <span className="text-xs text-ink-faint">{characters.length}</span>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto p-1.5" aria-label="Character profiles">
        {characters.map((ch) => {
          const active = ch.filename === activeFilename
          return (
            <button
              key={ch.filename}
              onClick={() => onSelect(ch.filename)}
              aria-current={active ? 'true' : undefined}
              title={String(ch.frontmatter.role || ch.frontmatter.name || ch.filename)}
              className={
                'block w-full text-left px-2.5 py-1.5 rounded-md text-sm truncate transition-colors cursor-pointer ' +
                (active
                  ? 'bg-panel-3 text-accent'
                  : 'text-ink-dim hover:text-ink hover:bg-panel-2')
              }
            >
              {ch.frontmatter.name || ch.filename}
            </button>
          )
        })}
      </nav>
      <div className="shrink-0 p-2 border-t border-edge">
        <button className="btn btn-accent w-full text-xs" onClick={onCreate}>
          + New character
        </button>
      </div>
    </aside>
  )
}
