import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const rootElement = document.getElementById('root')
const root = createRoot(rootElement)

function showStartupError(error) {
  console.error('Uygulama arayüzü başlatılamadı:', error)
  const panel = document.createElement('main')
  panel.style.cssText = 'min-height:100vh;padding:32px;font:14px/1.5 system-ui,sans-serif;color:#0f172a;background:#f8fafc'

  const title = document.createElement('h1')
  title.textContent = 'Uygulama başlatılamadı'
  title.style.cssText = 'margin:0 0 12px;font-size:22px'

  const message = document.createElement('p')
  message.textContent = 'Başlangıç hatası ayrıntısı aşağıda. Bu bilgiyi terminalden veya ekrandan paylaşabilirsiniz.'

  const details = document.createElement('pre')
  details.textContent = error?.stack || error?.message || String(error)
  details.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;border:1px solid #cbd5e1;border-radius:12px;background:white'

  panel.append(title, message, details)
  rootElement.replaceChildren(panel)
}

import('./App.jsx')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch(showStartupError)
