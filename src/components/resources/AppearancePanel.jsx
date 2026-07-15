/*
 * Appearance — the author's look-and-feel choices, persisted in
 * writers-panel-config.json under options.appearance and applied live
 * (App.jsx re-applies on every config change). Everything here has a safe
 * default; deleting the block from the config file simply restores the
 * shipped noir look.
 */
import { ACCENT_PRESETS, DEFAULTS, FONT_SCALES, MAP_LAYERS, getAppearance } from '../../lib/appearance.js'
import { TABS } from '../../state/UIContext.jsx'

export default function AppearancePanel({ config, saveConfig }) {
  const current = getAppearance(config)

  const update = async (patch) => {
    await saveConfig({
      ...config,
      options: {
        ...(config?.options || {}),
        appearance: { ...current, ...patch },
      },
    })
  }

  return (
    <section className="card">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-edge">
        <h2 className="text-sm font-semibold text-ink">Appearance</h2>
        <span className="text-xs text-ink-faint">applies immediately · saved to the vault config</span>
      </div>
      <div className="p-3 space-y-4">
        <div>
          <span className="label">Accent color</span>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.id}
                className={
                  'w-7 h-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ' +
                  (current.accent.toLowerCase() === p.value.toLowerCase()
                    ? 'border-ink scale-110'
                    : 'border-edge')
                }
                style={{ background: p.value }}
                title={p.label}
                onClick={() => update({ accent: p.value })}
              />
            ))}
            <label className="flex items-center gap-1.5 text-xs text-ink-dim ml-1 cursor-pointer">
              custom
              <input
                type="color"
                value={current.accent}
                onChange={(e) => update({ accent: e.target.value })}
                className="w-7 h-7 bg-transparent border border-edge rounded cursor-pointer"
                title="Pick any accent color"
              />
            </label>
            {current.accent !== DEFAULTS.accent && (
              <button className="btn text-xs" onClick={() => update({ accent: DEFAULTS.accent })}>
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <span className="label">Text size</span>
            <div className="flex gap-1">
              {FONT_SCALES.map((f) => (
                <button
                  key={f.id}
                  className={'btn flex-1 ' + (current.font_scale === f.value ? 'btn-accent' : '')}
                  onClick={() => update({ font_scale: f.value })}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Tab on open</span>
            <select
              className="input"
              value={current.default_tab}
              onChange={(e) => update({ default_tab: e.target.value })}
            >
              {TABS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Default map layer</span>
            <select
              className="input"
              value={current.map_layer}
              onChange={(e) => update({ map_layer: e.target.value })}
            >
              {MAP_LAYERS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-ink-faint">
          Tip: on the map, the ◎ button saves your current view as home and ⌂ returns to it.
          Keys 1–5 switch tabs anywhere outside a text field.
        </p>
      </div>
    </section>
  )
}
