/*
 * Vault file access.
 *
 * SINGLE SOURCE OF TRUTH: the user's Obsidian vault folder. Two backends
 * expose the same tiny interface so everything above them is agnostic:
 *
 *   readFile(path)   -> string | null       (null = missing)
 *   writeFile(path, contents)               (creates parent dirs)
 *   deleteFile(path)
 *   listDir(path)    -> [filenames]         (files only, no recursion)
 *
 * Paths are vault-relative, "/"-separated, e.g. "characters/ray-vega.md".
 *
 * - FsaBackend: File System Access API (Chromium). The directory handle is
 *   persisted in IndexedDB (idb-keyval) so the vault reconnects across
 *   sessions after a single permission click.
 * - LocalBackend: localStorage fallback (Firefox/Safari, or before a folder
 *   is granted). Same path->content map, plus zip import/export so nothing
 *   is locked in.
 */
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'

const IDB_HANDLE_KEY = 'dirty-plush-vault-dir'
const LS_KEY = 'dirty-plush-vault-files'

// Canonical vault layout (see README / spec §6)
export const VAULT_PATHS = {
  config: 'writers-panel-config.json',
  events: 'timeline/events.json',
  beats: 'structure/beats.json',
  arcs: 'arcs.csv',
  locations: 'map/locations.geojson',
  resources: 'resources/resources.json',
  charactersDir: 'characters',
}

export function fsaSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/* ---------------- File System Access backend ---------------- */

export class FsaBackend {
  constructor(dirHandle) {
    this.mode = 'fsa'
    this.dirHandle = dirHandle
    this.name = dirHandle.name
  }

  async #resolveDir(parts, { create = false } = {}) {
    let dir = this.dirHandle
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create })
    }
    return dir
  }

  async readFile(path) {
    const parts = path.split('/')
    const fileName = parts.pop()
    try {
      const dir = await this.#resolveDir(parts)
      const fh = await dir.getFileHandle(fileName)
      const file = await fh.getFile()
      return await file.text()
    } catch (err) {
      if (err && (err.name === 'NotFoundError' || err.name === 'TypeMismatchError')) return null
      throw err
    }
  }

  async writeFile(path, contents) {
    const parts = path.split('/')
    const fileName = parts.pop()
    const dir = await this.#resolveDir(parts, { create: true })
    const fh = await dir.getFileHandle(fileName, { create: true })
    const writable = await fh.createWritable()
    await writable.write(contents)
    await writable.close()
  }

  async deleteFile(path) {
    const parts = path.split('/')
    const fileName = parts.pop()
    try {
      const dir = await this.#resolveDir(parts)
      await dir.removeEntry(fileName)
    } catch (err) {
      if (err && err.name === 'NotFoundError') return
      throw err
    }
  }

  async listDir(path) {
    try {
      const dir = await this.#resolveDir(path ? path.split('/') : [])
      const names = []
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind === 'file') names.push(name)
      }
      return names.sort()
    } catch (err) {
      if (err && err.name === 'NotFoundError') return []
      throw err
    }
  }
}

/** Ask the user to pick their vault folder; persist the handle for next time. */
export async function pickVaultDirectory() {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  await idbSet(IDB_HANDLE_KEY, handle)
  return new FsaBackend(handle)
}

/**
 * Try to restore a previously granted vault without prompting.
 * Returns { backend } when permission is still granted,
 * { needsPermission: handle } when a user gesture must re-confirm,
 * or null when no handle was stored.
 */
export async function restoreVaultDirectory() {
  let handle
  try {
    handle = await idbGet(IDB_HANDLE_KEY)
  } catch {
    return null
  }
  if (!handle) return null
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') return { backend: new FsaBackend(handle) }
    return { needsPermission: handle }
  } catch {
    return null
  }
}

/** Re-request permission on a stored handle (must run in a user gesture). */
export async function requestVaultPermission(handle) {
  const perm = await handle.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') return null
  return new FsaBackend(handle)
}

export async function forgetVaultDirectory() {
  await idbDel(IDB_HANDLE_KEY)
}

/* ---------------- localStorage fallback backend ---------------- */

export class LocalBackend {
  constructor() {
    this.mode = 'fallback'
    this.name = 'browser storage'
    this.files = this.#load()
  }

  #load() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY)) || {}
    } catch {
      return {}
    }
  }

  #persist() {
    localStorage.setItem(LS_KEY, JSON.stringify(this.files))
  }

  async readFile(path) {
    return Object.prototype.hasOwnProperty.call(this.files, path) ? this.files[path] : null
  }

  async writeFile(path, contents) {
    this.files[path] = contents
    this.#persist()
  }

  async deleteFile(path) {
    delete this.files[path]
    this.#persist()
  }

  async listDir(path) {
    const prefix = path ? path + '/' : ''
    return Object.keys(this.files)
      .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .map((p) => p.slice(prefix.length))
      .sort()
  }

  clear() {
    this.files = {}
    this.#persist()
  }
}

/* ---------------- import / export (works on either backend) ---------------- */

/** Collect every canonical vault file as { path: contents }. */
export async function snapshotVault(backend) {
  const out = {}
  const flat = [
    VAULT_PATHS.config, VAULT_PATHS.events, VAULT_PATHS.beats,
    VAULT_PATHS.arcs, VAULT_PATHS.locations, VAULT_PATHS.resources,
  ]
  for (const path of flat) {
    const text = await backend.readFile(path)
    if (text != null) out[path] = text
  }
  for (const name of await backend.listDir(VAULT_PATHS.charactersDir)) {
    if (!name.endsWith('.md')) continue
    const path = `${VAULT_PATHS.charactersDir}/${name}`
    const text = await backend.readFile(path)
    if (text != null) out[path] = text
  }
  return out
}

export async function exportVaultZip(backend) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const snapshot = await snapshotVault(backend)
  for (const [path, contents] of Object.entries(snapshot)) {
    zip.file(path, contents)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'dirty-plush-vault.zip'
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Import a .zip produced by exportVaultZip (or hand-built with the same layout). */
export async function importVaultZip(backend, file) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)
  let count = 0
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue
    const path = entry.name.replace(/^\/+/, '')
    // Only accept files that live inside the canonical layout
    const ok =
      path === VAULT_PATHS.config || path === VAULT_PATHS.arcs ||
      path.startsWith('timeline/') || path.startsWith('structure/') ||
      path.startsWith('map/') || path.startsWith('resources/') ||
      path.startsWith('characters/')
    if (!ok) continue
    await backend.writeFile(path, await entry.async('string'))
    count++
  }
  return count
}
