/*
 * Themes — a small tree rooted at the novel's controlling question, with
 * three branches (For / Complicated / Against). Characters bucket by their
 * frontmatter.theme_stance via the documented heuristic in characterUtils.
 * The stance is editable inline (persists to the character note); the root
 * question/thesis are seeded defaults that live in writers-panel-config.json
 * once edited, so nothing thematic is hard-coded.
 */
import { useMemo, useRef, useState } from 'react'
import { THEME_BRANCHES, stanceBranch } from './characterUtils.js'

const DEFAULT_QUESTION =
  'The truth and justice are not the same thing — and the man who knows the difference pays for both.'
const DEFAULT_THESIS =
  "Holding on can be the most moral act of a person's life, or the most cowardly — and from the inside, they feel identical."

function StanceChip({ character, onOpen, saveCharacter }) {
  const { filename, frontmatter, body } = character
  const stance = frontmatter.theme_stance || ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cancelledRef = useRef(false) // Escape must never save via the trailing blur

  const start = () => {
    setDraft(stance)
    cancelledRef.current = false
    setEditing(true)
  }

  const commit = async () => {
    setEditing(false)
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }
    const next = draft.trim()
    if (next === stance) return
    await saveCharacter(filename, {
      frontmatter: { ...frontmatter, theme_stance: next },
      body,
    })
  }

  return (
    <div className="rounded bg-panel-3 border border-edge px-2 py-1.5">
      <button
        className="text-sm text-ink hover:text-accent transition-colors cursor-pointer"
        onClick={() => onOpen(filename)}
        title="Open profile"
      >
        {frontmatter.name || filename}
      </button>
      {editing ? (
        <input
          className="input mt-1"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              cancelledRef.current = true
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          className="block w-full text-left text-xs text-ink-dim italic hover:text-ink
            transition-colors cursor-text"
          onClick={start}
          title="Click to edit theme_stance (saves to the character note)"
        >
          {stance || 'no stance yet — click to set'}
        </button>
      )}
    </div>
  )
}

export default function ThemesPanel({ characters, config, saveConfig, saveCharacter, onOpen }) {
  const options = config?.options || {}
  const question = options.theme_question || DEFAULT_QUESTION
  const thesis = options.theme_thesis || DEFAULT_THESIS

  const [editingRoot, setEditingRoot] = useState(false)
  const [draftQuestion, setDraftQuestion] = useState('')
  const [draftThesis, setDraftThesis] = useState('')

  const startRootEdit = () => {
    setDraftQuestion(question)
    setDraftThesis(thesis)
    setEditingRoot(true)
  }

  const saveRoot = async () => {
    await saveConfig({
      ...config,
      options: {
        ...options,
        theme_question: draftQuestion.trim() || DEFAULT_QUESTION,
        theme_thesis: draftThesis.trim() || DEFAULT_THESIS,
      },
    })
    setEditingRoot(false)
  }

  const buckets = useMemo(() => {
    const b = { for: [], complicated: [], against: [] }
    for (const ch of characters) {
      b[stanceBranch(ch.frontmatter?.theme_stance, options.theme_keywords)].push(ch)
    }
    return b
  }, [characters, options.theme_keywords])

  return (
    <section className="card flex flex-col min-w-0">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-edge">
        <h2 className="text-sm font-semibold text-ink">Themes</h2>
        <span className="text-xs text-ink-faint">bucketed by each note's theme_stance</span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="rounded-md bg-panel-3/60 border border-edge px-3 py-2.5">
          {editingRoot ? (
            <div className="flex flex-col gap-2">
              <div>
                <label className="label" htmlFor="theme-question">Controlling question</label>
                <textarea
                  id="theme-question"
                  className="input resize-none"
                  rows={2}
                  value={draftQuestion}
                  onChange={(e) => setDraftQuestion(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="theme-thesis">Thesis</label>
                <textarea
                  id="theme-thesis"
                  className="input resize-none"
                  rows={2}
                  value={draftThesis}
                  onChange={(e) => setDraftThesis(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button className="btn btn-accent" onClick={saveRoot}>Save</button>
                <button className="btn" onClick={() => setEditingRoot(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <p
                  className="text-sm text-accent leading-snug"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {question}
                </p>
                <p className="text-xs text-ink-dim italic mt-1.5 leading-relaxed">{thesis}</p>
              </div>
              <button
                className="btn ml-auto shrink-0 text-xs px-2 py-1"
                onClick={startRootEdit}
                title="Edit the controlling question and thesis (saved to writers-panel-config.json)"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-center" aria-hidden="true">
          <div className="w-px h-3 bg-edge" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {THEME_BRANCHES.map((branch) => (
            <div
              key={branch.id}
              className="rounded-md border border-edge bg-panel/60 p-2 border-t-2 min-w-0"
              style={{ borderTopColor: branch.color }}
            >
              <div
                className="text-[11px] uppercase tracking-wider mb-2"
                style={{ color: branch.color }}
              >
                {branch.label}
              </div>
              <div className="flex flex-col gap-1.5">
                {buckets[branch.id].length === 0 && (
                  <div className="text-xs text-ink-faint italic">no one yet</div>
                )}
                {buckets[branch.id].map((ch) => (
                  <StanceChip
                    key={ch.filename}
                    character={ch}
                    onOpen={onOpen}
                    saveCharacter={saveCharacter}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
