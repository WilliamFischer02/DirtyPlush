/*
 * Seed data = the files in /vault-sample at the repo root, bundled as raw
 * text at build time. That folder is the single authoring point for starter
 * content: what ships in git is exactly what gets written into an empty
 * vault (or the browser-storage fallback) on first run.
 */
const modules = import.meta.glob('../../vault-sample/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** { 'characters/ray-vega.md': '...', 'timeline/events.json': '...', ... } */
export const SEED_FILES = Object.fromEntries(
  Object.entries(modules).map(([path, content]) => [
    path.replace(/^\.\.\/\.\.\/vault-sample\//, ''),
    content,
  ]),
)

/** Paths from SEED_FILES that are missing in the backend. */
export async function findMissingSeedFiles(backend) {
  const missing = []
  for (const path of Object.keys(SEED_FILES)) {
    if ((await backend.readFile(path)) == null) missing.push(path)
  }
  return missing
}

/** Write the given seed paths into the backend (never overwrites existing). */
export async function writeSeedFiles(backend, paths) {
  for (const path of paths) {
    await backend.writeFile(path, SEED_FILES[path])
  }
}
