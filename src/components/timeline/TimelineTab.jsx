/*
 * Tab ② — Timeline & Structure (spec §5-②).
 * Top: a vis-timeline over timeline/events.json with two groups (the 1994
 * case and the 2024 interrogation frame), fully editable — add via button
 * or double-click, drag to move/resize, × to delete — plus window preset
 * buttons and free zoom/pan. Clicking an item (or a beat chip below) opens
 * the full-screen event overlay. Bottom: the structure-arc panel over
 * structure/beats.json.
 *
 * Lifecycle: the Timeline instance is created once on mount and destroyed
 * on unmount; the DataSet is diffed against the events state so edits
 * (including every overlay keystroke-then-save) never recreate the widget.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DataSet, Timeline } from 'vis-timeline/standalone'
import 'vis-timeline/styles/vis-timeline-graph2d.min.css'
import { useVault } from '../../state/VaultContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { useConfirm } from '../../state/UXContext.jsx'
import {
  buildGroups, eventsToItems, makeEventId, nearestGroup, presetRange, toISODate,
} from './timelineUtils.js'
import EventOverlay from './EventOverlay.jsx'
import StructurePanel from './StructurePanel.jsx'

const DAY = 1000 * 60 * 60 * 24

// Local restyles for vis DOM this tab owns (tooltip bubble ships light-themed)
const TIMELINE_CSS = `
.vis-tooltip {
  background: var(--color-panel-3) !important;
  color: var(--color-ink) !important;
  border: 1px solid var(--color-edge) !important;
  border-radius: 6px !important;
  font-family: var(--font-sans) !important;
  font-size: 12px !important;
  padding: 4px 8px !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.55);
  max-width: 340px;
  white-space: normal !important;
}
.vis-item .vis-item-content { padding: 3px 7px; }
`

export default function TimelineTab() {
  const { events, saveEvents, beats, saveBeats } = useVault()
  const { pendingEvent, setPendingEvent } = useUI()
  const confirmDialog = useConfirm()

  const containerRef = useRef(null)
  const timelineRef = useRef(null)
  const itemsRef = useRef(null)
  const groupsRef = useRef(null)

  // Latest collections for the one-time vis callbacks
  const eventsRef = useRef(events)
  eventsRef.current = events

  // null | { id } (existing event) | { seed: { start, group } } (new draft)
  const [overlay, setOverlay] = useState(null)
  // Quick filter: substring over title + summary; hides non-matching items
  const [filter, setFilter] = useState('')

  // Deep link from the command palette: open the requested event's overlay
  useEffect(() => {
    if (!pendingEvent) return
    if (events.some((e) => e.id === pendingEvent)) setOverlay({ id: pendingEvent })
    setPendingEvent(null)
  }, [pendingEvent, events, setPendingEvent])

  /* ---------- persistence callbacks used by the vis instance ---------- */

  const persistMove = useCallback(async (item) => {
    const next = eventsRef.current.map((e) => {
      if (e.id !== item.id) return e
      const updated = { ...e, start: toISODate(item.start) }
      if (item.end != null) updated.end = toISODate(item.end)
      else delete updated.end
      return updated
    })
    await saveEvents(next)
  }, [saveEvents])

  const removeViaTimeline = useCallback(async (item, callback) => {
    const evt = eventsRef.current.find((e) => e.id === item.id)
    const name = evt?.title || 'this event'
    const ok = await confirmDialog({
      title: `Delete "${name}"?`,
      body: 'This removes the event from timeline/events.json.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) {
      callback(item)
      saveEvents(eventsRef.current.filter((e) => e.id !== item.id))
    } else {
      callback(null)
    }
  }, [saveEvents, confirmDialog])

  /* ---------- timeline lifecycle (create once, destroy on unmount) ---------- */

  useEffect(() => {
    const items = new DataSet(eventsToItems(eventsRef.current))
    const groups = new DataSet(buildGroups(eventsRef.current))
    itemsRef.current = items
    groupsRef.current = groups

    const initial = presetRange(eventsRef.current, 'case-1994')
    const timeline = new Timeline(containerRef.current, items, groups, {
      height: '100%',
      verticalScroll: true,
      orientation: 'top',
      stack: true,
      start: initial.start,
      end: initial.end,
      zoomMin: 3 * DAY,          // free zoom/pan between these bounds
      zoomMax: 60 * 366 * DAY,
      margin: { item: { horizontal: 4, vertical: 8 } },
      groupOrder: 'order',
      selectable: true,
      showCurrentTime: false,
      itemsAlwaysDraggable: { item: true, range: true },
      // Keep vault dates day-precise: drags snap to local midnight
      snap: (date) => {
        const d = new Date(date.valueOf() + DAY / 2)
        d.setHours(0, 0, 0, 0)
        return d
      },
      editable: { add: true, updateTime: true, updateGroup: false, remove: true },
      onAdd: (item, callback) => {
        callback(null) // the overlay owns creation; nothing is added until Save
        setOverlay({
          seed: {
            start: toISODate(item.start),
            group: typeof item.group === 'string' && item.group
              ? item.group
              : nearestGroup(eventsRef.current, new Date(item.start)),
          },
        })
      },
      onMove: (item, callback) => {
        callback(item) // apply optimistically, then persist
        persistMove(item)
      },
      onRemove: removeViaTimeline,
    })
    timeline.on('click', (props) => {
      if (props.item != null) setOverlay({ id: props.item })
    })
    timelineRef.current = timeline

    return () => {
      timeline.destroy()
      timelineRef.current = null
      itemsRef.current = null
      groupsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- keep the DataSet in sync with events state + filter ---------- */

  const visibleEvents = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return events
    return events.filter((e) =>
      `${e.title || ''} ${e.summary || ''}`.toLowerCase().includes(q))
  }, [events, filter])

  useEffect(() => {
    const items = itemsRef.current
    const groups = groupsRef.current
    if (!items || !groups) return
    const nextGroups = buildGroups(events)
    const staleGroups = groups.getIds().filter((id) => !nextGroups.some((g) => g.id === id))
    if (staleGroups.length) groups.remove(staleGroups)
    groups.update(nextGroups)

    const nextItems = eventsToItems(visibleEvents)
    const keep = new Set(nextItems.map((i) => i.id))
    const stale = items.getIds().filter((id) => !keep.has(id))
    if (stale.length) items.remove(stale)
    items.update(nextItems)
  }, [events, visibleEvents])

  /* ---------- toolbar actions ---------- */

  const setPreset = useCallback((preset) => {
    const timeline = timelineRef.current
    if (!timeline) return
    const range = presetRange(eventsRef.current, preset)
    timeline.setWindow(range.start, range.end, {
      animation: { duration: 350, easingFunction: 'easeInOutQuad' },
    })
  }, [])

  const addEvent = useCallback(() => {
    const timeline = timelineRef.current
    let start = new Date()
    if (timeline) {
      const w = timeline.getWindow()
      start = new Date((w.start.valueOf() + w.end.valueOf()) / 2)
    }
    setOverlay({
      seed: { start: toISODate(start), group: nearestGroup(eventsRef.current, start) },
    })
  }, [])

  /* ---------- overlay persistence ---------- */

  const saveOverlayEvent = useCallback(async (evt) => {
    const list = eventsRef.current
    if (evt.id && list.some((e) => e.id === evt.id)) {
      await saveEvents(list.map((e) => (e.id === evt.id ? evt : e)))
    } else {
      const id = makeEventId(evt.title, list)
      await saveEvents([...list, { ...evt, id }])
    }
    setOverlay(null)
  }, [saveEvents])

  const deleteOverlayEvent = useCallback(async (id) => {
    const evt = eventsRef.current.find((e) => e.id === id)
    const name = evt?.title || 'this event'
    const ok = await confirmDialog({
      title: `Delete "${name}"?`,
      body: 'This removes the event from timeline/events.json.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    await saveEvents(eventsRef.current.filter((e) => e.id !== id))
    setOverlay(null)
  }, [saveEvents, confirmDialog])

  const assignEventToBeat = useCallback(async (eventId, beatId) => {
    await saveEvents(eventsRef.current.map((e) => (
      e.id === eventId ? { ...e, beat: beatId } : e
    )))
  }, [saveEvents])

  const openEvent = useCallback((id) => setOverlay({ id }), [])

  const overlayEvent = overlay?.id ? events.find((e) => e.id === overlay.id) : null

  /* ---------- render ---------- */

  return (
    <div className="h-full flex flex-col">
      <style>{TIMELINE_CSS}</style>

      {/* toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-edge bg-panel">
        <button className="btn btn-accent" onClick={addEvent} title="Add a new event at the center of the current view">
          + Add event
        </button>
        <div className="w-px h-5 bg-edge mx-1" />
        <span className="text-[11px] uppercase tracking-wider text-ink-faint">Window</span>
        <button className="btn" onClick={() => setPreset('case-1994')}>1994 Case</button>
        <button className="btn" onClick={() => setPreset('frame-2024')}>2024 Frame</button>
        <button className="btn" onClick={() => setPreset('all')}>All</button>
        <div className="w-px h-5 bg-edge mx-1" />
        <div className="relative">
          <input
            className="input !w-52 !py-1"
            placeholder="Filter events…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer"
              title="Clear the filter"
              onClick={() => setFilter('')}
            >
              ×
            </button>
          )}
        </div>
        {filter && (
          <span className="text-[11px] text-ink-faint">
            {visibleEvents.length}/{events.length} shown
          </span>
        )}
        <span className="ml-auto hidden xl:block text-[11px] text-ink-faint">
          scroll to zoom · drag to pan · drag items to move/resize · double-click empty space to add · click an item for detail
        </span>
      </div>

      {/* the timeline itself. NOTE: vis-timeline force-sets inline
          position:relative on its container, which defeats absolute/inset
          sizing — the container must get its height from height:100%. */}
      <div className="shrink-0 basis-[52%] min-h-0 bg-panel">
        <div ref={containerRef} className="h-full" />
      </div>

      {/* structure-arc panel */}
      <StructurePanel
        beats={beats}
        events={events}
        saveBeats={saveBeats}
        onOpenEvent={openEvent}
        onAssign={assignEventToBeat}
      />

      {/* full-screen event detail */}
      {overlay && (overlay.seed || overlayEvent) && (
        <EventOverlay
          key={overlay.id || 'new'}
          event={overlayEvent}
          seed={overlay.seed}
          beats={beats}
          onSave={saveOverlayEvent}
          onDelete={deleteOverlayEvent}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  )
}
