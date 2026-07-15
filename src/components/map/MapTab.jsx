/*
 * Tab ① — Setting Map (spec §4/§5-①).
 * Full-tab Leaflet map over the vault's map/locations.geojson: satellite /
 * topographic / street base layers, category-colored pins, a zoom-aware
 * regional info panel, full pin editing (add via click-placement, move via
 * drag, delete with confirm), and key-gated Street View. The map instance
 * is created on mount and destroyed on unmount — tabs unmount when
 * inactive (docs/CONTRACT.md), so nothing may leak.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useVault } from '../../state/VaultContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { useConfirm, useToast } from '../../state/UXContext.jsx'
import { getAppearance } from '../../lib/appearance.js'
import {
  CATEGORY_GLYPHS, TILE_LAYERS, categoryColor, distanceKm, draftFromFeature,
  featureFromDraft, featureId, featureLatLng, isPin, matchingRegions,
} from './mapUtils.js'
import SidePanel from './SidePanel.jsx'
import StreetViewOverlay from './StreetViewOverlay.jsx'

// Geographic fallback only, used when the vault has no pins yet
// (inland North County San Diego). Never story logic.
const FALLBACK_CENTER = [33.19, -117.08]
const FALLBACK_ZOOM = 10

function pinIcon(category, selected) {
  const glyph = CATEGORY_GLYPHS[category] || '&bull;'
  // .dp-pin sits on an inner div: Leaflet positions the outer element with
  // an inline transform that would override the pin's rotate(-45deg).
  return L.divIcon({
    className: '',
    html:
      `<div class="dp-pin${selected ? ' selected' : ''}" style="background:${categoryColor(category)}">` +
      `<span style="color:rgba(13,15,18,0.85)">${glyph}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 31], // the rotated teardrop tip reaches ~5px below the box
  })
}

// appearance layer id → TILE_LAYERS display name
const LAYER_BY_ID = { satellite: 'Satellite', topo: 'Topographic', street: 'Street' }

export default function MapTab() {
  const { locations, saveLocations, config, saveConfig } = useVault()
  const { pendingLocation, setPendingLocation } = useUI()
  const confirmDialog = useConfirm()
  const toast = useToast()
  const apiKey = (config?.google_maps_api_key || '').trim()

  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerLayerRef = useRef(null)

  const [view, setView] = useState(null) // { center, zoom, bounds } mirrored from the live map
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('view') // 'view' | 'place' | 'edit'
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [streetViewPin, setStreetViewPin] = useState(null)

  const features = locations?.features || []
  const pins = useMemo(() => features.filter(isPin), [features])

  // Refs so the one-time map listeners read current values without rebinding
  const modeRef = useRef(mode)
  modeRef.current = mode
  const pinsRef = useRef(pins)
  pinsRef.current = pins
  const configRef = useRef(config)
  configRef.current = config
  const saveConfigRef = useRef(saveConfig)
  saveConfigRef.current = saveConfig

  // Home view: author-saved center/zoom in config.options.map_home
  const goHome = useCallback(() => {
    const map = mapRef.current
    const home = configRef.current?.options?.map_home
    if (!map) return
    if (home && Number.isFinite(home.lat) && Number.isFinite(home.lng) && Number.isFinite(home.zoom)) {
      map.flyTo([home.lat, home.lng], home.zoom, { duration: 0.6 })
    } else if (pinsRef.current.length > 0) {
      map.fitBounds(L.latLngBounds(pinsRef.current.map((f) => featureLatLng(f))), {
        padding: [48, 48], maxZoom: 13,
      })
    }
  }, [])

  const setHome = useCallback(async () => {
    const map = mapRef.current
    if (!map) return
    const c = map.getCenter()
    const cfg = configRef.current || {}
    await saveConfigRef.current({
      ...cfg,
      options: {
        ...(cfg.options || {}),
        map_home: {
          lat: Number(c.lat.toFixed(5)),
          lng: Number(c.lng.toFixed(5)),
          zoom: map.getZoom(),
        },
      },
    })
    toast('Saved this view as the map home', 'success')
  }, [toast])
  const goHomeRef = useRef(goHome)
  goHomeRef.current = goHome
  const setHomeRef = useRef(setHome)
  setHomeRef.current = setHome

  // Deep link from the command palette: select the pin and fly to it
  useEffect(() => {
    if (!pendingLocation || !mapRef.current) return
    const feature = pins.find((f) => featureId(f) === pendingLocation)
    if (feature) {
      setSelectedId(pendingLocation)
      setMode('view')
      const z = Math.max(mapRef.current.getZoom(), 13)
      mapRef.current.flyTo(featureLatLng(feature), z, { duration: 0.6 })
    }
    setPendingLocation(null)
  }, [pendingLocation, pins, setPendingLocation])

  /* ---------- map lifecycle ---------- */

  useEffect(() => {
    const map = L.map(containerRef.current, { zoomControl: true })
    mapRef.current = map

    const baseLayers = {}
    for (const t of TILE_LAYERS) baseLayers[t.name] = L.tileLayer(t.url, t.options)
    // Author-configurable default layer (Resources → Settings → Appearance)
    const defaultLayerName = LAYER_BY_ID[getAppearance(configRef.current).map_layer] || 'Satellite'
    ;(baseLayers[defaultLayerName] || baseLayers.Satellite).addTo(map)
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map)

    // Home-view control under the zoom buttons: ⌂ go home, ◎ save home
    const homeControl = L.control({ position: 'topleft' })
    homeControl.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-bar')
      const go = L.DomUtil.create('a', '', div)
      go.href = '#'
      go.innerHTML = '⌂'
      go.title = 'Go to the saved home view (falls back to fitting all pins)'
      const set = L.DomUtil.create('a', '', div)
      set.href = '#'
      set.innerHTML = '◎'
      set.title = 'Save the current view as home (persists to the vault config)'
      L.DomEvent.on(go, 'click', (e) => { L.DomEvent.stop(e); goHomeRef.current() })
      L.DomEvent.on(set, 'click', (e) => { L.DomEvent.stop(e); setHomeRef.current() })
      L.DomEvent.disableClickPropagation(div)
      return div
    }
    homeControl.addTo(map)

    markerLayerRef.current = L.layerGroup().addTo(map)

    // Initial view: saved home first, then fit-to-pins, then the fallback
    const home = configRef.current?.options?.map_home
    const startPins = pinsRef.current
    if (home && Number.isFinite(home.lat) && Number.isFinite(home.lng) && Number.isFinite(home.zoom)) {
      map.setView([home.lat, home.lng], home.zoom)
    } else if (startPins.length > 0) {
      map.fitBounds(L.latLngBounds(startPins.map((f) => featureLatLng(f))), {
        padding: [48, 48],
        maxZoom: 13,
      })
    } else {
      map.setView(FALLBACK_CENTER, FALLBACK_ZOOM)
    }

    const syncView = () => {
      setView({ center: map.getCenter(), zoom: map.getZoom(), bounds: map.getBounds() })
    }
    syncView()
    map.on('moveend zoomend', syncView)

    map.on('click', (e) => {
      if (modeRef.current === 'place') {
        setDraft(draftFromFeature(null, e.latlng))
        setSelectedId(null)
        setMode('edit')
      } else if (modeRef.current === 'view') {
        setSelectedId(null) // click on empty map deselects
      }
    })

    // Keep tiles laid out correctly when the tab or window resizes
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      map.off()
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
    }
  }, [])

  /* ---------- markers ---------- */

  const editingSource = mode === 'edit' && draft ? draft.sourceFeature : null

  useEffect(() => {
    const layer = markerLayerRef.current
    if (!layer) return
    layer.clearLayers()

    for (const f of pins) {
      if (editingSource && f === editingSource) continue // drawn as the draggable draft below
      const id = featureId(f)
      const marker = L.marker(featureLatLng(f), {
        icon: pinIcon(f.properties?.category, mode === 'view' && id === selectedId),
        title: f.properties?.name || id,
        interactive: mode === 'view',
        keyboard: mode === 'view',
      })
      marker.on('click', () => setSelectedId(id))
      layer.addLayer(marker)
    }

    if (mode === 'edit' && draft?.role === 'pin') {
      const marker = L.marker([draft.lat, draft.lng], {
        icon: pinIcon(draft.category, true),
        title: draft.name || 'New pin',
        draggable: true,
        zIndexOffset: 1000,
      })
      marker.on('dragend', () => {
        const ll = marker.getLatLng()
        setDraft((d) => (d ? { ...d, lat: ll.lat, lng: ll.lng } : d))
      })
      layer.addLayer(marker)
    }
  }, [pins, selectedId, mode, editingSource, draft?.role, draft?.lat, draft?.lng, draft?.category])

  // Crosshair cursor while placing a new pin
  useEffect(() => {
    const map = mapRef.current
    if (map) map.getContainer().style.cursor = mode === 'place' ? 'crosshair' : ''
  }, [mode])

  // Esc cancels placement (never edit — typed work must not vanish)
  useEffect(() => {
    if (mode !== 'place') return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setMode('view')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  /* ---------- derived view data ---------- */

  const selectedPin = useMemo(
    () => pins.find((f) => featureId(f) === selectedId) || null,
    [pins, selectedId],
  )

  const regions = useMemo(
    () => (view ? matchingRegions(features, view.center, view.zoom) : []),
    [features, view],
  )

  const pinsInView = useMemo(() => {
    if (!view) return []
    return pins
      .filter((f) => view.bounds.contains(featureLatLng(f)))
      .sort((a, b) => distanceKm(view.center, featureLatLng(a)) - distanceKm(view.center, featureLatLng(b)))
  }, [pins, view])

  /* ---------- actions ---------- */

  const selectAndPan = useCallback((feature) => {
    setSelectedId(featureId(feature))
    mapRef.current?.panTo(featureLatLng(feature))
  }, [])

  const startPlacement = useCallback(() => {
    setSelectedId(null)
    setDraft(null)
    setMode('place')
  }, [])

  const startEdit = useCallback((feature) => {
    setDraft(draftFromFeature(feature))
    setSelectedId(feature.properties?.role === 'pin' ? featureId(feature) : null)
    setMode('edit')
  }, [])

  const cancelEdit = useCallback(() => {
    setDraft(null)
    setMode('view')
  }, [])

  const saveDraft = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    try {
      const ids = new Set(features.map((f) => featureId(f)).filter(Boolean))
      const nextFeature = featureFromDraft(draft, ids)
      let replaced = false
      const nextFeatures = features.map((f) => {
        const match = f === draft.sourceFeature || (!draft.isNew && draft.id && featureId(f) === draft.id)
        if (!replaced && match) {
          replaced = true
          return nextFeature
        }
        return f
      })
      if (!replaced) nextFeatures.push(nextFeature)
      await saveLocations({ ...locations, type: 'FeatureCollection', features: nextFeatures })
      setSelectedId(nextFeature.properties.role === 'pin' ? nextFeature.properties.id : null)
      setDraft(null)
      setMode('view')
    } finally {
      setSaving(false)
    }
  }, [draft, features, locations, saveLocations])

  const deleteFeature = useCallback(async (feature) => {
    const name = feature.properties?.name || 'this location'
    const ok = await confirmDialog({
      title: `Delete "${name}"?`,
      body: 'This removes the location from map/locations.geojson.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    await saveLocations({
      ...locations,
      type: 'FeatureCollection',
      features: features.filter((f) => f !== feature),
    })
    setSelectedId((id) => (id === featureId(feature) ? null : id))
  }, [features, locations, saveLocations, confirmDialog])

  const fitToPins = useCallback(() => {
    const map = mapRef.current
    if (!map || pinsRef.current.length === 0) return
    map.fitBounds(L.latLngBounds(pinsRef.current.map((f) => featureLatLng(f))), {
      padding: [48, 48],
      maxZoom: 13,
    })
  }, [])

  /* ---------- render ---------- */

  return (
    <div className="relative h-full flex">
      <div className="relative flex-1 min-w-0">
        <div ref={containerRef} className="absolute inset-0" />
        {mode === 'place' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1100] card px-3 py-1.5 flex items-center gap-3 text-sm shadow-lg">
            <span className="text-ink">Click the map to place the new pin</span>
            <button className="btn" onClick={() => setMode('view')}>Cancel</button>
          </div>
        )}
      </div>

      <SidePanel
        view={view}
        regions={regions}
        pinsInView={pinsInView}
        pinCount={pins.length}
        selectedPin={selectedPin}
        mode={mode}
        draft={draft}
        setDraft={setDraft}
        apiKey={apiKey}
        saving={saving}
        onSelectPin={selectAndPan}
        onAddPin={startPlacement}
        onEdit={startEdit}
        onDelete={deleteFeature}
        onSave={saveDraft}
        onCancel={cancelEdit}
        onStreetView={setStreetViewPin}
        onDeselect={() => setSelectedId(null)}
        onFitPins={fitToPins}
      />

      {streetViewPin && (
        <StreetViewOverlay
          apiKey={apiKey}
          name={streetViewPin.properties?.name}
          lat={featureLatLng(streetViewPin).lat}
          lng={featureLatLng(streetViewPin).lng}
          onClose={() => setStreetViewPin(null)}
        />
      )}
    </div>
  )
}
