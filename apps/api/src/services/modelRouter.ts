// apps/api/src/services/modelRouter.ts
// ÚKOL 9: Model router - Fast Path
export type ModelSpec = { model: string; num_ctx?: number; timeoutMs: number; label: string }

export const MODELS = {
  FAST: { model: 'qwen2.5-coder:3b', num_ctx: 2048, timeoutMs: 15000, label: 'fast-3b' },
  NORMAL: { model: 'qwen3:8b', num_ctx: 4096, timeoutMs: 90000, label: 'normal-8b' },
  DEEP: { model: 'qwen3:8b', num_ctx: 8192, timeoutMs: 120000, label: 'deep-8b-8192' },
  VISION: { model: 'qwen2.5vl:7b', num_ctx: 4096, timeoutMs: 90000, label: 'vision-7b' },
} as const

export function pickModel(message: string, mode?: string): ModelSpec {
  const trimmed = message.trim()
  const lower = trimmed.toLowerCase()
  if (mode === 'research' || lower.startsWith('/research')) return MODELS.DEEP
  if (mode === 'status' || mode === 'commands' || lower.startsWith('/status') || lower.startsWith('/commands')) return MODELS.FAST
  if (lower.includes('[screen]') || lower.includes('screenshot') || lower.includes('obrazovka') || lower.includes('/screen')) return MODELS.VISION
  if (trimmed.length > 0 && trimmed.length < 120) return MODELS.FAST
  return MODELS.NORMAL
}

export function getPriority(message: string): number {
  const lower = message.trim().toLowerCase()
  if (lower.startsWith('/status') || lower.startsWith('/commands')) return 1
  if (lower.startsWith('/note') || lower.startsWith('/task') || lower.startsWith('/kalendar') || lower.startsWith('/add') || lower.startsWith('/remove') || lower.startsWith('/pause') || lower.startsWith('/resume')) return 2
  if (message.trim().length < 120) return 3
  if (lower.startsWith('/find')) return 4
  if (lower.startsWith('/research')) return 5
  return 3
}