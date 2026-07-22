// API-слой: единственный метод /api/expand (проксируется на FastAPI).

export interface Child {
  phrase: string
  freq: number
  cached: boolean // фраза отдельно запрошена -> есть свой (более глубокий) пул
  childCount: number // реальные уточнения в кэше (если cached)
  children: Child[] // ЛОКАЛЬНЫЕ дети из пула родителя (вложенность по словам)
}

export interface ExpandResp {
  query: string
  freq: number | null
  total: number
  count: number
  children: Child[]
}

export async function expand(q: string, limit = 200): Promise<ExpandResp> {
  const r = await fetch(`/api/expand?q=${encodeURIComponent(q)}&limit=${limit}`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// формат частоты с пробелами-разделителями: 1234567 -> "1 234 567"
export const fmt = (n: number | null | undefined): string =>
  n == null ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
