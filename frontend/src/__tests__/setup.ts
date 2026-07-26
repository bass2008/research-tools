// Настройка компонентных тестов: матчеры jest-dom + очистка DOM между тестами
// (globals не включаем, поэтому авто-cleanup RTL регистрируем вручную).
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())
