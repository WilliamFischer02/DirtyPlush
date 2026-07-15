import { useEffect, useRef } from 'react'
import { TABS, UIProvider, useUI } from './state/UIContext.jsx'
import { VaultProvider, useVault } from './state/VaultContext.jsx'
import { UXProvider } from './state/UXContext.jsx'
import { applyAppearance, getAppearance } from './lib/appearance.js'
import VaultBar from './components/VaultBar.jsx'
import MapTab from './components/map/MapTab.jsx'
import TimelineTab from './components/timeline/TimelineTab.jsx'
import CharactersTab from './components/characters/CharactersTab.jsx'
import ProfileTab from './components/profile/ProfileTab.jsx'
import ResourcesTab from './components/resources/ResourcesTab.jsx'

// Small inline icons keep the nav scannable without an icon dependency.
const TAB_ICONS = {
  map: 'M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10zm0-7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  timeline: 'M12 8v4l3 2.4M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
  characters: 'M16 14a4 4 0 1 0-8 0M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 20a6 6 0 0 1 16 0',
  profile: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm3 5h4m-4 4h8m-8 4h8',
  resources: 'M4 19V6a2 2 0 0 1 2-2h13v13H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13M9 8h6',
}

function TabIcon({ id }) {
  return (
    <svg
      viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className="shrink-0"
    >
      <path d={TAB_ICONS[id]} />
    </svg>
  )
}

function ErrorBanner() {
  const { errors, dismissErrors } = useVault()
  if (!errors.length) return null
  return (
    <div className="bg-rust/15 border-b border-rust/40 text-rust px-4 py-2 text-sm flex items-start gap-3">
      <div className="flex-1">
        {errors.map((e, i) => (
          <div key={i}>{e}</div>
        ))}
      </div>
      <button className="btn btn-danger shrink-0" onClick={dismissErrors}>Dismiss</button>
    </div>
  )
}

function Shell() {
  const { activeTab, setActiveTab } = useUI()
  const { status, config } = useVault()

  // Appearance (accent, font scale) follows the vault config live.
  useEffect(() => {
    applyAppearance(getAppearance(config))
  }, [config])

  // Honor the configured default tab once, when the vault finishes loading.
  const appliedDefaultRef = useRef(false)
  useEffect(() => {
    if (status.mode === 'loading' || appliedDefaultRef.current) return
    appliedDefaultRef.current = true
    const wanted = getAppearance(config).default_tab
    if (TABS.some((t) => t.id === wanted)) setActiveTab(wanted)
  }, [status.mode, config, setActiveTab])

  // Keys 1–5 switch tabs when focus isn't in a text field.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target
      if (el instanceof Element) {
        const tag = el.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.closest('[contenteditable="true"]')) return
      }
      const idx = Number(e.key) - 1
      if (idx >= 0 && idx < TABS.length) setActiveTab(TABS[idx].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActiveTab])

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b border-edge bg-panel px-4 flex items-center gap-6">
        <div className="flex items-baseline gap-2 py-2">
          <h1 className="text-lg font-semibold tracking-wide text-accent" style={{ fontFamily: 'var(--font-serif)' }}>
            Dirty Plush
          </h1>
          <span className="hidden lg:inline text-xs text-ink-faint uppercase tracking-widest">Writer's Panel</span>
        </div>
        <nav className="flex gap-1 self-stretch" aria-label="Tabs">
          {TABS.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={`${tab.label} — press ${i + 1}`}
              className={
                'relative flex items-center gap-1.5 px-3 text-sm transition-colors cursor-pointer ' +
                'border-b-2 -mb-px ' +
                (activeTab === tab.id
                  ? 'text-accent border-accent'
                  : 'text-ink-dim border-transparent hover:text-ink hover:border-edge')
              }
            >
              <TabIcon id={tab.id} />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto py-2">
          <VaultBar />
        </div>
      </header>

      <ErrorBanner />

      <main className="flex-1 min-h-0 overflow-hidden">
        {status.mode === 'loading' ? (
          <div className="h-full flex items-center justify-center text-ink-dim">Opening the vault…</div>
        ) : (
          <>
            {/* Tabs stay mounted only when active; each tab loads its own data from useVault(). */}
            {activeTab === 'map' && <MapTab />}
            {activeTab === 'timeline' && <TimelineTab />}
            {activeTab === 'characters' && <CharactersTab />}
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'resources' && <ResourcesTab />}
          </>
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <UXProvider>
      <VaultProvider>
        <UIProvider>
          <Shell />
        </UIProvider>
      </VaultProvider>
    </UXProvider>
  )
}
