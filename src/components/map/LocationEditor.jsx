/*
 * Edit form for one location feature (pin or region). Every field row is
 * fully editable — label, value, and the estimate flag that drives the
 * "estimate — verify" badge (contract hard rule #1: researched values are
 * never presented as fact). New field rows default to estimate: true so
 * nothing slips through unflagged; the author unticks confirmed facts.
 */
import { CATEGORIES } from './mapUtils.js'

export default function LocationEditor({ draft, setDraft, onSave, onCancel, saving }) {
  const set = (patch) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const setField = (i, patch) =>
    setDraft((d) => (d ? { ...d, fields: d.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) } : d))
  const addField = () =>
    setDraft((d) => (d ? { ...d, fields: [...d.fields, { label: '', value: '', estimate: true }] } : d))
  const removeField = (i) =>
    setDraft((d) => (d ? { ...d, fields: d.fields.filter((_, j) => j !== i) } : d))

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
    >
      <div className="text-[11px] uppercase tracking-wider text-ink-faint">
        {draft.isNew ? 'New pin' : `Editing ${draft.role}`}
      </div>

      <div>
        <label className="label">Name</label>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Location name"
          autoFocus
        />
      </div>

      <div>
        <label className="label">Category</label>
        <select className="input" value={draft.category} onChange={(e) => set({ category: e.target.value })}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Summary</label>
        <input
          className="input"
          value={draft.summary}
          onChange={(e) => set({ summary: e.target.value })}
          placeholder="One-liner shown under the name"
        />
      </div>

      <div>
        <label className="label">Detail (markdown)</label>
        <textarea
          className="input resize-y"
          rows={7}
          value={draft.detail}
          onChange={(e) => set({ detail: e.target.value })}
          placeholder="Author notes on the place…"
        />
      </div>

      {draft.role === 'pin' && (
        <p className="text-xs text-ink-faint">
          Position: {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)} — drag the highlighted pin on the map to move it.
        </p>
      )}

      {draft.role === 'region' && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Min zoom</label>
            <input className="input" type="number" value={draft.minZoom} onChange={(e) => set({ minZoom: e.target.value })} />
          </div>
          <div>
            <label className="label">Max zoom</label>
            <input className="input" type="number" value={draft.maxZoom} onChange={(e) => set({ maxZoom: e.target.value })} />
          </div>
          <div>
            <label className="label">Radius km</label>
            <input className="input" type="number" value={draft.radiusKm} onChange={(e) => set({ radiusKm: e.target.value })} />
          </div>
        </div>
      )}

      <div>
        <div className="label">Fields</div>
        <div className="space-y-2">
          {draft.fields.length === 0 && (
            <p className="text-xs text-ink-faint">No fields yet — period detail, ops notes, flora, prices…</p>
          )}
          {draft.fields.map((f, i) => (
            <div key={i} className="card p-2 space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  className="input"
                  value={f.label}
                  placeholder="Label"
                  onChange={(e) => setField(i, { label: e.target.value })}
                />
                <button type="button" className="btn btn-danger shrink-0" title="Remove this field" onClick={() => removeField(i)}>
                  ✕
                </button>
              </div>
              <input
                className="input"
                value={f.value}
                placeholder="Value"
                onChange={(e) => setField(i, { value: e.target.value })}
              />
              <label className="flex items-center gap-1.5 text-xs text-ink-dim cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={f.estimate}
                  onChange={(e) => setField(i, { estimate: e.target.checked })}
                />
                {f.estimate
                  ? <span className="estimate-badge">estimate — verify</span>
                  : <span>mark as estimate</span>}
              </label>
            </div>
          ))}
        </div>
        <button type="button" className="btn mt-2" onClick={addField}>+ Add field</button>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn btn-accent" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
