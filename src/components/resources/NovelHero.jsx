/*
 * 'Open the Novel' hero — the tab's front door to the manuscript, which
 * lives in OneDrive, outside the vault. The primary button hands the
 * document URL to desktop Word via the ms-word:ofe|u|<url> protocol
 * (Office must be installed and the protocol handler registered); the
 * secondary link opens the OneDrive web editor in a new tab. With no URLs
 * configured both stay disabled with an honest pointer to Settings —
 * nothing is faked. Category 'novel' entries list underneath.
 */
import ResourceList from './ResourceList.jsx'

export default function NovelHero({ config, items, onAdd, onUpdate, onDelete }) {
  const onedriveUrl = (config?.novel?.onedrive_url || '').trim()
  const webUrl = (config?.novel?.web_url || '').trim()

  const openDesktop = () => {
    if (!onedriveUrl) return
    // Hands off to the OS protocol handler; the page itself doesn't navigate.
    window.location.href = `ms-word:ofe|u|${onedriveUrl}`
  }

  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-4 border-b border-edge bg-gradient-to-r from-accent/10 via-transparent to-transparent">
        <h2
          className="text-lg font-semibold text-ink"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Open the Novel
        </h2>
        <p className="text-xs text-ink-dim mt-0.5">
          The manuscript lives in OneDrive, outside this vault.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            className="btn btn-accent"
            disabled={!onedriveUrl}
            onClick={openDesktop}
            title="Opens the document in desktop Word via the ms-word: protocol"
          >
            Open in Word (desktop)
          </button>
          {webUrl ? (
            <a
              className="btn"
              href={webUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Opens the OneDrive web editor in a new tab"
            >
              Open in OneDrive (web)
            </a>
          ) : (
            <button className="btn" disabled title="No web URL configured yet">
              Open in OneDrive (web)
            </button>
          )}
          {(!onedriveUrl || !webUrl) && (
            <span className="text-xs text-ink-faint italic">
              Set the manuscript URLs in Settings below
            </span>
          )}
        </div>
      </div>
      <div className="p-3">
        <div className="label">Manuscript &amp; related links</div>
        <ResourceList
          bare
          items={items}
          defaultCategory="novel"
          onAdd={onAdd}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </div>
    </section>
  )
}
