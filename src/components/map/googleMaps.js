/*
 * Dynamic Google Maps JS API loader for Street View. The script is injected
 * exactly once, and only when a key exists AND the user actually opens
 * Street View — the app never phones Google keyless (contract hard rule #4).
 */
let loaderPromise = null

export function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.StreetViewPanorama) return Promise.resolve(window.google.maps)
  if (loaderPromise) return loaderPromise
  loaderPromise = new Promise((resolve, reject) => {
    const callbackName = '__dirtyPlushGmapsReady'
    window[callbackName] = () => {
      delete window[callbackName]
      if (window.google?.maps) resolve(window.google.maps)
      else reject(new Error('Google Maps loaded but its API is unavailable'))
    }
    const script = document.createElement('script')
    script.src = 'https://maps.googleapis.com/maps/api/js' +
      `?key=${encodeURIComponent(apiKey)}&v=weekly&callback=${callbackName}`
    script.async = true
    script.onerror = () => {
      delete window[callbackName]
      loaderPromise = null // allow a retry after a network hiccup
      reject(new Error('The Google Maps script could not be loaded (offline, or blocked)'))
    }
    document.head.appendChild(script)
  })
  return loaderPromise
}

/**
 * Google calls the global `gm_authFailure` when a key is rejected — this
 * happens after the script itself loads fine. Pass null to unhook.
 */
export function onAuthFailure(handler) {
  if (handler) window.gm_authFailure = handler
  else delete window.gm_authFailure
}
