/*
 * Tab ⑤ — Resources & Documents (spec §5-⑤).
 * Top: the 'Open the Novel' hero (ms-word launcher + OneDrive web fallback)
 * with the category 'novel' entries beneath it. Middle: the case-file
 * explorer and the writing-resources panel. Bottom: Settings (manuscript
 * URLs + Maps key) and a muted capability footnote. Everything is the
 * resources/resources.json manifest and writers-panel-config.json — all
 * editable here, persisted via saveResources / saveConfig.
 */
import { useCallback, useMemo } from 'react'
import { useVault } from '../../state/VaultContext.jsx'
import NovelHero from './NovelHero.jsx'
import ResourceList from './ResourceList.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import AppearancePanel from './AppearancePanel.jsx'

export default function ResourcesTab() {
  const { resources, saveResources, config, saveConfig } = useVault()

  // Bucket by category, keeping each entry's index in the FULL array so
  // edits and deletes address the right element. Unknown categories fall
  // into the writing panel rather than vanishing; editing one normalizes it.
  const byCategory = useMemo(() => {
    const groups = { novel: [], 'case-file': [], writing: [] }
    resources.forEach((r, index) => {
      const cat = groups[r?.category] ? r.category : 'writing'
      groups[cat].push({ ...r, _index: index })
    })
    return groups
  }, [resources])

  const addResource = useCallback(async (entry) => {
    await saveResources([...resources, entry])
  }, [resources, saveResources])

  const updateResource = useCallback(async (index, entry) => {
    await saveResources(resources.map((r, i) => (i === index ? entry : r)))
  }, [resources, saveResources])

  const deleteResource = useCallback(async (index) => {
    await saveResources(resources.filter((_, i) => i !== index))
  }, [resources, saveResources])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl p-3 flex flex-col gap-3">
        <NovelHero
          config={config}
          items={byCategory.novel}
          onAdd={addResource}
          onUpdate={updateResource}
          onDelete={deleteResource}
        />

        <ResourceList
          title="Case files"
          intro="The real-world cases, places, and records behind the fiction — the novel borrows their geography and their silences, not their people."
          dotClass="bg-rust"
          items={byCategory['case-file']}
          defaultCategory="case-file"
          onAdd={addResource}
          onUpdate={updateResource}
          onDelete={deleteResource}
        />

        <ResourceList
          title="Writing resources"
          intro="Craft references — structure, narration, frame stories, and the adaptation shelf."
          dotClass="bg-sage"
          items={byCategory.writing}
          defaultCategory="writing"
          onAdd={addResource}
          onUpdate={updateResource}
          onDelete={deleteResource}
        />

        <SettingsPanel config={config} saveConfig={saveConfig} />

        <AppearancePanel config={config} saveConfig={saveConfig} />

        <p className="text-xs text-ink-faint text-center pb-2">
          Folder vaults need the File System Access API (Chrome or Edge). Street View on the
          map needs the Google Maps API key above.
        </p>
      </div>
    </div>
  )
}
