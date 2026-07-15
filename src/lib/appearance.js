/*
 * Appearance customization — a handful of author-facing options persisted in
 * writers-panel-config.json under options.appearance, applied as CSS custom
 * properties on <html>. Everything defaults to the shipped noir look; the
 * config file stays human-editable:
 *
 *   "options": { "appearance": { "accent": "#d9a441", "font_scale": 1,
 *                 "default_tab": "map", "map_layer": "satellite" } }
 */

export const ACCENT_PRESETS = [
  { id: 'amber', label: 'Amber (cured grass)', value: '#d9a441' },
  { id: 'teal', label: 'Teal (present day)', value: '#4fa3a5' },
  { id: 'rust', label: 'Rust (the case)', value: '#c96a4f' },
  { id: 'sage', label: 'Sage (chaparral)', value: '#8ba872' },
  { id: 'violet', label: 'Violet (institution)', value: '#9a89c9' },
  { id: 'bone', label: 'Bone (plain)', value: '#c9c2b2' },
]

export const FONT_SCALES = [
  { id: 'compact', label: 'Compact', value: 0.92 },
  { id: 'normal', label: 'Normal', value: 1 },
  { id: 'relaxed', label: 'Relaxed', value: 1.08 },
]

export const MAP_LAYERS = [
  { id: 'satellite', label: 'Satellite' },
  { id: 'topo', label: 'Topographic' },
  { id: 'street', label: 'Street' },
]

export const DEFAULTS = {
  accent: '#d9a441',
  font_scale: 1,
  default_tab: 'map',
  map_layer: 'satellite',
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function getAppearance(config) {
  const a = config?.options?.appearance || {}
  return {
    accent: HEX_RE.test(String(a.accent || '')) ? a.accent : DEFAULTS.accent,
    font_scale: FONT_SCALES.some((f) => f.value === a.font_scale) ? a.font_scale : DEFAULTS.font_scale,
    default_tab: typeof a.default_tab === 'string' ? a.default_tab : DEFAULTS.default_tab,
    map_layer: MAP_LAYERS.some((l) => l.id === a.map_layer) ? a.map_layer : DEFAULTS.map_layer,
  }
}

/** #rrggbb → a darker companion used for borders/dim accents. */
function dimmed(hex) {
  const h = hex.length === 4
    ? '#' + [...hex.slice(1)].map((c) => c + c).join('')
    : hex
  const n = parseInt(h.slice(1), 16)
  const f = 0.62
  const r = Math.round(((n >> 16) & 255) * f)
  const g = Math.round(((n >> 8) & 255) * f)
  const b = Math.round((n & 255) * f)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Apply accent + font scale to the document. Cheap; call on config change. */
export function applyAppearance(appearance) {
  const root = document.documentElement
  root.style.setProperty('--color-accent', appearance.accent)
  root.style.setProperty('--color-accent-dim', dimmed(appearance.accent))
  root.style.fontSize = appearance.font_scale === 1 ? '' : `${appearance.font_scale * 100}%`
}
