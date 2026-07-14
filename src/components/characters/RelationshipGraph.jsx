/*
 * Obsidian-style relationship web — react-force-graph-2d over the character
 * notes. Soft glowing nodes on the night background, labels under the nodes
 * that fade out as you zoom away, dashed edges for in-story secrets, small
 * dimmed ghost nodes for off-page concepts ('the Ring', 'Lover #1'…).
 * Clicking a character node routes to its Profile (useUI().openProfile via
 * the onOpen prop). The parent is measured with a ResizeObserver and the
 * graph gets explicit width/height (docs/CONTRACT.md).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { buildGraph, escapeHtml } from './characterUtils.js'

const LABEL_COLOR = '#aeb4bd'
const GHOST_LABEL_COLOR = '#6a707b'

export default function RelationshipGraph({ characters, onOpen }) {
  const wrapRef = useRef(null)
  const fgRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [coMentions, setCoMentions] = useState(false)
  const [hoverLink, setHoverLink] = useState(null)

  // Measure the parent and pass explicit width/height to the canvas
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Rebuild graph data when the vault changes; carry node positions over so
  // a stance edit or a toggled overlay doesn't scatter the layout.
  const prevNodesRef = useRef(new Map())
  const graphData = useMemo(() => {
    const data = buildGraph(characters, { coMentions })
    for (const n of data.nodes) {
      const old = prevNodesRef.current.get(n.id)
      if (old) {
        n.x = old.x
        n.y = old.y
        n.vx = old.vx
        n.vy = old.vy
      }
    }
    prevNodesRef.current = new Map(data.nodes.map((n) => [n.id, n]))
    return data
  }, [characters, coMentions])

  // Gentle physics — calm drift, not a mosh pit
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-140)
    fg.d3Force('link')?.distance((l) => (l.kind === 'comention' ? 90 : 60))
  }, [graphData])

  // Fit the web into view once the first simulation settles
  const didFitRef = useRef(false)
  const handleEngineStop = useCallback(() => {
    if (didFitRef.current) return
    didFitRef.current = true
    fgRef.current?.zoomToFit(400, 48)
  }, [])

  /* ---------- painting ---------- */

  const paintNode = useCallback((node, ctx, globalScale) => {
    const ghost = node.kind === 'ghost'
    const r = ghost ? 3 : 5
    if (!ghost) {
      ctx.shadowColor = node.color
      ctx.shadowBlur = 14
    }
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = node.color
    ctx.globalAlpha = ghost ? 0.6 : 1
    ctx.fill()
    ctx.shadowBlur = 0

    // label under the node, fading out as the camera pulls back
    const labelAlpha = Math.max(0, Math.min(1, (globalScale - 0.5) / 0.5))
    if (labelAlpha > 0.02) {
      const fontSize = 11 / globalScale
      ctx.font = `${ghost ? 'italic ' : ''}${fontSize}px "Inter", "Segoe UI", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = labelAlpha * (ghost ? 0.55 : 0.9)
      ctx.fillStyle = ghost ? GHOST_LABEL_COLOR : LABEL_COLOR
      ctx.fillText(node.name, node.x, node.y + r + 3 / globalScale)
    }
    ctx.globalAlpha = 1
  }, [])

  const paintPointerArea = useCallback((node, color, ctx) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x, node.y, node.kind === 'ghost' ? 6 : 9, 0, 2 * Math.PI)
    ctx.fill()
  }, [])

  const linkColor = useCallback((l) => {
    if (l === hoverLink) return 'rgba(217, 164, 65, 0.9)'
    if (l.kind === 'comention') return 'rgba(79, 163, 165, 0.30)'
    if (l.hidden) return 'rgba(139, 145, 156, 0.24)'
    return 'rgba(139, 145, 156, 0.45)'
  }, [hoverLink])

  const linkWidth = useCallback((l) => (l === hoverLink ? 2 : l.hidden ? 1 : 1.2), [hoverLink])

  const linkDash = useCallback(
    (l) => (l.hidden ? [4, 4] : l.kind === 'comention' ? [1.5, 4] : null),
    [],
  )

  /* ---------- tooltips (HTML — always escaped) ---------- */

  const linkTooltip = useCallback((l) => {
    const parts = []
    if (l.label) parts.push(escapeHtml(l.label))
    if (l.hidden) parts.push('<span style="opacity:.7">(hidden — in-story secret)</span>')
    return parts.join(' ') || 'relationship'
  }, [])

  const nodeTooltip = useCallback((n) => {
    if (n.kind === 'ghost') return `<i>${escapeHtml(n.name)}</i> — off-page / concept`
    return escapeHtml(n.role || n.name)
  }, [])

  /* ---------- interaction ---------- */

  const handleNodeClick = useCallback((node) => {
    if (node.kind === 'character') onOpen(node.id)
  }, [onOpen])

  // pointer cursor only over real character nodes — ghosts aren't clickable
  const showPointer = useCallback((obj) => !!obj && obj.kind === 'character', [])

  /* ---------- render ---------- */

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-edge">
        <h2 className="text-sm font-semibold text-ink">Relationship web</h2>
        <span className="text-[11px] text-ink-faint hidden lg:inline">
          dashed = hidden secret · dotted = co-mention · small grey = off-page concept
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-dim cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            className="accent-accent cursor-pointer"
            checked={coMentions}
            onChange={(e) => setCoMentions(e.target.checked)}
          />
          co-mention edges
        </label>
      </div>
      <div ref={wrapRef} className="relative flex-1 min-h-0 overflow-hidden bg-night">
        {characters.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-ink-dim">
            No character notes yet — add one on the right to start the web.
          </div>
        ) : (
          size.width > 0 && size.height > 0 && (
            <div className="absolute inset-0">
              <ForceGraph2D
                ref={fgRef}
                width={size.width}
                height={size.height}
                graphData={graphData}
                backgroundColor="rgba(0,0,0,0)"
                nodeRelSize={5}
                nodeCanvasObject={paintNode}
                nodePointerAreaPaint={paintPointerArea}
                nodeLabel={nodeTooltip}
                onNodeClick={handleNodeClick}
                showPointerCursor={showPointer}
                linkColor={linkColor}
                linkWidth={linkWidth}
                linkLineDash={linkDash}
                linkLabel={linkTooltip}
                onLinkHover={setHoverLink}
                linkHoverPrecision={6}
                d3VelocityDecay={0.35}
                warmupTicks={60}
                cooldownTicks={150}
                onEngineStop={handleEngineStop}
              />
            </div>
          )
        )}
      </div>
    </div>
  )
}
