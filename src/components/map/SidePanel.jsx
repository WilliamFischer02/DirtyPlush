/*
 * Right-hand panel for the Setting Map — zoom-aware regional notes, the
 * pins currently in view (nearest first), and the selected pin's full
 * record or its editor. Presentation only; all data flows in as props.
 */
import { renderMarkdown } from '../../lib/markdown.js'
import { CATEGORIES, categoryColor, distanceKm, featureId, featureLatLng } from './mapUtils.js'
import LocationEditor from './LocationEditor.jsx'

function Dot({ category }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: categoryColor(category) }}
    />
  )
}

/* Every field row shows label + value, and estimates carry the badge. */
function FieldList({ fields, compact }) {
  if (!fields || fields.length === 0) return null
  return (
    <dl className={compact ? 'space-y-0.5' : 'space-y-1.5'}>
      {fields.map((f, i) => (
        <div key={i} className="flex items-baseline gap-2">
          <dt className="w-32 shrink-0 text-xs text-ink-faint leading-5">{f.label}</dt>
          <dd className="flex-1 text-sm text-ink">
            {f.value}
            {f.estimate && <span className="estimate-badge ml-1.5">estimate — verify</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function RegionCard({ feature, compact, onEdit }) {
  const p = feature.properties || {}
  if (compact) {
    return (
      <div className="text-xs text-ink-dim leading-5">
        <span className="text-sage">{p.name}</span>
        {p.summary ? <> — {p.summary}</> : null}
      </div>
    )
  }
  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink">{p.name}</div>
          {p.summary && <div className="text-xs text-ink-dim mt-0.5">{p.summary}</div>}
        </div>
        <button className="btn shrink-0" onClick={() => onEdit(feature)}>Edit</button>
      </div>
      <FieldList fields={p.fields} />
      {p.detail && (
        <details>
          <summary className="cursor-pointer text-xs text-accent/80 hover:text-accent select-none">
            Author notes
          </summary>
          <div className="prose-noir mt-1" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.detail) }} />
        </details>
      )}
    </div>
  )
}

/* Compact preview of the nearest in-view pin when no region band applies. */
function NearestPinCard({ feature, onSelect }) {
  const p = feature.properties || {}
  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Dot category={p.category} />
        <button
          className="text-sm font-semibold text-ink hover:text-accent text-left cursor-pointer"
          onClick={() => onSelect(feature)}
        >
          {p.name}
        </button>
      </div>
      {p.summary && <p className="text-xs text-ink-dim">{p.summary}</p>}
      <FieldList fields={p.fields} compact />
    </div>
  )
}

function PinRows({ pins, center, onSelect }) {
  return (
    <div className="space-y-0.5">
      {pins.map((f) => {
        const p = f.properties || {}
        return (
          <button
            key={featureId(f)}
            onClick={() => onSelect(f)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-panel-3 transition-colors cursor-pointer"
          >
            <Dot category={p.category} />
            <span className="flex-1 min-w-0 truncate text-sm text-ink">{p.name}</span>
            <span className="text-[11px] text-ink-faint shrink-0">
              {distanceKm(center, featureLatLng(f)).toFixed(1)} km
            </span>
          </button>
        )
      })}
    </div>
  )
}

function PinDetail({ feature, apiKey, onEdit, onDelete, onStreetView, onDeselect }) {
  const p = feature.properties || {}
  return (
    <div className="space-y-3">
      <button className="text-xs text-ink-faint hover:text-ink cursor-pointer" onClick={onDeselect}>
        ← All pins
      </button>
      <div className="flex items-center gap-2">
        <Dot category={p.category} />
        <span className="text-[11px] uppercase tracking-wider text-ink-faint">
          {p.category || 'uncategorized'}
        </span>
      </div>
      <h2 className="text-lg font-semibold text-ink leading-snug" style={{ fontFamily: 'var(--font-serif)' }}>
        {p.name}
      </h2>
      {p.summary && <p className="text-sm text-ink-dim">{p.summary}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-accent" onClick={() => onEdit(feature)}>Edit</button>
        <span title={apiKey ? 'Open present-day Street View at this pin' : 'Add a Google Maps API key in Resources → Settings to enable Street View'}>
          <button className="btn" disabled={!apiKey} onClick={() => onStreetView(feature)}>
            Street View
          </button>
        </span>
        <button className="btn btn-danger" onClick={() => onDelete(feature)}>Delete</button>
      </div>
      {!apiKey && (
        <p className="text-xs text-ink-faint">
          Street View needs a Google Maps API key — add one in Resources → Settings.
        </p>
      )}
      {p.detail && (
        <div className="prose-noir" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.detail) }} />
      )}
      {p.fields?.length > 0 && (
        <div>
          <div className="label">Field notes</div>
          <FieldList fields={p.fields} />
        </div>
      )}
    </div>
  )
}

export default function SidePanel({
  view, regions, pinsInView, pinCount, selectedPin, mode, draft, setDraft,
  apiKey, saving, onSelectPin, onAddPin, onEdit, onDelete, onSave, onCancel,
  onStreetView, onDeselect, onFitPins,
}) {
  const zoom = view ? Math.round(view.zoom) : null
  const editing = mode === 'edit' && draft

  return (
    <aside className="w-[380px] shrink-0 border-l border-edge bg-panel flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-2.5 border-b border-edge flex items-center gap-2">
        <span className="flex-1 text-[11px] uppercase tracking-wider text-ink-faint">
          Setting{zoom != null && ` · zoom ${zoom}`}
        </span>
        <button className="btn" title="Fit the view to every pin" onClick={onFitPins} disabled={pinCount === 0}>
          Fit pins
        </button>
        <button className="btn btn-accent" onClick={onAddPin} disabled={mode !== 'view'}>
          + Pin
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
        {editing ? (
          <LocationEditor draft={draft} setDraft={setDraft} onSave={onSave} onCancel={onCancel} saving={saving} />
        ) : selectedPin ? (
          <>
            {regions.length > 0 && (
              <section className="space-y-1">
                <div className="label">Region</div>
                {regions.map((f) => (
                  <RegionCard key={featureId(f)} feature={f} compact onEdit={onEdit} />
                ))}
              </section>
            )}
            <PinDetail
              feature={selectedPin}
              apiKey={apiKey}
              onEdit={onEdit}
              onDelete={onDelete}
              onStreetView={onStreetView}
              onDeselect={onDeselect}
            />
          </>
        ) : (
          <>
            <section className="space-y-2">
              <div className="label">Region at this view</div>
              {regions.length === 0 ? (
                <p className="text-xs text-ink-faint">
                  No regional notes for this zoom and position — zoom out for climate &amp; ecology,
                  in for local detail.
                </p>
              ) : (
                regions.map((f) => (
                  <RegionCard key={featureId(f)} feature={f} onEdit={onEdit} />
                ))
              )}
            </section>

            {regions.length === 0 && pinsInView.length > 0 && view && (
              <section className="space-y-2">
                <div className="label">Nearest pin</div>
                <NearestPinCard feature={pinsInView[0]} onSelect={onSelectPin} />
              </section>
            )}

            <section className="space-y-1">
              <div className="label">Pins in view ({pinsInView.length})</div>
              {pinsInView.length === 0 ? (
                <p className="text-xs text-ink-faint">
                  No pins in the current view — pan or zoom out, or add one with + Pin.
                </p>
              ) : (
                <PinRows pins={pinsInView} center={view.center} onSelect={onSelectPin} />
              )}
            </section>

            <p className="text-xs text-ink-faint">Click a pin on the map for its full record.</p>
          </>
        )}
      </div>

      <footer className="shrink-0 border-t border-edge px-4 py-2 flex flex-wrap gap-x-3 gap-y-1">
        {CATEGORIES.map((c) => (
          <span key={c} className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-faint">
            <span className="w-2 h-2 rounded-full" style={{ background: categoryColor(c) }} />
            {c}
          </span>
        ))}
      </footer>
    </aside>
  )
}
