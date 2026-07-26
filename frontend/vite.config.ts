import { defineConfig } from 'vitest/config'
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
  // Компонентные тесты (testing-plan §7): матрица кнопок и редьюсер событий.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    unstubGlobals: true,
  },
})
