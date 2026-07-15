/*
 * WikiProse — rendered markdown with live Obsidian [[wikilinks]].
 * Renders through renderMarkdown (which expands [[Name]] into
 * [data-wikilink] spans) and delegates click/Enter on those spans to the
 * Profile tab when the name matches a character. Unmatched names get a
 * quiet toast instead of failing silently.
 */
import { useCallback } from 'react'
import { renderMarkdown } from '../lib/markdown.js'
import { useVault } from '../state/VaultContext.jsx'
import { useUI } from '../state/UIContext.jsx'
import { useToast } from '../state/UXContext.jsx'

export default function WikiProse({ markdown, className = '' }) {
  const { characters } = useVault()
  const { openProfile } = useUI()
  const toast = useToast()

  const activate = useCallback((target) => {
    const name = target.trim()
    const found = characters.some(
      (c) => (c.frontmatter.name || '').toLowerCase() === name.toLowerCase(),
    )
    if (found) openProfile(name, characters)
    else toast(`No character note named "${name}" yet`)
  }, [characters, openProfile, toast])

  const onClick = (e) => {
    const el = e.target instanceof Element ? e.target.closest('[data-wikilink]') : null
    if (el) activate(el.dataset.wikilink || '')
  }

  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return
    const el = e.target instanceof Element ? e.target.closest('[data-wikilink]') : null
    if (el) activate(el.dataset.wikilink || '')
  }

  return (
    <div
      className={`prose-noir ${className}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
    />
  )
}
