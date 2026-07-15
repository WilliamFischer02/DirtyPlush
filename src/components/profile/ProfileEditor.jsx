/*
 * Main pane of tab ④ — one character note, fully editable.
 *
 * Draft-and-save model: every field edits a local draft; the explicit Save
 * button (or Cmd/Ctrl+S) writes the WHOLE note back through
 * useVault().saveCharacter, and Revert re-reads from vault state.
 * Frontmatter keys this panel doesn't know about are spread through
 * untouched, and renaming `name` never renames the file (identity =
 * filename — noted small under the header).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseRelationships, renderMarkdown, serializeRelationship } from '../../lib/markdown.js'
import { useConfirm } from '../../state/UXContext.jsx'
import RelationshipsEditor from './RelationshipsEditor.jsx'

const KNOWN_KEYS = ['name', 'role', 'relationships', 'theme_stance', 'arc_begin', 'arc_end']

function draftFrom(character) {
  const fm = character.frontmatter || {}
  return {
    name: String(fm.name ?? ''),
    role: String(fm.role ?? ''),
    theme_stance: String(fm.theme_stance ?? ''),
    arc_begin: String(fm.arc_begin ?? ''),
    arc_end: String(fm.arc_end ?? ''),
    relationships: parseRelationships(fm.relationships),
    body: character.body ?? '',
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export default function ProfileEditor({
  character, characters, saveCharacter, onDelete, onOpenCharacter, onDirtyChange,
}) {
  const [draft, setDraft] = useState(() => draftFrom(character))
  const [mode, setMode] = useState('preview') // 'preview' | 'edit'
  const [saving, setSaving] = useState(false)
  const confirmDialog = useConfirm()

  // If the note changes underneath us (vault reload, import) and the draft
  // is clean, pick up the new content; in-progress edits are never clobbered.
  const prevRef = useRef(character)
  useEffect(() => {
    if (character === prevRef.current) return
    const prevClean = draftFrom(prevRef.current)
    prevRef.current = character
    setDraft((d) => (same(d, prevClean) ? draftFrom(character) : d))
  }, [character])

  const dirty = useMemo(() => !same(draft, draftFrom(character)), [draft, character])
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => { onDirtyChange?.(false) }, [onDirtyChange])

  const set = useCallback((field, value) => setDraft((d) => ({ ...d, [field]: value })), [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const rels = draft.relationships
        .map((r) => ({
          target: String(r.target || '').trim(),
          label: String(r.label || '').trim(),
          hidden: !!r.hidden,
        }))
        .filter((r) => r.target)
      const relStrings = rels.map(serializeRelationship)
      const frontmatter = {
        ...character.frontmatter, // unknown extra keys pass through untouched
        name: draft.name,
        role: draft.role,
        relationships: relStrings,
        theme_stance: draft.theme_stance,
        arc_begin: draft.arc_begin,
        arc_end: draft.arc_end,
      }
      // Normalise the draft to exactly what the vault will hold so the
      // dirty flag clears (and stays honest) after the round-trip.
      setDraft((d) => ({ ...d, relationships: parseRelationships(relStrings) }))
      await saveCharacter(character.filename, { frontmatter, body: draft.body })
    } catch (err) {
      console.error('Save failed', err) // also surfaced via the vault error banner
    } finally {
      setSaving(false)
    }
  }, [character, draft, saveCharacter])

  const revert = useCallback(() => setDraft(draftFrom(character)), [character])

  const handleDelete = useCallback(async () => {
    const label = draft.name || character.filename
    const ok = await confirmDialog({
      title: `Delete "${label}"?`,
      body: `This removes characters/${character.filename} from the vault.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) onDelete(character.filename)
  }, [draft.name, character.filename, onDelete, confirmDialog])

  // Cmd/Ctrl+S saves — bound once, kept fresh through a ref
  const saveRef = useRef(null)
  saveRef.current = () => { if (dirty && !saving) save() }
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const bodyHtml = useMemo(
    () => (mode === 'preview' ? renderMarkdown(draft.body) : ''),
    [mode, draft.body],
  )
  const extraKeys = Object.keys(character.frontmatter || {}).filter((k) => !KNOWN_KEYS.includes(k))

  const segBtn = (m) =>
    'px-2.5 py-1 text-xs transition-colors cursor-pointer ' +
    (mode === m ? 'bg-panel-3 text-accent' : 'text-ink-dim hover:text-ink')

  return (
    <div className="h-full flex flex-col min-h-0">
      <header className="shrink-0 border-b border-edge bg-panel px-5 py-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl leading-tight text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
            {draft.name || character.filename}
          </h2>
          <div className="text-sm text-ink-dim mt-0.5">{draft.role || 'No role yet'}</div>
          <div className="text-[11px] text-ink-faint mt-1">
            characters/{character.filename} — editing "name" renames the character, not the file
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {dirty && (
            <span className="flex items-center gap-1.5 text-xs text-accent mr-1" role="status">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
              unsaved
            </span>
          )}
          <button className="btn text-xs" onClick={revert} disabled={!dirty || saving}>
            Revert
          </button>
          <button
            className="btn btn-accent text-xs"
            onClick={save}
            disabled={!dirty || saving}
            title="Save the whole note (Ctrl/Cmd+S)"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn-danger text-xs" onClick={handleDelete} title="Delete this character note">
            Delete
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 max-w-4xl flex flex-col gap-3">
          <section className="card p-4">
            <div className="flex items-baseline gap-2 mb-3">
              <h3 className="text-sm font-semibold text-ink">Frontmatter</h3>
              <span className="text-xs text-ink-faint">Obsidian properties, saved with the note</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="pf-name">Name</label>
                <input
                  id="pf-name"
                  className="input"
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Display name"
                />
              </div>
              <div>
                <label className="label" htmlFor="pf-role">Role</label>
                <input
                  id="pf-role"
                  className="input"
                  value={draft.role}
                  onChange={(e) => set('role', e.target.value)}
                  placeholder="Function in the story"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label" htmlFor="pf-stance">Theme stance</label>
                <input
                  id="pf-stance"
                  className="input"
                  value={draft.theme_stance}
                  onChange={(e) => set('theme_stance', e.target.value)}
                  placeholder="Where they stand on the theme"
                />
              </div>
              <div>
                <label className="label" htmlFor="pf-arc-begin">Arc — beginning</label>
                <textarea
                  id="pf-arc-begin"
                  className="input resize-y leading-snug"
                  rows={3}
                  value={draft.arc_begin}
                  onChange={(e) => set('arc_begin', e.target.value)}
                  placeholder="who they are when we meet them"
                />
              </div>
              <div>
                <label className="label" htmlFor="pf-arc-end">Arc — end</label>
                <textarea
                  id="pf-arc-end"
                  className="input resize-y leading-snug"
                  rows={3}
                  value={draft.arc_end}
                  onChange={(e) => set('arc_end', e.target.value)}
                  placeholder="who the story leaves them as"
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="label">Relationships</div>
              <RelationshipsEditor
                rows={draft.relationships}
                onChange={(rows) => set('relationships', rows)}
                characters={characters}
                selfFilename={character.filename}
                onOpenCharacter={onOpenCharacter}
              />
            </div>

            {extraKeys.length > 0 && (
              <p className="text-[11px] text-ink-faint mt-3">
                Also in this note's frontmatter, kept as-is: {extraKeys.join(', ')}
              </p>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-edge">
              <h3 className="text-sm font-semibold text-ink">Note body</h3>
              <span className="text-xs text-ink-faint hidden sm:inline">Markdown</span>
              <div className="ml-auto flex rounded-md border border-edge overflow-hidden">
                <button
                  className={segBtn('preview')}
                  onClick={() => setMode('preview')}
                  aria-pressed={mode === 'preview'}
                >
                  Preview
                </button>
                <button
                  className={segBtn('edit')}
                  onClick={() => setMode('edit')}
                  aria-pressed={mode === 'edit'}
                >
                  Edit
                </button>
              </div>
            </div>
            {mode === 'preview' ? (
              draft.body.trim() ? (
                <div className="prose-noir px-5 py-4" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              ) : (
                <div className="px-5 py-4 text-sm text-ink-dim">
                  Nothing written yet — switch to Edit to start the note.
                </div>
              )
            ) : (
              <textarea
                className="block w-full min-h-[60vh] bg-panel px-4 py-3 text-[13px] leading-relaxed text-ink resize-y focus:outline-none placeholder-ink-faint"
                style={{ fontFamily: 'var(--font-mono)' }}
                value={draft.body}
                onChange={(e) => set('body', e.target.value)}
                placeholder={'# Heading\n\nFree-form Markdown…'}
                spellCheck={false}
                aria-label="Note body (Markdown)"
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
