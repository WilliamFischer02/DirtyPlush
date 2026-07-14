/*
 * arcs.csv — character, arc_begin, arc_end (spec §6).
 * The Arcs panel is backed by this file; character frontmatter carries the
 * same fields and is used as a fallback when a character has no CSV row.
 */
import Papa from 'papaparse'

export function parseArcsCsv(text) {
  if (!text) return []
  const { data } = Papa.parse(text.trim(), { header: true, skipEmptyLines: true })
  return data
    .map((row) => ({
      character: (row.character || '').trim(),
      arc_begin: (row.arc_begin || '').trim(),
      arc_end: (row.arc_end || '').trim(),
    }))
    .filter((row) => row.character)
}

export function serializeArcsCsv(arcs) {
  return Papa.unparse(
    arcs.map(({ character, arc_begin, arc_end }) => ({ character, arc_begin, arc_end })),
    { columns: ['character', 'arc_begin', 'arc_end'] },
  ) + '\n'
}
