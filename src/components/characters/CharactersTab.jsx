/*
 * Tab ③ — Characters & Themes (spec §5-③).
 * Top row: Obsidian-style relationship force graph (~2/3) beside the synced
 * roster (~1/3), both pinned to ~55vh. Bottom row: the Themes tree and the
 * Character Arcs editor side by side. The whole tab scrolls vertically.
 * Clicking a character anywhere routes to the Profile tab via openProfile.
 */
import { useCallback } from 'react'
import { useVault } from '../../state/VaultContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { usePrompt } from '../../state/UXContext.jsx'
import RelationshipGraph from './RelationshipGraph.jsx'
import CharacterList from './CharacterList.jsx'
import ThemesPanel from './ThemesPanel.jsx'
import ArcsPanel from './ArcsPanel.jsx'

export default function CharactersTab() {
  const {
    characters, saveCharacter, createCharacter,
    arcs, saveArcs, config, saveConfig,
  } = useVault()
  const { openProfile } = useUI()
  const promptText = usePrompt()

  // Accepts a filename ('ray-vega.md') or a frontmatter name ('Lucia Serrano')
  const open = useCallback(
    (filenameOrName) => openProfile(filenameOrName, characters),
    [openProfile, characters],
  )

  const handleCreate = useCallback(async () => {
    const name = await promptText({
      title: 'New character',
      body: 'A new note is created in characters/ with this name.',
      placeholder: 'e.g. Deputy Chief Alvarez',
      confirmLabel: 'Create',
    })
    if (!name) return
    const filename = await createCharacter(name)
    openProfile(filename, characters)
  }, [promptText, createCharacter, openProfile, characters])

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="card lg:flex-[2] min-w-0 h-[55vh] min-h-[320px] overflow-hidden">
            <RelationshipGraph characters={characters} onOpen={open} />
          </div>
          <div className="card lg:flex-1 min-w-0 h-[55vh] min-h-[320px] overflow-hidden">
            <CharacterList characters={characters} onOpen={open} onCreate={handleCreate} />
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
          <ThemesPanel
            characters={characters}
            config={config}
            saveConfig={saveConfig}
            saveCharacter={saveCharacter}
            onOpen={open}
          />
          <ArcsPanel arcs={arcs} saveArcs={saveArcs} characters={characters} onOpen={open} />
        </div>
      </div>
    </div>
  )
}
