/*
 * Small inline form for one resource entry (title, url, note, category).
 * Used both for editing an existing row and adding a new one; the caller
 * persists via saveResources with the full next array (never writes files
 * directly — contract rule).
 */
export const RESOURCE_CATEGORIES = ['novel', 'case-file', 'writing']

const CATEGORY_LABELS = {
  novel: 'novel — manuscript & drafts',
  'case-file': 'case file — real-world inspiration',
  writing: 'writing — craft & reference',
}

export default function ResourceEditor({ draft, setDraft, onSave, onCancel, saving }) {
  const set = (patch) => setDraft((d) => (d ? { ...d, ...patch } : d))

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
    >
      <div className="text-[11px] uppercase tracking-wider text-ink-faint">
        {draft.isNew ? 'New link' : 'Editing link'}
      </div>

      <div>
        <label className="label">Title</label>
        <input
          className="input"
          value={draft.title}
          autoFocus
          onChange={(e) => set({ title: e.target.value })}
          placeholder="What the link is"
        />
      </div>

      <div>
        <label className="label">URL</label>
        <input
          className="input"
          value={draft.url}
          onChange={(e) => set({ url: e.target.value })}
          placeholder="https://…  (leave blank for a note-only entry)"
        />
      </div>

      <div>
        <label className="label">Note</label>
        <textarea
          className="input resize-y"
          rows={3}
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="Why it matters to the novel…"
        />
      </div>

      <div>
        <label className="label">Category</label>
        <select
          className="input"
          value={draft.category}
          onChange={(e) => set({ category: e.target.value })}
        >
          {RESOURCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn btn-accent" disabled={saving || !draft.title.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
