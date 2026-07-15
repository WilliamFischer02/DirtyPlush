/*
 * Tab ④ — Profile (spec §5-④).
 * Left rail: compact character list. Main pane: the selected character's
 * whole note — frontmatter fields, relationship rows, Markdown body —
 * edited as a local draft and written back with an explicit Save
 * (Cmd/Ctrl+S works too). Switching away from a dirty draft asks first.
 */
import { useCallback, useEffect, useState } from 'react'
import { useVault } from '../../state/VaultContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import ProfileRail from './ProfileRail.jsx'
import ProfileEditor from './ProfileEditor.jsx'

export default function ProfileTab() {
  const { characters, saveCharacter, createCharacter, deleteCharacter } = useVault()
  const { profileCharacter, setProfileCharacter } = useUI()
  const [dirty, setDirty] = useState(false)

  const selected = characters.find((c) => c.filename === profileCharacter) || null

  // Nothing selected (first visit, or the note was deleted) → first character
  useEffect(() => {
    if (!selected && characters.length > 0) setProfileCharacter(characters[0].filename)
  }, [selected, characters, setProfileCharacter])

  const confirmDiscard = useCallback(
    () => !dirty || window.confirm('Discard unsaved changes to this profile?'),
    [dirty],
  )

  const switchTo = useCallback((filename) => {
    if (filename === profileCharacter) return
    if (!confirmDiscard()) return
    setProfileCharacter(filename)
  }, [profileCharacter, confirmDiscard, setProfileCharacter])

  const handleCreate = useCallback(async () => {
    if (!confirmDiscard()) return
    const name = window.prompt('Name for the new character:')
    if (!name || !name.trim()) return
    try {
      const filename = await createCharacter(name.trim())
      setProfileCharacter(filename)
    } catch (err) {
      console.error('Could not create character', err)
    }
  }, [confirmDiscard, createCharacter, setProfileCharacter])

  const handleDelete = useCallback(async (filename) => {
    const idx = characters.findIndex((c) => c.filename === filename)
    const remaining = characters.filter((c) => c.filename !== filename)
    const neighbor = remaining[Math.min(Math.max(idx, 0), remaining.length - 1)] || null
    try {
      await deleteCharacter(filename)
    } catch (err) {
      console.error('Could not delete character', err)
    }
    setProfileCharacter(neighbor ? neighbor.filename : null)
  }, [characters, deleteCharacter, setProfileCharacter])

  if (characters.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <h2 className="text-xl text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
            No characters yet
          </h2>
          <p className="text-sm text-ink-dim mt-2">
            Character notes are plain Markdown files in the vault's characters/ folder —
            Obsidian opens the same files. Create the first one to start a profile.
          </p>
          <button className="btn btn-accent mt-4" onClick={handleCreate}>+ New character</button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex min-h-0">
      <ProfileRail
        characters={characters}
        activeFilename={selected ? selected.filename : null}
        onSelect={switchTo}
        onCreate={handleCreate}
      />
      <div className="flex-1 min-w-0 min-h-0">
        {selected && (
          <ProfileEditor
            key={selected.filename}
            character={selected}
            characters={characters}
            saveCharacter={saveCharacter}
            onDelete={handleDelete}
            onOpenCharacter={switchTo}
            onDirtyChange={setDirty}
          />
        )}
      </div>
    </div>
  )
}
