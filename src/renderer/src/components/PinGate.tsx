import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Delete, ShieldCheck } from 'lucide-react'
import LeafLogo from '@/components/shell/LeafLogo'

/** The PIN required to unlock the terminal. */
const PIN = '8835'
const PIN_LENGTH = PIN.length
/** Session flag so a reload within the same launch doesn't re-prompt. */
const UNLOCK_KEY = 'tdx.unlocked'

interface PinGateProps {
  children: React.ReactNode
}

/**
 * Full-screen PIN lock shown before the terminal loads. Unlock persists for the
 * current session (cleared on a fresh app launch). Self-contained: no external
 * state or routing dependencies.
 */
export default function PinGate({ children }: PinGateProps): React.JSX.Element {
  const [unlocked, setUnlocked] = useState<boolean>(
    () => sessionStorage.getItem(UNLOCK_KEY) === '1'
  )
  const [entry, setEntry] = useState('')
  const [error, setError] = useState(false)

  const submit = useCallback((value: string) => {
    if (value === PIN) {
      sessionStorage.setItem(UNLOCK_KEY, '1')
      setUnlocked(true)
      return
    }
    setError(true)
    window.setTimeout(() => {
      setError(false)
      setEntry('')
    }, 600)
  }, [])

  const push = useCallback(
    (digit: string) => {
      setError(false)
      setEntry((prev) => {
        if (prev.length >= PIN_LENGTH) return prev
        const next = prev + digit
        if (next.length === PIN_LENGTH) submit(next)
        return next
      })
    },
    [submit]
  )

  const backspace = useCallback(() => {
    setError(false)
    setEntry((prev) => prev.slice(0, -1))
  }, [])

  useEffect(() => {
    if (unlocked) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key >= '0' && e.key <= '9') push(e.key)
      else if (e.key === 'Backspace') backspace()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [unlocked, push, backspace])

  if (unlocked) return <>{children}</>

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg text-text select-none">
      <div className="flex flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-edge bg-panel">
            <LeafLogo size={26} />
          </div>
          <div className="brandmark text-base tracking-[0.2em]">PREMBROKE</div>
          <div className="text-sm text-muted">Enter PIN to unlock</div>
        </div>

        {/* PIN dots */}
        <div className={clsx('flex gap-4', error && 'animate-[shake_0.4s_ease-in-out]')}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={clsx(
                'h-3.5 w-3.5 rounded-full border transition-colors',
                error
                  ? 'border-down bg-down'
                  : i < entry.length
                    ? 'border-accent bg-accent'
                    : 'border-edge bg-transparent'
              )}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <KeypadButton key={d} onClick={() => push(d)}>
              <span className="num text-lg">{d}</span>
            </KeypadButton>
          ))}
          <div />
          <KeypadButton onClick={() => push('0')}>
            <span className="num text-lg">0</span>
          </KeypadButton>
          <KeypadButton onClick={backspace} ariaLabel="Delete">
            <Delete className="h-5 w-5 text-muted" />
          </KeypadButton>
        </div>

        <div
          className={clsx(
            'flex items-center gap-1.5 text-[11px] transition-colors',
            error ? 'text-down' : 'text-muted'
          )}
        >
          {error ? (
            'Incorrect PIN'
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure local access
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-7px); }
          40%, 80% { transform: translateX(7px); }
        }
      `}</style>
    </div>
  )
}

interface KeypadButtonProps {
  children: React.ReactNode
  onClick: () => void
  ariaLabel?: string
}

function KeypadButton({ children, onClick, ariaLabel }: KeypadButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex h-16 w-16 items-center justify-center rounded-xl border border-edge bg-panel transition-colors hover:border-accent hover:bg-panel2 active:scale-95"
    >
      {children}
    </button>
  )
}
