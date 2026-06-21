import { create } from 'zustand'

export interface Toast {
  id: string
  title: string
  body: string
  tone: 'up' | 'down' | 'gold'
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2, 10)
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 8000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
}))
