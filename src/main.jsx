import React from 'react'
import { createRoot } from 'react-dom/client'
import { ViewerDemo } from './ViewerDemo.jsx'

export * from './components/index.js'

if (typeof document !== 'undefined') createRoot(document.getElementById('root')).render(<React.StrictMode><ViewerDemo /></React.StrictMode>)
