/*
 * Obsidian-compatible Markdown notes: YAML frontmatter + free-form body.
 *
 * Character frontmatter schema (spec §6):
 *   name: Det. Raymond "Ray" Vega
 *   role: Protagonist ...
 *   relationships:            # "Target Name :: label" — optionally "(hidden)"
 *     - Jack Brennan :: partner
 *     - Dana Vega :: secret affair (hidden)
 *   theme_stance: Bears truth's cost
 *   arc_begin: ...
 *   arc_end: ...
 *
 * Relationship strings stay plain so they read/edit naturally as Obsidian
 * list properties; "(hidden)" marks in-story secret edges (drawn dashed).
 */
import yaml from 'js-yaml'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseNote(text) {
  const match = FM_RE.exec(text || '')
  if (!match) return { frontmatter: {}, body: text || '' }
  let frontmatter = {}
  try {
    frontmatter = yaml.load(match[1]) || {}
    if (typeof frontmatter !== 'object' || Array.isArray(frontmatter)) frontmatter = {}
  } catch {
    // Bad YAML: keep the body, surface an empty frontmatter rather than crash
    frontmatter = {}
  }
  return { frontmatter, body: text.slice(match[0].length) }
}

export function serializeNote({ frontmatter, body }) {
  const fm = yaml.dump(frontmatter ?? {}, { lineWidth: -1, quotingType: '"' }).trimEnd()
  return `---\n${fm}\n---\n\n${(body ?? '').replace(/^\n+/, '')}`
}

/** "Jack Brennan :: partner (hidden)" -> { target, label, hidden } */
export function parseRelationship(entry) {
  const raw = String(entry ?? '').trim()
  if (!raw) return null
  const idx = raw.indexOf('::')
  let target = idx >= 0 ? raw.slice(0, idx).trim() : raw
  let label = idx >= 0 ? raw.slice(idx + 2).trim() : ''
  let hidden = false
  if (/\(hidden\)\s*$/i.test(label)) {
    hidden = true
    label = label.replace(/\(hidden\)\s*$/i, '').trim()
  }
  return { target, label, hidden }
}

export function parseRelationships(list) {
  if (!Array.isArray(list)) return []
  return list.map(parseRelationship).filter(Boolean)
}

export function serializeRelationship({ target, label, hidden }) {
  let out = target
  if (label) out += ` :: ${label}`
  if (hidden) out += ' (hidden)'
  return out
}

/** "Det. Raymond \"Ray\" Vega" -> "det-raymond-ray-vega" (used for filenames) */
export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled'
}

/** Render markdown to sanitized HTML for display. */
export function renderMarkdown(md) {
  const html = marked.parse(md ?? '', { async: false, gfm: true, breaks: true })
  return DOMPurify.sanitize(html)
}
