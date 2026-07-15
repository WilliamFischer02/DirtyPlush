/*
 * VaultBar — vault connection status + actions (top-right of the shell).
 * The status pill and the two verbs an author reaches for constantly
 * (Connect / Reload) stay visible; Export / Import / Disconnect live in a
 * compact ⋯ menu to keep the header calm.
 */
import { useEffect, useRef, useState } from 'react'
import { useVault } from '../state/VaultContext.jsx'
import { useToast } from '../state/UXContext.jsx'

export default function VaultBar() {
  const {
    status, connectVault, reconnectVault, disconnectVault,
    reloadVault, exportVault, importVault,
  } = useVault()
  const toast = useToast()
  const fileRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const onImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const count = await importVault(file)
        toast(`Imported ${count} file(s) into the vault`, 'success')
      } catch (err) {
        toast(`Import failed: ${err.message}`, 'error', { sticky: true })
      }
    }
    e.target.value = ''
  }

  const menuItem =
    'w-full text-left px-3 py-1.5 text-sm text-ink-dim hover:text-ink hover:bg-panel-3 cursor-pointer'

  return (
    <div className="flex items-center gap-2 text-sm">
      {status.mode === 'fsa' ? (
        <span className="flex items-center gap-1.5 text-sage" title="Reading & writing your vault folder directly">
          <span className="w-2 h-2 rounded-full bg-sage inline-block" />
          Vault: <strong className="text-ink">{status.vaultName}</strong>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-ink-dim" title="Working from browser storage — connect your vault folder to write real files">
          <span className="w-2 h-2 rounded-full bg-accent inline-block" />
          Browser storage
        </span>
      )}

      {status.needsReconnect && (
        <button className="btn btn-accent" onClick={reconnectVault}>
          Reconnect vault
        </button>
      )}

      {status.mode !== 'fsa' && status.fsaSupported && !status.needsReconnect && (
        <button className="btn btn-accent" onClick={connectVault}>
          Connect vault folder
        </button>
      )}

      <button className="btn" onClick={reloadVault} title="Re-read all files (pick up edits made in Obsidian)">
        Reload
      </button>

      <div className="relative" ref={menuRef}>
        <button
          className="btn px-2"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="More vault actions"
          onClick={() => setMenuOpen((o) => !o)}
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-50 w-56 card shadow-2xl py-1 overflow-hidden"
          >
            <button role="menuitem" className={menuItem} onClick={() => { setMenuOpen(false); exportVault() }}>
              Export vault as .zip
            </button>
            <button role="menuitem" className={menuItem} onClick={() => { setMenuOpen(false); fileRef.current?.click() }}>
              Import a vault .zip…
            </button>
            {status.mode === 'fsa' && (
              <>
                <div className="my-1 border-t border-edge" />
                <button
                  role="menuitem"
                  className={menuItem}
                  onClick={() => { setMenuOpen(false); disconnectVault() }}
                  title="Forget this folder and switch to browser storage"
                >
                  Disconnect folder
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={onImportFile} />
    </div>
  )
}
