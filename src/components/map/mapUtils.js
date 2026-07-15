/*
 * Setting Map helpers — category palette, tile layer definitions, GeoJSON
 * accessors, distance math, and the draft <-> Feature conversions the
 * editor uses. Pure functions only; no Leaflet or React in here.
 */
import { slugify } from '../../lib/markdown.js'

export const CATEGORIES = ['case', 'city', 'police', 'commercial', 'nature', 'institution']

// Color roles per docs/CONTRACT.md: case=rust, police=accent, nature=sage,
// city/commercial=teal, institution=violet-ish (no theme token — inline hex).
export const CATEGORY_COLORS = {
  case: '#b5533c',
  police: '#d9a441',
  nature: '#7d9471',
  city: '#4fa3a5',
  commercial: '#4fa3a5',
  institution: '#8a7ab5',
}

// Small glyph inside each pin so categories stay tellable apart without color.
export const CATEGORY_GLYPHS = {
  case: '✕',
  police: '▲',
  city: '■',
  commercial: '◆',
  nature: '✽',
  institution: '✦',
}

export function categoryColor(category) {
  return CATEGORY_COLORS[category] || '#8b919c'
}

export const TILE_LAYERS = [
  {
    name: 'Satellite', // default base layer
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  },
  {
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 17,
      attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
    },
  },
  {
    name: 'Street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
]

export function isPin(f) {
  return f?.properties?.role === 'pin' && f?.geometry?.type === 'Point'
}

export function isRegion(f) {
  return f?.properties?.role === 'region' && f?.geometry?.type === 'Point'
}

export function featureId(f) {
  return f?.properties?.id || f?.properties?.name || ''
}

export function featureLatLng(f) {
  const [lng, lat] = f.geometry.coordinates
  return { lat, lng }
}

/** Great-circle distance in km (haversine) between two {lat, lng} points. */
export function distanceKm(a, b) {
  const R = 6371
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/**
 * Region features whose minZoom/maxZoom band contains `zoom` AND whose
 * center lies within radiusKm of the map center (spec §5-①: zoom-aware
 * regional info). A region without radiusKm applies everywhere in its band.
 */
export function matchingRegions(features, center, zoom) {
  return features.filter(isRegion).filter((f) => {
    const p = f.properties
    if (zoom < (p.minZoom ?? 0) || zoom > (p.maxZoom ?? 22)) return false
    const radius = Number(p.radiusKm)
    if (!Number.isFinite(radius)) return true
    return distanceKm(center, featureLatLng(f)) <= radius
  })
}

/** Editable working copy of a feature — or a fresh pin at `latlng` when feature is null. */
export function draftFromFeature(feature, latlng) {
  if (!feature) {
    return {
      sourceFeature: null,
      isNew: true,
      role: 'pin',
      id: '',
      name: '',
      category: 'case',
      summary: '',
      detail: '',
      fields: [],
      lat: latlng.lat,
      lng: latlng.lng,
      minZoom: '',
      maxZoom: '',
      radiusKm: '',
    }
  }
  const p = feature.properties || {}
  const { lat, lng } = featureLatLng(feature)
  return {
    sourceFeature: feature,
    isNew: false,
    role: p.role || 'pin',
    id: p.id || '',
    name: p.name || '',
    category: p.category || 'case',
    summary: p.summary || '',
    detail: p.detail || '',
    fields: (p.fields || []).map((f) => ({
      label: f.label || '',
      value: f.value || '',
      estimate: !!f.estimate,
    })),
    lat,
    lng,
    minZoom: p.minZoom ?? '',
    maxZoom: p.maxZoom ?? '',
    radiusKm: p.radiusKm ?? '',
  }
}

/**
 * Turn a draft back into a GeoJSON Feature, preserving any properties the
 * editor doesn't know about. `existingIds` is used to mint a unique id for
 * brand-new pins (slug of the name, suffixed if taken).
 */
export function featureFromDraft(draft, existingIds) {
  let id = draft.id
  if (!id) {
    const base = slugify(draft.name || 'location')
    id = base
    let n = 2
    while (existingIds.has(id)) {
      id = `${base}-${n}`
      n += 1
    }
  }
  const properties = {
    ...(draft.sourceFeature?.properties || {}),
    id,
    name: draft.name.trim() || 'Untitled location',
    category: draft.category,
    role: draft.role,
    summary: draft.summary,
    detail: draft.detail,
    fields: draft.fields
      .filter((f) => f.label.trim() || f.value.trim())
      .map((f) => ({ label: f.label, value: f.value, estimate: !!f.estimate })),
  }
  if (draft.role === 'region') {
    const toNum = (v, fallback) => {
      const n = Number(v)
      return v === '' || v == null || Number.isNaN(n) ? fallback : n
    }
    properties.minZoom = toNum(draft.minZoom, 0)
    properties.maxZoom = toNum(draft.maxZoom, 22)
    const radius = toNum(draft.radiusKm, null)
    if (radius == null) delete properties.radiusKm
    else properties.radiusKm = radius
  }
  return {
    ...(draft.sourceFeature || {}),
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [draft.lng, draft.lat] },
    properties,
  }
}
