import { TABS, UIProvider, useUI } from './state/UIContext.jsx'
import { VaultProvider, useVault } from './state/VaultContext.jsx'
import VaultBar from './components/VaultBar.jsx'
import MapTab from './components/map/MapTab.jsx'
import TimelineTab from './components/timeline/TimelineTab.jsx'
import CharactersTab from './components/characters/CharactersTab.jsx'
import ProfileTab from './components/profile/ProfileTab.jsx'
import ResourcesTab from './components/resources/ResourcesTab.jsx'

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
  const { status } = useVault()

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b border-edge bg-panel px-4 py-2 flex items-center gap-6">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold tracking-wide text-accent" style={{ fontFamily: 'var(--font-serif)' }}>
            Dirty Plush
          </h1>
          <span className="text-xs text-ink-faint uppercase tracking-widest">Writer's Panel</span>
        </div>
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                'px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer ' +
                (activeTab === tab.id
                  ? 'bg-panel-3 text-accent'
                  : 'text-ink-dim hover:text-ink hover:bg-panel-2')
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto">
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
    <VaultProvider>
      <UIProvider>
        <Shell />
      </UIProvider>
    </VaultProvider>
  )
}
