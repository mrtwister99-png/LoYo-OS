// D:\dev\loyo-os\apps\api\src\services\modelRouter.ts
// FINAL - optimalizováno pro RTX 4080 12GB VRAM + temperature

export type ModelSpec = { 
  model: string; 
  num_ctx?: number; 
  timeoutMs: number; 
  label: string;
  temperature?: number;  // <-- přidané
}

export const MODELS = {
  FAST: { model: 'devstral-small-2:latest', num_ctx: 2048, timeoutMs: 30000, label: 'fast-devstral-2048', temperature: 0.3 },
  NORMAL: { model: 'devstral-small-2:latest', num_ctx: 2048, timeoutMs: 90000, label: 'normal-devstral-2048', temperature: 0.3 },
  DEEP: { model: 'devstral-small-2:latest', num_ctx: 4096, timeoutMs: 120000, label: 'deep-devstral-4096', temperature: 0.2 },
  VISION: { model: 'qwen2.5vl:7b', num_ctx: 2048, timeoutMs: 90000, label: 'vision-7b-2048', temperature: 0.3 },
  BENDER: { model: 'devstral-small-2:latest', num_ctx: 4096, timeoutMs: 180000, label: 'bender-devstral-4096', temperature: 0.2 },
  BENDER_CODE: { model: 'devstral-small-2:latest', num_ctx: 4096, timeoutMs: 120000, label: 'bender-code-4096', temperature: 0.2 },
  BENDER_REASON: { model: 'devstral-small-2:latest', num_ctx: 4096, timeoutMs: 120000, label: 'bender-reason-4096', temperature: 0.2 },
  ULTRA_FAST: { model: 'qwen2.5vl:7b', num_ctx: 1024, timeoutMs: 15000, label: 'ultra-7b-1024', temperature: 0.4 },
  HEAVY_32B: { model: 'qwen2.5-coder:32b', num_ctx: 2048, timeoutMs: 180000, label: 'heavy-32b-2048', temperature: 0.2 },
} as const

export function pickModel(message: string, mode?: string): ModelSpec {
  const trimmed = message.trim()
  const lower = trimmed.toLowerCase()

  if (
    lower.includes('bender') ||
    lower.includes('blender') ||
    lower.includes('bpy') ||
    lower.includes('stoličk') ||
    lower.includes('stolick') ||
    lower.includes('3d model') ||
    lower.includes('render') ||
    lower.includes('materiál') ||
    lower.startsWith('/bender') ||
    lower.startsWith('/blender')
  ) {
    if (lower.includes('[screen]') || lower.includes('screenshot') || lower.includes('obrazovka') || lower.includes('/screen')) {
      return MODELS.VISION
    }
    if (trimmed.length > 800) return MODELS.BENDER_CODE
    if (trimmed.length > 400) return MODELS.BENDER_REASON
    return MODELS.BENDER
  }

  if (mode === 'research' || lower.startsWith('/research')) return MODELS.DEEP

  if (
    mode === 'status' ||
    mode === 'commands' ||
    lower.startsWith('/status') ||
    lower.startsWith('/commands') ||
    lower.startsWith('/note') ||
    lower.startsWith('/task') ||
    lower.startsWith('/kalendar') ||
    lower.startsWith('/add') ||
    lower.startsWith('/remove') ||
    lower.startsWith('/bender') ||
    lower.startsWith('/blender')
  ) {
    return MODELS.FAST
  }

  if (lower.includes('[screen]') || lower.includes('screenshot') || lower.includes('obrazovka') || lower.includes('/screen')) {
    return MODELS.VISION
  }

  if (trimmed.length > 0 && trimmed.length < 120) return MODELS.FAST

  return MODELS.NORMAL
}

export function getPriority(message: string): number {
  const lower = message.trim().toLowerCase()
  if (lower.startsWith('/status') || lower.startsWith('/commands') || lower.startsWith('/bender') || lower.startsWith('/blender')) return 1
  if (lower.startsWith('/note') || lower.startsWith('/task') || lower.startsWith('/kalendar') || lower.startsWith('/add') || lower.startsWith('/remove') || lower.startsWith('/pause') || lower.startsWith('/resume')) return 2
  if (message.trim().length < 120) return 3
  if (lower.startsWith('/find')) return 4
  if (lower.startsWith('/research') || lower.startsWith('/bender') || lower.startsWith('/blender')) return 5
  return 3
}
