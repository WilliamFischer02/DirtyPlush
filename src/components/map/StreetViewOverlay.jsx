/*
 * Street View overlay — key-gated (config.google_maps_api_key). Loads the
 * Maps JS API on demand, looks up the nearest panorama to the pin, and
 * shows it over the whole tab. Every failure mode (script blocked, key
 * rejected, no imagery nearby) degrades to a short in-UI message.
 */
import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps, onAuthFailure } from './googleMaps.js'

export default function StreetViewOverlay({ apiKey, name, lat, lng, onClose }) {
  const panoRef = useRef(null)
  const [phase, setPhase] = useState('loading') // 'loading' | 'ready' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const fail = (msg) => {
      if (!cancelled) {
        setPhase('error')
        setMessage(msg)
      }
    }
    onAuthFailure(() => fail('Google rejected this API key — double-check it in Resources → Settings.'))
    ;(async () => {
      try {
        const maps = await loadGoogleMaps(apiKey)
        if (cancelled || !panoRef.current) return
        const service = new maps.StreetViewService()
        const panoId = await new Promise((resolve) => {
          service.getPanorama(
            { location: { lat, lng }, radius: 300, preference: 'nearest' },
            (data, status) => resolve(status === 'OK' ? data?.location?.pano : null),
          )
        })
        if (cancelled || !panoRef.current) return
        if (!panoId) {
          fail('No Street View imagery within ~300 m of this pin — backcountry roads often have none.')
          return
        }
        const pano = new maps.StreetViewPanorama(panoRef.current, {
          pano: panoId,
          pov: { heading: 0, pitch: 0 },
          zoom: 0,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
        })
        pano.setVisible(true)
        if (!cancelled) setPhase('ready')
      } catch (err) {
        fail(err?.message || 'Street View could not be loaded.')
      }
    })()
    return () => {
      cancelled = true
      onAuthFailure(null)
    }
  }, [apiKey, lat, lng])

  return (
    <div className="absolute inset-0 z-[1200] bg-night flex flex-col">
      <header className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-edge bg-panel">
        <span className="text-[11px] uppercase tracking-wider text-ink-faint">Street View</span>
        <span className="text-sm text-ink truncate">{name || 'Selected pin'}</span>
        <span className="hidden sm:inline text-xs text-ink-faint">
          present-day imagery — 1994 details remain estimates
        </span>
        <button className="btn ml-auto shrink-0" onClick={onClose}>Close</button>
      </header>
      <div className="relative flex-1 min-h-0">
        <div ref={panoRef} className="absolute inset-0" />
        {phase !== 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center bg-night">
            <p className="max-w-sm px-6 text-center text-sm text-ink-dim">
              {phase === 'loading' ? 'Loading Street View…' : message}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
