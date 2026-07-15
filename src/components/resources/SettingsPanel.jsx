/*
 * Settings — the small amount of machine config the panel needs, stored in
 * writers-panel-config.json in the vault (plain JSON, visible in Obsidian).
 * The manuscript URLs feed the hero card above; the Maps key gates Street
 * View on the map tab. Drafts sync from config unless the form is dirty,
 * so a vault reload never clobbers unsaved edits.
 */
import { useEffect, useRef, useState } from 'react'

const fromConfig = (config) => ({
  onedriveUrl: config?.novel?.onedrive_url || '',
  webUrl: config?.novel?.web_url || '',
  mapsKey: config?.google_maps_api_key || '',
})

export default function SettingsPanel({ config, saveConfig }) {
  const [draft, setDraft] = useState(() => fromConfig(config))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const flashTimer = useRef(null)

  useEffect(() => {
    if (!dirty) setDraft(fromConfig(config))
  }, [config, dirty])

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }))
    setDirty(true)
    setSavedFlash(false)
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await saveConfig({
        ...config,
        novel: {
          ...(config?.novel || {}),
          onedrive_url: draft.onedriveUrl.trim(),
          web_url: draft.webUrl.trim(),
        },
        google_maps_api_key: draft.mapsKey.trim(),
      })
      setDirty(false)
      setSavedFlash(true)
      clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setSavedFlash(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-edge">
        <h2 className="text-sm font-semibold text-ink">Settings</h2>
        <span className="text-xs text-ink-faint">writers-panel-config.json</span>
      </div>
      <form
        className="p-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div>
          <label className="label" htmlFor="cfg-onedrive">
            Manuscript — OneDrive document URL (desktop Word launcher)
          </label>
          <input
            id="cfg-onedrive"
            className="input"
            value={draft.onedriveUrl}
            onChange={(e) => set({ onedriveUrl: e.target.value })}
            placeholder="https://…  (launched as ms-word:ofe|u|<url>)"
          />
        </div>

        <div>
          <label className="label" htmlFor="cfg-web">
            Manuscript — OneDrive web URL (browser fallback)
          </label>
          <input
            id="cfg-web"
            className="input"
            value={draft.webUrl}
            onChange={(e) => set({ webUrl: e.target.value })}
            placeholder="https://onedrive.live.com/…"
          />
        </div>

        <div>
          <label className="label" htmlFor="cfg-maps-key">
            Google Maps API key (Street View)
          </label>
          <div className="flex gap-2">
            <input
              id="cfg-maps-key"
              className="input"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              value={draft.mapsKey}
              onChange={(e) => set({ mapsKey: e.target.value })}
              placeholder="optional — Street View stays off without it"
            />
            <button
              type="button"
              className="btn shrink-0"
              onClick={() => setShowKey((s) => !s)}
              title={showKey ? 'Hide the key' : 'Show the key'}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-ink-faint mt-1">
            Stored in plain text in writers-panel-config.json in YOUR vault. It is never sent
            anywhere except Google&apos;s own script tag, and only when Street View is used.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button type="submit" className="btn btn-accent" disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {savedFlash && <span className="text-xs text-sage">Saved to the vault</span>}
        </div>

        <p className="text-xs text-ink-faint border-t border-edge pt-2.5">
          Planned upgrade: live folder listing via Microsoft Graph, so this tab can browse the
          manuscript&apos;s OneDrive folder directly. Until then, the lists above are the
          resources/resources.json manifest — edit them here or in Obsidian.
        </p>
      </form>
    </section>
  )
}
