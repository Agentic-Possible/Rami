import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { noteBuild } from './lib/diagnostics'
import { listenForInstallPrompt } from './lib/install'
import { router } from './router'

listenForInstallPrompt()
noteBuild()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
