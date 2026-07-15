/*
 * VaultBar — vault connection status + actions (top-right of the shell).
 * Shows which store is live (folder vs browser fallback), and offers
 * connect / reconnect / reload / export / import.
 */
import { useRef } from 'react'
import { useVault } from '../state/VaultContext.jsx'

export default function VaultBar() {
  const {
    status, connectVault, reconnectVault, disconnectVault,
    reloadVault, exportVault, importVault,
  } = useVault()
  const fileRef = useRef(null)

  const onImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const count = await importVault(file)
      window.alert(`Imported ${count} file(s) into the vault.`)
    }
    e.target.value = ''
  }

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
      {status.mode === 'fsa' && (
        <button className="btn" onClick={disconnectVault} title="Forget this folder and switch to browser storage">
          Disconnect
        </button>
      )}

      <button className="btn" onClick={reloadVault} title="Re-read all files (pick up edits made in Obsidian)">
        Reload
      </button>
      <button className="btn" onClick={exportVault} title="Download the whole vault as a .zip">
        Export
      </button>
      <button className="btn" onClick={() => fileRef.current?.click()} title="Import a vault .zip">
        Import
      </button>
      <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={onImportFile} />
    </div>
  )
}
