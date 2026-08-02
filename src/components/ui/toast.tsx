import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ToastItem {
  id: string
  message: string
  duration?: number
}

interface ToastContextValue {
  showToast: (message: string, duration?: number) => void
  hideToast: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)

  const hideToast = useCallback(() => setToast(null), [])

  const showToast = useCallback((message: string, duration = 3000) => {
    const id = `${Date.now()}`
    setToast({ id, message, duration })
    if (duration > 0) {
      window.setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current))
      }, duration)
    }
  }, [])

  const value = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg'
          )}>
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={hideToast} className="ml-1 hover:opacity-70" type="button">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      showToast: (message) => console.warn(message),
      hideToast: () => undefined,
    }
  }
  return ctx
}
