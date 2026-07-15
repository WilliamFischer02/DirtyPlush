/*
 * UIContext — cross-tab navigation.
 * Clicking a character node/name anywhere routes to the Profile tab with
 * that character selected (spec §5-③/④).
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export const TABS = [
  { id: 'map', label: 'Setting Map' },
  { id: 'timeline', label: 'Timeline & Structure' },
  { id: 'characters', label: 'Characters & Themes' },
  { id: 'profile', label: 'Profile' },
  { id: 'resources', label: 'Resources' },
]

const UIContext = createContext(null)

export function UIProvider({ children }) {
  const [activeTab, setActiveTab] = useState('map')
  // filename of the character shown in the Profile tab
  const [profileCharacter, setProfileCharacter] = useState(null)
  // One-shot deep links, set by the command palette and consumed (then
  // cleared) by the target tab when it mounts or updates:
  const [pendingEvent, setPendingEvent] = useState(null) // event id → Timeline opens its overlay
  const [pendingLocation, setPendingLocation] = useState(null) // pin id → Map selects & pans

  /** Open a character's profile by filename or by frontmatter name. */
  const openProfile = useCallback((filenameOrName, characters) => {
    let filename = filenameOrName
    if (characters && !String(filenameOrName).endsWith('.md')) {
      const wanted = String(filenameOrName).toLowerCase()
      const found = characters.find(
        (c) => (c.frontmatter.name || '').toLowerCase() === wanted,
      )
      filename = found ? found.filename : null
    }
    if (filename) {
      setProfileCharacter(filename)
      setActiveTab('profile')
    }
  }, [])

  const openEvent = useCallback((id) => {
    setPendingEvent(id)
    setActiveTab('timeline')
  }, [])

  const openLocation = useCallback((id) => {
    setPendingLocation(id)
    setActiveTab('map')
  }, [])

  const value = useMemo(
    () => ({
      activeTab, setActiveTab, profileCharacter, setProfileCharacter, openProfile,
      pendingEvent, setPendingEvent, openEvent,
      pendingLocation, setPendingLocation, openLocation,
    }),
    [activeTab, profileCharacter, openProfile,
      pendingEvent, openEvent, pendingLocation, openLocation],
  )
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>')
  return ctx
}
