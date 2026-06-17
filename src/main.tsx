import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ProgressProvider } from './state/ProgressContext'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProgressProvider>
      <RouterProvider router={router} />
    </ProgressProvider>
  </StrictMode>,
)
