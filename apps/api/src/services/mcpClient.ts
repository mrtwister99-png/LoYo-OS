// apps/api/src/services/mcpClient.ts
// LOYO OS — MCP klient. Spustí MCP server podle manifestu (pole "launch") přes stdio,
// vypíše jeho nástroje a zavolá je. Spojení drží 5 min od posledního použití.
//
// Manifest MCP:  "launch": { "command": "uvx", "args": ["mcp-server-fetch"], "env": { … } }
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { DATA_DIR } from '../lib/dataPaths.js'

const MCP_DIR = join(DATA_DIR, 'capabilities', 'mcp')
const IDLE_CLOSE_MS = 5 * 60_000
const CALL_TIMEOUT_MS = 120_000
const CONNECT_TIMEOUT_MS = 180_000 // první start stahuje balíček (uvx / npx)

type Launch = { command: string; args?: string[]; env?: Record<string, string>; cwd?: string }
type Conn = { client: Client; transport: StdioClientTransport; timer: ReturnType<typeof setTimeout> | null }

const conns = new Map<string, Conn>()
const connecting = new Map<string, Promise<Conn>>()

export async function readMcpManifest(id: string): Promise<any | null> {
  try { return JSON.parse(await readFile(join(MCP_DIR, id, 'manifest.json'), 'utf8')) } catch { return null }
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`${what}: nic do ${Math.round(ms / 1000)} s`)), ms) }),
  ])
}

function touch(id: string, c: Conn) {
  if (c.timer) clearTimeout(c.timer)
  c.timer = setTimeout(() => { closeMcp(id).catch(() => {}) }, IDLE_CLOSE_MS)
}

async function connect(id: string): Promise<Conn> {
  const existing = conns.get(id)
  if (existing) { touch(id, existing); return existing }
  const pending = connecting.get(id)
  if (pending) return pending

  const p = (async () => {
    const m = await readMcpManifest(id)
    if (!m) throw new Error(`MCP „${id}“ neexistuje (data/capabilities/mcp/${id}/manifest.json)`)
    const launch: Launch | undefined = m.launch
    if (!launch?.command) throw new Error(`MCP „${id}“ nemá v manifestu "launch" (jak ho spustit) — zatím jde jen evidovat.`)
    const transport = new StdioClientTransport({
      command: launch.command,
      args: launch.args ?? [],
      env: { ...(process.env as Record<string, string>), ...(launch.env ?? {}) },
      cwd: launch.cwd ? join(MCP_DIR, id, launch.cwd) : join(MCP_DIR, id),
      stderr: 'ignore',
    })
    const client = new Client({ name: 'loyo-os', version: '1.0.0' })
    await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, `Start MCP ${id}`)
    const conn: Conn = { client, transport, timer: null }
    conns.set(id, conn)
    touch(id, conn)
    return conn
  })()
  connecting.set(id, p)
  try { return await p } finally { connecting.delete(id) }
}

export async function closeMcp(id: string): Promise<void> {
  const c = conns.get(id)
  if (!c) return
  conns.delete(id)
  if (c.timer) clearTimeout(c.timer)
  await c.client.close().catch(() => {})
}

export function mcpRunning(id: string): boolean {
  return conns.has(id)
}

export async function listMcpTools(id: string): Promise<{ name: string; description?: string }[]> {
  const c = await connect(id)
  const res = await withTimeout(c.client.listTools(), CALL_TIMEOUT_MS, `Nástroje MCP ${id}`)
  return res.tools.map((t) => ({ name: t.name, description: t.description }))
}

export type McpContent = { text: string; images: { data: string; mimeType: string }[]; isError: boolean }

export async function callMcpTool(id: string, tool: string, args: Record<string, unknown> = {}): Promise<McpContent> {
  const c = await connect(id)
  touch(id, c)
  const res: any = await withTimeout(c.client.callTool({ name: tool, arguments: args }), CALL_TIMEOUT_MS, `MCP ${id}.${tool}`)
  const parts: any[] = Array.isArray(res?.content) ? res.content : []
  return {
    text: parts.filter((p) => p.type === 'text').map((p) => p.text).join('\n').trim(),
    images: parts.filter((p) => p.type === 'image').map((p) => ({ data: p.data, mimeType: p.mimeType })),
    isError: !!res?.isError,
  }
}

process.on('exit', () => { for (const c of conns.values()) c.transport.close().catch(() => {}) })
