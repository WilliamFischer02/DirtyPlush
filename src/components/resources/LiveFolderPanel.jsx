/*
 * Live OneDrive folder (Microsoft Graph) — the upgrade over the static
 * resources.json manifest. Appears configured-off with setup pointers until
 * writers-panel-config.json carries microsoft_graph.client_id and
 * folder_share_url; then offers a read-only popup sign-in and lists the
 * folder's contents live. Errors are shown verbatim — never faked.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  graphAccount, graphConfig, graphConfigured, graphSignIn, graphSignOut, listSharedFolder,
} from '../../lib/graph.js'
import { useToast } from '../../state/UXContext.jsx'

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function LiveFolderPanel({ config }) {
  const toast = useToast()
  const configured = graphConfigured(config)
  const { clientId } = graphConfig(config)

  const [account, setAccount] = useState(null)
  const [items, setItems] = useState(null) // null = not loaded
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Restore a cached session (no popup) when the panel mounts configured.
  useEffect(() => {
    let cancelled = false
    setAccount(null)
    setItems(null)
    setError('')
    if (!configured) return undefined
    graphAccount(config).then((acct) => {
      if (!cancelled) setAccount(acct)
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, clientId])

  const refresh = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      setItems(await listSharedFolder(config))
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }, [config])

  // Signed in → load immediately
  useEffect(() => {
    if (account && items === null && !busy) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])

  const signIn = async () => {
    setBusy(true)
    setError('')
    try {
      const acct = await graphSignIn(config)
      setAccount(acct)
      toast(`Signed in as ${acct.username}`, 'success')
    } catch (err) {
      if (!/user_cancelled|popup_window_error/i.test(String(err))) {
        setError(err.message || String(err))
      }
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    await graphSignOut(config)
    setAccount(null)
    setItems(null)
    toast('Signed out of Microsoft Graph')
  }

  return (
    <section className="card">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-edge">
        <span className="w-2 h-2 rounded-full bg-teal inline-block" />
        <h2 className="text-sm font-semibold text-ink">Live OneDrive folder</h2>
        <span className="text-xs text-ink-faint">Microsoft Graph · read-only</span>
        {account && (
          <span className="ml-auto flex items-center gap-2 text-xs text-ink-dim">
            {account.username}
            <button className="btn text-xs !py-0.5" onClick={refresh} disabled={busy}>
              {busy ? 'Loading…' : 'Refresh'}
            </button>
            <button className="btn text-xs !py-0.5" onClick={signOut}>Sign out</button>
          </span>
        )}
      </div>

      <div className="p-3">
        {!configured ? (
          <p className="text-xs text-ink-dim leading-relaxed">
            Off until configured — the case-file list above keeps working from the manifest.
            To turn this on, register a free Azure app (see the README's&nbsp;
            <em>Live OneDrive folder</em> section) and add its client ID plus a OneDrive
            folder share link under <strong className="text-ink">Settings → Microsoft Graph</strong> below.
            Sign-in is a Microsoft popup; this app only ever asks for read access.
          </p>
        ) : !account ? (
          <div className="flex items-center gap-3">
            <button className="btn btn-accent" onClick={signIn} disabled={busy}>
              {busy ? 'Opening popup…' : 'Sign in to Microsoft'}
            </button>
            <span className="text-xs text-ink-faint">
              Read-only (Files.Read.All). Nothing is stored outside this browser session.
            </span>
          </div>
        ) : error ? (
          <div className="text-sm text-rust">
            {error}
            <button className="btn ml-3 text-xs" onClick={refresh}>Try again</button>
          </div>
        ) : items === null ? (
          <p className="text-xs text-ink-faint">Loading the folder…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-ink-faint italic">The shared folder is empty.</p>
        ) : (
          <div className="divide-y divide-edge/60">
            {items.map((item) => (
              <div key={item.id} className="flex items-baseline gap-2 py-1.5">
                <span className="text-ink-faint text-xs w-4 shrink-0" aria-hidden="true">
                  {item.isFolder ? '▸' : '·'}
                </span>
                <a
                  href={item.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-ink hover:text-accent transition-colors break-words min-w-0"
                >
                  {item.name}
                </a>
                <span className="ml-auto shrink-0 text-xs text-ink-faint">
                  {item.isFolder ? 'folder' : formatSize(item.size)}
                  {item.modified && ` · ${item.modified.slice(0, 10)}`}
                </span>
              </div>
            ))}
          </div>
        )}
        {error && !account ? <p className="mt-2 text-sm text-rust">{error}</p> : null}
      </div>
    </section>
  )
}
