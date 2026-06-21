import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import PinGate from './components/PinGate'
import Popout from './components/Popout'
import './assets/main.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 2
    }
  }
})

const popoutId = new URLSearchParams(window.location.search).get('popout')

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {popoutId ? (
        <Popout moduleId={popoutId} />
      ) : (
        <PinGate>
          <App />
        </PinGate>
      )}
    </QueryClientProvider>
  </React.StrictMode>
)
