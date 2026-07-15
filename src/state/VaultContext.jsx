/*
 * VaultContext — the app's data layer.
 *
 * Owns the active backend (File System Access folder or localStorage
 * fallback), loads every canonical vault file into memory, and exposes
 * typed collections plus save functions that write straight back to the
 * same plain files Obsidian edits.
 *
 * Consumers use the hook:
 *   const { characters, saveCharacter, events, saveEvents, ... } = useVault()
 *
 * Shapes:
 *   character: { filename, frontmatter: {name, role, relationships[],
 *                theme_stance, arc_begin, arc_end, ...}, body }
 *   event:     { id, title, start, end?, group?, color?, weight?, priority?,
 *                beat?, summary?, detail? }
 *   beat:      { id, order, label, chapter, chapterTitle, summary, craft }
 *   arc row:   { character, arc_begin, arc_end }
 *   locations: GeoJSON FeatureCollection (features carry properties.fields[]
 *              with {label, value, estimate} entries)
 *   resource:  { title, url, note, category }
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  LocalBackend, VAULT_PATHS, exportVaultZip, fsaSupported, forgetVaultDirectory,
  importVaultZip, pickVaultDirectory, requestVaultPermission, restoreVaultDirectory,
} from '../lib/files.js'
import { findMissingSeedFiles, writeSeedFiles } from '../lib/seed.js'
import { parseNote, serializeNote, slugify } from '../lib/markdown.js'
import { parseArcsCsv, serializeArcsCsv } from '../lib/csvArcs.js'
import { useConfirm, useToast } from './UXContext.jsx'

const VaultContext = createContext(null)

const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] }

function parseJson(text, label, errors) {
  if (text == null) return null
  try {
    return JSON.parse(text)
  } catch (err) {
    errors.push(`${label}: ${err.message}`)
    return null
  }
}

export function VaultProvider({ children }) {
  const toast = useToast()
  const confirm = useConfirm()
  const backendRef = useRef(null)
  // Throttle "Saved …" toasts so rapid-fire saves to one file toast once
  const lastSaveToastRef = useRef(new Map())
  const [status, setStatus] = useState({
    mode: 'loading', // 'loading' | 'fsa' | 'fallback'
    vaultName: '',
    fsaSupported: fsaSupported(),
    needsReconnect: false,
  })
  const pendingHandleRef = useRef(null)
  const [errors, setErrors] = useState([])

  const [config, setConfig] = useState({})
  const [characters, setCharacters] = useState([])
  const [events, setEvents] = useState([])
  const [beats, setBeats] = useState([])
  const [arcs, setArcs] = useState([])
  const [locations, setLocations] = useState(EMPTY_GEOJSON)
  const [resources, setResources] = useState([])

  /* ---------- loading ---------- */

  const loadAll = useCallback(async (backend) => {
    const errs = []
    const [configText, eventsText, beatsText, arcsText, locationsText, resourcesText, charNames] =
      await Promise.all([
        backend.readFile(VAULT_PATHS.config),
        backend.readFile(VAULT_PATHS.events),
        backend.readFile(VAULT_PATHS.beats),
        backend.readFile(VAULT_PATHS.arcs),
        backend.readFile(VAULT_PATHS.locations),
        backend.readFile(VAULT_PATHS.resources),
        backend.listDir(VAULT_PATHS.charactersDir),
      ])

    const chars = []
    for (const name of charNames) {
      if (!name.endsWith('.md')) continue
      const text = await backend.readFile(`${VAULT_PATHS.charactersDir}/${name}`)
      if (text == null) continue
      const { frontmatter, body } = parseNote(text)
      chars.push({ filename: name, frontmatter, body })
    }
    chars.sort((a, b) => (a.frontmatter.name || a.filename).localeCompare(b.frontmatter.name || b.filename))

    setConfig(parseJson(configText, 'writers-panel-config.json', errs) ?? {})
    setEvents(parseJson(eventsText, 'timeline/events.json', errs) ?? [])
    setBeats(parseJson(beatsText, 'structure/beats.json', errs) ?? [])
    setArcs(arcsText != null ? parseArcsCsv(arcsText) : [])
    setLocations(parseJson(locationsText, 'map/locations.geojson', errs) ?? EMPTY_GEOJSON)
    setResources(parseJson(resourcesText, 'resources/resources.json', errs) ?? [])
    setCharacters(chars)
    setErrors(errs)
  }, [])

  const adoptBackend = useCallback(async (backend, { confirmSeed = false } = {}) => {
    const missing = await findMissingSeedFiles(backend)
    if (missing.length > 0) {
      let ok = true
      if (confirmSeed) {
        ok = await confirm({
          title: 'Create starter files?',
          body: `This folder is missing ${missing.length} Dirty Plush starter file(s) — characters, timeline, map pins, beats. Existing files are never overwritten.`,
          confirmLabel: 'Create them',
          cancelLabel: 'Not now',
        })
      }
      if (ok) {
        await writeSeedFiles(backend, missing)
        if (confirmSeed) toast(`Created ${missing.length} starter file(s) in the vault`, 'success')
      }
    }
    backendRef.current = backend
    await loadAll(backend)
    setStatus((s) => ({ ...s, mode: backend.mode, vaultName: backend.name, needsReconnect: false }))
  }, [loadAll, confirm, toast])

  // Boot: restore a granted folder if we can, else fall back to browser storage.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const restored = fsaSupported() ? await restoreVaultDirectory() : null
        if (cancelled) return
        if (restored?.backend) {
          await adoptBackend(restored.backend)
          return
        }
        if (restored?.needsPermission) {
          pendingHandleRef.current = restored.needsPermission
          setStatus((s) => ({ ...s, needsReconnect: true }))
        }
        await adoptBackend(new LocalBackend())
      } catch (err) {
        console.error('Vault boot failed', err)
        if (!cancelled) {
          await adoptBackend(new LocalBackend())
          setErrors((e) => [...e, `Vault could not be restored: ${err.message}`])
        }
      }
    })()
    return () => { cancelled = true }
  }, [adoptBackend])

  /* ---------- vault actions ---------- */

  const connectVault = useCallback(async () => {
    try {
      const backend = await pickVaultDirectory()
      await adoptBackend(backend, { confirmSeed: true })
      toast(`Connected vault "${backend.name}" — reading and writing real files`, 'success')
    } catch (err) {
      if (err && err.name === 'AbortError') return // user closed the picker
      setErrors((e) => [...e, `Could not open folder: ${err.message}`])
    }
  }, [adoptBackend, toast])

  const reconnectVault = useCallback(async () => {
    const handle = pendingHandleRef.current
    if (!handle) return connectVault()
    try {
      const backend = await requestVaultPermission(handle)
      if (backend) {
        pendingHandleRef.current = null
        await adoptBackend(backend)
      }
    } catch (err) {
      setErrors((e) => [...e, `Reconnect failed: ${err.message}`])
    }
  }, [adoptBackend, connectVault])

  const disconnectVault = useCallback(async () => {
    await forgetVaultDirectory()
    pendingHandleRef.current = null
    await adoptBackend(new LocalBackend())
  }, [adoptBackend])

  const reloadVault = useCallback(async () => {
    if (backendRef.current) {
      await loadAll(backendRef.current)
      toast('Vault reloaded — showing the latest file contents')
    }
  }, [loadAll, toast])

  const exportVault = useCallback(async () => {
    if (backendRef.current) await exportVaultZip(backendRef.current)
  }, [])

  const importVault = useCallback(async (file) => {
    if (!backendRef.current) return 0
    const count = await importVaultZip(backendRef.current, file)
    await loadAll(backendRef.current)
    return count
  }, [loadAll])

  /* ---------- collection saves (state + file, always together) ---------- */

  const write = useCallback(async (path, contents) => {
    try {
      await backendRef.current.writeFile(path, contents)
      const now = Date.now()
      const last = lastSaveToastRef.current.get(path) || 0
      if (now - last > 2500) {
        lastSaveToastRef.current.set(path, now)
        toast(`Saved ${path}`)
      }
    } catch (err) {
      toast(`Save failed for ${path}: ${err.message}`, 'error', { sticky: true })
      throw err
    }
  }, [toast])

  const saveConfig = useCallback(async (next) => {
    setConfig(next)
    await write(VAULT_PATHS.config, JSON.stringify(next, null, 2) + '\n')
  }, [write])

  const saveEvents = useCallback(async (next) => {
    setEvents(next)
    await write(VAULT_PATHS.events, JSON.stringify(next, null, 2) + '\n')
  }, [write])

  const saveBeats = useCallback(async (next) => {
    setBeats(next)
    await write(VAULT_PATHS.beats, JSON.stringify(next, null, 2) + '\n')
  }, [write])

  const saveLocations = useCallback(async (next) => {
    setLocations(next)
    await write(VAULT_PATHS.locations, JSON.stringify(next, null, 2) + '\n')
  }, [write])

  const saveResources = useCallback(async (next) => {
    setResources(next)
    await write(VAULT_PATHS.resources, JSON.stringify(next, null, 2) + '\n')
  }, [write])

  /**
   * Arcs live in arcs.csv (the panel's backing store) AND in each character's
   * frontmatter. Saving the panel keeps both in sync so Obsidian and the app
   * never disagree.
   */
  const saveArcs = useCallback(async (next) => {
    setArcs(next)
    await write(VAULT_PATHS.arcs, serializeArcsCsv(next))
    for (const row of next) {
      const ch = characters.find(
        (c) => (c.frontmatter.name || '').toLowerCase() === row.character.toLowerCase(),
      )
      if (!ch) continue
      if (ch.frontmatter.arc_begin === row.arc_begin && ch.frontmatter.arc_end === row.arc_end) continue
      const updated = {
        ...ch,
        frontmatter: { ...ch.frontmatter, arc_begin: row.arc_begin, arc_end: row.arc_end },
      }
      await write(`${VAULT_PATHS.charactersDir}/${ch.filename}`, serializeNote(updated))
      setCharacters((cs) => cs.map((c) => (c.filename === ch.filename ? updated : c)))
    }
  }, [write, characters])

  const saveCharacter = useCallback(async (filename, { frontmatter, body }) => {
    const next = { filename, frontmatter, body }
    setCharacters((cs) => {
      const idx = cs.findIndex((c) => c.filename === filename)
      if (idx === -1) return [...cs, next]
      const copy = [...cs]
      copy[idx] = next
      return copy
    })
    await write(`${VAULT_PATHS.charactersDir}/${filename}`, serializeNote(next))
  }, [write])

  const createCharacter = useCallback(async (name) => {
    const filename = `${slugify(name)}.md`
    if (characters.some((c) => c.filename === filename)) return filename
    await saveCharacter(filename, {
      frontmatter: {
        name, role: '', relationships: [], theme_stance: '', arc_begin: '', arc_end: '',
      },
      body: `# ${name}\n\nNotes…\n`,
    })
    return filename
  }, [characters, saveCharacter])

  const deleteCharacter = useCallback(async (filename) => {
    setCharacters((cs) => cs.filter((c) => c.filename !== filename))
    await backendRef.current.deleteFile(`${VAULT_PATHS.charactersDir}/${filename}`)
  }, [])

  const dismissErrors = useCallback(() => setErrors([]), [])

  const value = useMemo(() => ({
    status, errors, dismissErrors,
    connectVault, reconnectVault, disconnectVault, reloadVault, exportVault, importVault,
    config, saveConfig,
    characters, saveCharacter, createCharacter, deleteCharacter,
    events, saveEvents,
    beats, saveBeats,
    arcs, saveArcs,
    locations, saveLocations,
    resources, saveResources,
  }), [
    status, errors, dismissErrors,
    connectVault, reconnectVault, disconnectVault, reloadVault, exportVault, importVault,
    config, saveConfig, characters, saveCharacter, createCharacter, deleteCharacter,
    events, saveEvents, beats, saveBeats, arcs, saveArcs,
    locations, saveLocations, resources, saveResources,
  ])

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}

export function useVault() {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used inside <VaultProvider>')
  return ctx
}
