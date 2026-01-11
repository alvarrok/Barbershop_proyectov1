// client/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import App from './App'

// Importar los estilos OBLIGATORIOS
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <MantineProvider defaultColorScheme="dark">
    <Notifications />
    <App />
  </MantineProvider>,
)