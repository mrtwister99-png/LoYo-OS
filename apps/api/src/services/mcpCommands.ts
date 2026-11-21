// apps/api/src/services/mcpCommands.ts
// LOYO OS // MARY JANE — MCP z chatu: /mcp (seznam, nástroje, volání), /fetch (přečti stránku),
// /web (stránka přes skutečný prohlížeč), /screenshot (snímek webu). I větou: „přečti stránku https://…“.
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_DIR } from '../lib/dataPaths.js'
import { logActivity } from '../routes/activity.js'
import { callMcpTool, listMcpTools, mcpRunning, readMcpManifest } from './mcpClient.js'
import { askConfirm } from './shellPolicy.js'

type CommandResult = { reply: string; steps: string[] }

const SHOTS_DIR = join(DATA_DIR, 'screenshots')
const MAX_SHOW = 3_500
const cut = (s: string, n = MAX_SHOW) => (s.length > n ? `${s.slice(0, n)}\n\n… (zkráceno, celkem ${s.length} znaků)` : s)
const activity = (action: string) => logActivity({ agent: 'Mary Jane', type: 'system', action }).catch(() => {})

function normUrl(raw: string): string | null {
  const t = raw.trim().replace(/^[<"'(]+|[>"').,]+$/g, '')
  if (!t) return null
  const u = /^https?:\/\//i.test(t) ? t : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(t) ? `https://${t}` : null
  try { return u ? new URL(u).toString() : null } catch { return null }
}

// ---------- /mcp ----------
export async function mcpCommand(args: string): Promise<CommandResult> {
  const steps = ['Mary Jane: /mcp']
  const [id, tool, ...rest] = args.trim().split(/\s+/).filter(Boolean)

  if (!id) {
    const dirs = await readdir(join(DATA_DIR, 'capabilities', 'mcp'), { withFileTypes: true }).catch(() => [])
    const lines: string[] = []
    for (const d of dirs.filter((x) => x.isDirectory())) {
      const m = await readMcpManifest(d.name)
      if (!m) continue
      lines.push(`4-${m.number ?? '?'} ${m.id} — ${m.displayName ?? ''}${m.launch ? (mcpRunning(m.id) ? ' · ● běží' : ' · spustitelný') : ' · jen evidence'}`)
    }
    lines.sort((a, b) => Number(a.split(' ')[0].slice(2)) - Number(b.split(' ')[0].slice(2)))
    return {
      reply: ['🔌 MCP servery', ...lines, '', 'Nástroje: /mcp <id> · volání: /mcp <id> <nástroj> {"json":"argumenty"}', 'Zkratky: /fetch <url> · /web <url> · /screenshot <url>'].join('\n'),
      steps,
    }
  }

  if (!tool) {
    const tools = await listMcpTools(id)
    return { reply: [`🔌 ${id} — ${tools.length} nástrojů`, ...tools.map((t) => `• ${t.name}${t.description ? ` — ${t.description.split('\n')[0].slice(0, 90)}` : ''}`)].join('\n'), steps }
  }

  let toolArgs: Record<string, unknown> = {}
  const json = rest.join(' ').trim()
  if (json) {
    try { toolArgs = JSON.parse(json) } catch { return { reply: `Argumenty musí být JSON, např. /mcp fetch fetch {"url":"https://example.com"}`, steps } }
  }
  const run = async () => formatResult(`${id}.${tool}`, await callMcpTool(id, tool, toolArgs))
  // nástroje, které spouští libovolný kód, jen po potvrzení (skill Bezpečný shell)
  if (/unsafe|evaluate|run_code/i.test(tool)) {
    return { reply: askConfirm(`🔌 /mcp ${id} ${tool} ${json}`.trim(), 'MCP nástroj spouští libovolný kód', run), steps }
  }
  return { reply: await run(), steps }
}

async function saveImages(images: { data: string; mimeType: string }[], name: string): Promise<string[]> {
  if (!images.length) return []
  await mkdir(SHOTS_DIR, { recursive: true })
  const out: string[] = []
  for (const [i, img] of images.entries()) {
    const ext = img.mimeType.includes('jpeg') ? 'jpg' : 'png'
    const file = join(SHOTS_DIR, `${name}_${new Date().toISOString().replace(/[:.]/g, '-')}${images.length > 1 ? `_${i + 1}` : ''}.${ext}`)
    await writeFile(file, Buffer.from(img.data, 'base64'))
    out.push(file)
  }
  return out
}

async function formatResult(label: string, res: Awaited<ReturnType<typeof callMcpTool>>): Promise<string> {
  const files = await saveImages(res.images, label.replace(/[^\w.-]+/g, '_'))
  return [
    `${res.isError ? '❌' : '🔌'} ${label}`,
    '',
    cut(res.text || (files.length ? '(obrázek)' : '(bez výstupu)')),
    ...(files.length ? ['', ...files.map((f) => `🖼️ ${f}`)] : []),
  ].join('\n')
}

// ---------- /fetch <url> ----------
export async function fetchCommand(args: string): Promise<CommandResult> {
  const steps = ['Mary Jane: /fetch → Fetch MCP']
  const url = normUrl(args.split(/\s+/)[0] ?? '')
  if (!url) return { reply: 'Jak na to: /fetch <adresa>, např. /fetch https://www.cnb.cz', steps }
  await activity(`čte stránku ${url} (Fetch MCP)`)
  const res = await callMcpTool('fetch', 'fetch', { url, max_length: 12_000 })
  return { reply: `🌐 ${url}\n\n${cut(res.text || '(stránka je prázdná)')}`, steps }
}

// ---------- /web <url> — skutečný prohlížeč, text stránky ----------
export async function webCommand(args: string): Promise<CommandResult> {
  const steps = ['Mary Jane: /web → Playwright MCP']
  const url = normUrl(args.split(/\s+/)[0] ?? '')
  if (!url) return { reply: 'Jak na to: /web <adresa> — otevře stránku v prohlížeči (i weby s JavaScriptem)', steps }
  await activity(`otevírá ${url} v prohlížeči (Playwright MCP)`)
  await callMcpTool('playwright', 'browser_navigate', { url })
  const snap = await callMcpTool('playwright', 'browser_snapshot', {})
  return { reply: `🧭 ${url} (prohlížeč)\n\n${cut(snap.text || '(prázdné)')}\n\nSnímek: /screenshot ${url}`, steps }
}

// ---------- /screenshot <url> ----------
export async function screenshotCommand(args: string): Promise<CommandResult> {
  const steps = ['Mary Jane: /screenshot → Playwright MCP']
  const url = normUrl(args.split(/\s+/)[0] ?? '')
  if (!url) return { reply: 'Jak na to: /screenshot <adresa>', steps }
  await activity(`fotí ${url} (Playwright MCP)`)
  await callMcpTool('playwright', 'browser_navigate', { url })
  const shot = await callMcpTool('playwright', 'browser_take_screenshot', { fullPage: false })
  const files = await saveImages(shot.images, `web_${new URL(url).hostname}`)
  return {
    reply: files.length ? `📸 ${url}\n🖼️ ${files.join('\n🖼️ ')}` : `📸 ${url}\n${cut(shot.text || 'Snímek se nepodařil.')}`,
    steps,
  }
}

// ---------- věta ----------
const URL_IN_TEXT = /(https?:\/\/[^\s<>"']+|\b(?:www\.)?[\w-]+\.(?:cz|sk|com|org|net|eu|io|dev|info)(?:\/[^\s<>"']*)?)/i

export async function tryNaturalMcpIntent(text: string): Promise<CommandResult | null> {
  const url = text.match(URL_IN_TEXT)?.[1]
  if (!url) return null
  if (/screenshot|sn[ií]mek|vyfo[tť]|fotk/i.test(text)) return screenshotCommand(url)
  if (/(otev[rř]i|prohl[ií][zž]e[cč]|proklikej)/i.test(text)) return webCommand(url)
  if (/(p[rř]e[cč]ti|st[aá]hni|na[cč]ti|shr[nň]|co\s+je\s+na|obsah)/i.test(text)) return fetchCommand(url)
  return null
}
