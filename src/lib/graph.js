/*
 * Microsoft Graph — live OneDrive folder listing (the spec's planned
 * upgrade over the resources.json manifest).
 *
 * Fully config-gated: nothing here runs, and MSAL is not even downloaded
 * (dynamic import), until the author has put a client_id in
 * writers-panel-config.json:
 *
 *   "microsoft_graph": {
 *     "client_id": "<Azure app registration ID>",
 *     "tenant": "consumers",            // 'consumers' | 'organizations' | 'common'
 *     "folder_share_url": "https://1drv.ms/…"   // Share link to the case-file folder
 *   }
 *
 * Auth is an MSAL popup (PKCE, no secret in the browser). The only scope
 * requested is Files.Read.All — read-only. The folder is resolved through
 * the Graph shares API so a plain OneDrive "Copy link" URL works.
 */

const GRAPH_SCOPES = ['Files.Read.All']
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

let msalPromise = null
let pca = null
let pcaClientId = null

export function graphConfig(config) {
  const g = config?.microsoft_graph || {}
  return {
    clientId: String(g.client_id || '').trim(),
    tenant: ['consumers', 'organizations', 'common'].includes(g.tenant) ? g.tenant : 'common',
    folderShareUrl: String(g.folder_share_url || '').trim(),
  }
}

export function graphConfigured(config) {
  const g = graphConfig(config)
  return Boolean(g.clientId && g.folderShareUrl)
}

/** Lazily create (or re-create after a client_id change) the MSAL app. */
async function getPca({ clientId, tenant }) {
  if (pca && pcaClientId === clientId) return pca
  if (!msalPromise) msalPromise = import('@azure/msal-browser')
  const msal = await msalPromise
  pca = new msal.PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenant}`,
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: 'sessionStorage' },
  })
  await pca.initialize()
  pcaClientId = clientId
  return pca
}

export async function graphAccount(config) {
  const cfg = graphConfig(config)
  if (!cfg.clientId) return null
  const app = await getPca(cfg)
  return app.getAllAccounts()[0] || null
}

export async function graphSignIn(config) {
  const cfg = graphConfig(config)
  const app = await getPca(cfg)
  const result = await app.loginPopup({ scopes: GRAPH_SCOPES, prompt: 'select_account' })
  return result.account
}

export async function graphSignOut(config) {
  const cfg = graphConfig(config)
  const app = await getPca(cfg)
  const account = app.getAllAccounts()[0]
  // Local sign-out only — no full-page redirect to Microsoft's logout.
  if (account) await app.clearCache({ account })
}

async function getToken(config) {
  const cfg = graphConfig(config)
  const app = await getPca(cfg)
  const account = app.getAllAccounts()[0]
  if (!account) throw new Error('Not signed in')
  try {
    const r = await app.acquireTokenSilent({ scopes: GRAPH_SCOPES, account })
    return r.accessToken
  } catch {
    const r = await app.acquireTokenPopup({ scopes: GRAPH_SCOPES, account })
    return r.accessToken
  }
}

/** OneDrive share URL → Graph shares-API id ("u!" + base64url). */
export function encodeShareUrl(url) {
  const b64 = btoa(unescape(encodeURIComponent(url)))
  return 'u!' + b64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-')
}

/**
 * List the shared folder's children.
 * Returns [{ id, name, webUrl, size, modified, isFolder }] sorted
 * folders-first then by name.
 */
export async function listSharedFolder(config) {
  const cfg = graphConfig(config)
  const token = await getToken(config)
  const shareId = encodeShareUrl(cfg.folderShareUrl)
  const res = await fetch(
    `${GRAPH_BASE}/shares/${shareId}/driveItem/children` +
      '?$select=id,name,webUrl,size,lastModifiedDateTime,folder,file&$top=200',
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = body?.error?.message || `Graph returned ${res.status}`
    throw new Error(msg)
  }
  const data = await res.json()
  return (data.value || [])
    .map((item) => ({
      id: item.id,
      name: item.name,
      webUrl: item.webUrl,
      size: item.size ?? 0,
      modified: item.lastModifiedDateTime || '',
      isFolder: Boolean(item.folder),
    }))
    .sort((a, b) => (Number(b.isFolder) - Number(a.isFolder)) || a.name.localeCompare(b.name))
}
