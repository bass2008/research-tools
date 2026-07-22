import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Дев-сервер Vite (5173) проксирует /api на FastAPI (8000):
// фронт и бэкенд запускаются раздельно, CORS не нужен.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
