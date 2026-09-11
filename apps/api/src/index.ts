// D:\dev\loyo-os\apps\api\src\index.ts
import Fastify from 'fastify'
import { watch } from 'fs';
import { join, resolve } from 'path';
import { DATA_DIR } from './lib/dataPaths.js';
import cors from '@fastify/cors'
import { Ollama } from 'ollama'
import { findBusinessesWithoutWeb } from './services/finder'
import { runOrchestrator } from './services/orchestrator'
import agentRoutes from './routes/agents'
import activityRoutes, { logActivity } from './routes/activity'
import runsRoutes from './routes/runs'
import teamsRoutes from './routes/teams'
import workflowsRoutes from './routes/workflows'
import loopsRoutes from './routes/loops'
import mcpRoutes from './routes/mcp'
import { saveChatMessage, getChatHistory } from './services/chatHistory'
import { getRunLog } from './services/runLogger'
import { startScheduler } from './services/scheduler'
import notificationsRoutes from './routes/notifications'
import cliRoutes from './routes/cli'
import { capabilitiesRoutes } from './routes/capabilities'
import { searchRoutes } from './routes/search.js'
import { initDb, countFromDb } from './lib/manifestDb.js'
import { reindexCapabilities } from './lib/manifestLoader.js'


const ollama = new Ollama({ host: 'http://localhost:11434' })
const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'warn' } })

await app.register(cors, { origin: ['http://localhost:3000'] })
await app.register(agentRoutes, { prefix: '/api' })
await app.register(activityRoutes, { prefix: '/api' })
await app.register(runsRoutes, { prefix: '/api' })
await app.register(teamsRoutes, { prefix: '/api' })
await app.register(workflowsRoutes, { prefix: '/api' })
await app.register(loopsRoutes, { prefix: '/api' })
await app.register(mcpRoutes, { prefix: '/api' })
await app.register(notificationsRoutes, { prefix: '/api' })
await app.register(cliRoutes, { prefix: '/api' })
await app.register(capabilitiesRoutes, { prefix: '/api' })
await app.register(searchRoutes, { prefix: '/api' })

app.get('/api/health', async () => ({ ok: true }))

app.get('/api/models', async () => {
  const m = await ollama.list()
  return m
})

app.post('/api/chat', async (req: any) => {
  const { prompt, model } = req.body as { prompt: string; model?: string }
  let chosen = model || 'qwen3:8b'
  if (prompt.length < 120 && !model) chosen = 'qwen2.5-coder:3b'
  const res = await ollama.chat({
    model: chosen,
    messages: [{ role: 'user', content: prompt }],
    options: { num_ctx: 2048, temperature: 0.2, num_predict: 512 },
  })
  return { model: chosen, response: res.message.content }
})

app.post('/api/finder', async (req: any) => {
  const { query, city, limit } = req.body as { query: string; city: string; limit?: number }
  console.log(`[API] /finder called: ${query} - ${city}`)
  const results = await findBusinessesWithoutWeb(query || 'instalatér', city || 'Praha', limit ?? 50)
  const withoutWeb = results.filter(r => !r.hasWebsite).length

  await logActivity({
    agent: 'Lubor_Nehleda',
    type: 'research',
    action: `finder: "${query}" / ${city} → ${results.length} firem, ${withoutWeb} bez webu`,
    meta: { query, city, found: results.length, withoutWeb },
  }).catch(() => {})

  return { found: results.length, withoutWeb, data: results }
})

// 🧠 ORCHESTRATOR — nervová soustava: Mary Jane → Lubor → CLI → report
app.post('/api/run', async (req: any) => {
  const { message } = req.body as { message: string }
  const userMessage = message || ''

  await saveChatMessage('me', userMessage).catch(() => {})

  const result = await runOrchestrator(userMessage)

  await saveChatMessage('mary', result.reply).catch(() => {})

  return result
})

// 📜 14denní historie chatu (rotující soubory, přepis po 2 týdnech)
app.get('/api/chat/history', async () => {
  const messages = await getChatHistory()
  return { messages }
})

// 🔍 detail konkrétního run-logu (diagnostika)
app.get('/api/logs/runs/:runId', async (req: any, reply) => {
  const { runId } = req.params as { runId: string }
  const log = await getRunLog(runId)
  if (!log) {
    reply.code(404)
    return { error: 'Log nenalezen' }
  }
  return log
})

// SSE endpoint — push při nové chat zprávě
app.get('/api/chat/watch', (req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': 'http://localhost:3000',
  })
  reply.raw.write('data: connected\n\n')

  const chatDir = resolve(DATA_DIR, 'chat_history')
  let debounce: ReturnType<typeof setTimeout> | null = null

  const watcher = watch(chatDir, { recursive: false }, () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      reply.raw.write('data: new-message\n\n')
    }, 150)
  })

  req.raw.on('close', () => {
    watcher.close()
    if (debounce) clearTimeout(debounce)
  })
})

// SSE endpoint — frontend se přihlásí a dostane push při změně capabilities
app.get('/api/capabilities/watch', (req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': 'http://localhost:3000',
  });
  reply.raw.write('data: connected\n\n');

  const dataDir = join(DATA_DIR, 'capabilities');
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const watcher = watch(dataDir, { recursive: true }, () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(async () => {
      await reindexCapabilities().catch(() => {});
      reply.raw.write('data: reload\n\n');
    }, 300);
  });

  req.raw.on('close', () => {
    watcher.close();
    if (debounce) clearTimeout(debounce);
  });
});

app.listen({ port: 3001 }).then(async () => {
  console.log('API on http://localhost:3001')
  initDb();
console.log('[manifestDb] init done, reindexing...');
const reindexed = await reindexCapabilities().catch(e => { console.error('[manifestDb] reindex fail', e); return { capabilities: [], errors: [e] } }) as any
console.log(`[manifestDb] reindexed ${reindexed.capabilities?.length?? 0} caps, ${reindexed.errors?.length?? 0} errors`)
const { reindexAll, getFtsStats } = await import('./lib/notesTasksFts.js');
const fts = reindexAll();
const stats = getFtsStats();
console.log(`[fts] reindexed ${fts.notes} notes, ${fts.tasks} tasks -> db now ${stats.notes} notes, ${stats.tasks} tasks`);
console.log('[manifestDb] index.db ready →', join(DATA_DIR, 'index.db'), `(${countFromDb()} capabilities)`)
  await startScheduler()
  console.log('[scheduler] registered — checking commands.json every 60s')
})
