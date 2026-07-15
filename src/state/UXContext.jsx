/*
 * UXContext — app-wide feedback primitives, replacing the browser's native
 * popups with quiet, theme-matched ones:
 *
 *   const toast = useToast()
 *   toast('Saved characters/ray-vega.md')            // info (default)
 *   toast('Imported 14 files', 'success')
 *   toast('Save failed', 'error', { sticky: true })  // stays until dismissed
 *
 *   const confirm = useConfirm()
 *   if (await confirm({ title: 'Delete "Ch. 2"?', body: '…', danger: true,
 *                       confirmLabel: 'Delete' })) { … }
 *
 *   const promptText = usePrompt()
 *   const name = await promptText({ title: 'New character', placeholder: '…' })
 *   // resolves to the trimmed string, or null on cancel
 *
 * Mounted OUTSIDE VaultProvider so the data layer itself can toast/confirm.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const UXContext = createContext(null)

const TOAST_MS = 3200
const TONE_STYLES = {
  info: 'border-edge text-ink',
  success: 'border-sage/50 text-sage',
  error: 'border-rust/60 text-rust',
}

let nextId = 1

export function UXProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null) // { title, body, confirmLabel, cancelLabel, danger, resolve }
  const timersRef = useRef(new Map())

  const dismissToast = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const toast = useCallback((message, tone = 'info', { sticky = false } = {}) => {
    const id = nextId++
    setToasts((ts) => [...ts.slice(-3), { id, message: String(message), tone }])
    if (!sticky) {
      timersRef.current.set(id, setTimeout(() => dismissToast(id), TOAST_MS))
    }
    return id
  }, [dismissToast])

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) clearTimeout(timer)
  }, [])

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setDialog({
      title: 'Are you sure?',
      body: '',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      danger: false,
      input: false,
      ...(typeof opts === 'string' ? { title: opts } : opts),
      resolve,
    })
  }), [])

  const promptText = useCallback((opts) => new Promise((resolve) => {
    setDialog({
      title: 'Enter a value',
      body: '',
      confirmLabel: 'OK',
      cancelLabel: 'Cancel',
      danger: false,
      placeholder: '',
      initialValue: '',
      ...(typeof opts === 'string' ? { title: opts } : opts),
      input: true,
      resolve,
    })
  }), [])

  const inputRef = useRef(null)

  const closeDialog = useCallback((answer) => {
    setDialog((d) => {
      if (d) {
        if (d.input) {
          d.resolve(answer ? (inputRef.current?.value ?? '').trim() || null : null)
        } else {
          d.resolve(answer)
        }
      }
      return null
    })
  }, [])

  // Esc cancels the dialog from anywhere; Enter confirms
  useEffect(() => {
    if (!dialog) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeDialog(false)
      if (e.key === 'Enter') closeDialog(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, closeDialog])

  const value = useMemo(() => ({ toast, confirm, promptText }), [toast, confirm, promptText])

  return (
    <UXContext.Provider value={value}>
      {children}

      {/* toast stack — bottom center, quiet */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-1.5 pointer-events-none">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className={
              'dp-toast pointer-events-auto max-w-[520px] truncate rounded-md border bg-panel-2/95 ' +
              'backdrop-blur px-3.5 py-2 text-sm shadow-xl cursor-pointer text-left ' +
              (TONE_STYLES[t.tone] || TONE_STYLES.info)
            }
            title="Dismiss"
          >
            {t.message}
          </button>
        ))}
      </div>

      {/* confirm dialog */}
      {dialog && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-night/70 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDialog(false)
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={dialog.title}
            className="dp-dialog card w-[min(440px,90vw)] shadow-2xl p-4"
          >
            <h3 className="text-base font-semibold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
              {dialog.title}
            </h3>
            {dialog.body ? (
              <p className="mt-1.5 text-sm text-ink-dim leading-relaxed">{dialog.body}</p>
            ) : null}
            {dialog.input && (
              <input
                ref={inputRef}
                className="input mt-3"
                defaultValue={dialog.initialValue}
                placeholder={dialog.placeholder}
                autoFocus
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={() => closeDialog(false)}>
                {dialog.cancelLabel}
              </button>
              <button
                className={'btn ' + (dialog.danger ? 'btn-danger' : 'btn-accent')}
                autoFocus={!dialog.input}
                onClick={() => closeDialog(true)}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </UXContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(UXContext)
  if (!ctx) throw new Error('useToast must be used inside <UXProvider>')
  return ctx.toast
}

export function useConfirm() {
  const ctx = useContext(UXContext)
  if (!ctx) throw new Error('useConfirm must be used inside <UXProvider>')
  return ctx.confirm
}

export function usePrompt() {
  const ctx = useContext(UXContext)
  if (!ctx) throw new Error('usePrompt must be used inside <UXProvider>')
  return ctx.promptText
}
