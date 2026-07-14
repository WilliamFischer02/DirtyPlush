/*
 * One editable list of resource links. Rows are deliberately clean — no
 * favicons, just the title (opens in a new tab), the author's note beneath,
 * and quiet Edit/Delete actions. Editing swaps the row for a small inline
 * form; adding appends one at the bottom of the list.
 *
 * Items carry `_index` — their position in the FULL resources array — so
 * edits and deletes address the right entry even though each list only
 * shows one category. With `bare`, only the rows render (used inside the
 * novel hero card); otherwise the list gets its own card chrome.
 */
import { useState } from 'react'
import ResourceEditor, { RESOURCE_CATEGORIES } from './ResourceEditor.jsx'

function ResourceRow({ item, onEdit, onDelete }) {
  return (
    <div className="group rounded-md border border-edge bg-panel/60 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ink hover:text-accent transition-colors break-words"
              title={item.url}
            >
              {item.title || item.url}
              <span className="text-ink-faint ml-1" aria-hidden="true">↗</span>
            </a>
          ) : (
            <span className="text-sm text-ink break-words">
              {item.title}
              <span className="text-xs text-ink-faint italic ml-2">no link set</span>
            </span>
          )}
          {item.note && (
            <p className="text-xs text-ink-dim mt-1 leading-relaxed break-words">{item.note}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          <button className="btn text-xs px-2 py-0.5" onClick={onEdit} title="Edit this entry">
            Edit
          </button>
          <button
            className="btn btn-danger text-xs px-2 py-0.5"
            onClick={onDelete}
            title="Delete this entry"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ResourceList({
  title, intro, dotClass, items, defaultCategory,
  onAdd, onUpdate, onDelete, bare = false, addLabel = '+ Add link',
}) {
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  const startAdd = () =>
    setDraft({ isNew: true, title: '', url: '', note: '', category: defaultCategory })

  const startEdit = (item) =>
    setDraft({
      isNew: false,
      _index: item._index,
      title: item.title || '',
      url: item.url || '',
      note: item.note || '',
      category: RESOURCE_CATEGORIES.includes(item.category) ? item.category : defaultCategory,
    })

  const save = async () => {
    if (!draft || !draft.title.trim() || saving) return
    setSaving(true)
    try {
      const entry = {
        title: draft.title.trim(),
        url: draft.url.trim(),
        note: draft.note.trim(),
        category: draft.category,
      }
      if (draft.isNew) await onAdd(entry)
      else await onUpdate(draft._index, entry)
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title || 'this entry'}" from the list?`)) return
    await onDelete(item._index)
  }

  const rows = (
    <div className="space-y-2">
      {items.length === 0 && !draft?.isNew && (
        <p className="text-xs text-ink-faint italic">Nothing here yet.</p>
      )}
      {items.map((item) =>
        draft && !draft.isNew && draft._index === item._index ? (
          <div key={item._index} className="rounded-md border border-accent-dim bg-panel-3/50 p-3">
            <ResourceEditor
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={() => setDraft(null)}
              saving={saving}
            />
          </div>
        ) : (
          <ResourceRow
            key={item._index}
            item={item}
            onEdit={() => startEdit(item)}
            onDelete={() => remove(item)}
          />
        ),
      )}
      {draft?.isNew ? (
        <div className="rounded-md border border-accent-dim bg-panel-3/50 p-3">
          <ResourceEditor
            draft={draft}
            setDraft={setDraft}
            onSave={save}
            onCancel={() => setDraft(null)}
            saving={saving}
          />
        </div>
      ) : (
        <button className="btn text-xs" onClick={startAdd}>{addLabel}</button>
      )}
    </div>
  )

  if (bare) return rows

  return (
    <section className="card">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-edge">
        {dotClass && <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />}
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="text-xs text-ink-faint ml-auto">
          {items.length} link{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="p-3">
        {intro && <p className="text-xs text-ink-dim italic mb-3">{intro}</p>}
        {rows}
      </div>
    </section>
  )
}
