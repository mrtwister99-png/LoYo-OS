import { useState, useMemo } from 'react'

const BLUE = '#000000'
const GOLD = '#EEEAE1'

// ===== TYPY =====
type Tab = 'internal' | 'external' | 'keys' | 'logs' | 'webhooks' | 'mcp'

type InternalEndpoint = {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS'
  path: string
  desc: string
  status: 'LIVE' | 'IDLE' | 'ERROR' | 'BETA'
  category: 'AGENTI' | 'TYM' | 'POZNAMKY' | 'MEMORY' | 'TOOLS' | 'ROUTER' | 'SYSTEM'
  auth: 'PUBLIC' | 'API_KEY' | 'JWT'
  latency: string
  agent?: string
  uses: number
}

type ExternalApi = {
  id: string
  provider: string
  name: string
  category: 'LLM' | 'VOICE' | 'SEARCH' | 'DATA' | 'CALENDAR' | 'PAYMENT' | 'OTHER'
  status: 'CONNECTED' | 'INVALID_KEY' | 'QUOTA' | 'OFF'
  keyId: string
  quota: string
  used: string
  cost: string
  endpoint: string
  models?: string[]
  docs: string
}

// ===== DATA - INTERNÍ API LOYO-OS =====
const INTERNAL_ENDPOINTS: InternalEndpoint[] = [
  { id: 'get-agents', method: 'GET', path: '/api/agents', desc: 'Všichni agenti // pouze Lukáš', status: 'LIVE', category: 'AGENTI', auth: 'API_KEY', latency: '12ms', agent: 'LukasMak', uses: 342 },
  { id: 'post-agent', method: 'POST', path: '/api/teams/:teamId/agents', desc: 'Vytvořit agenta // LukasMak', status: 'LIVE', category: 'AGENTI', auth: 'API_KEY', latency: '89ms', agent: 'LukasMak', uses: 12 },
  { id: 'get-teams', method: 'GET', path: '/api/teams', desc: 'List týmů', status: 'IDLE', category: 'TYM', auth: 'JWT', latency: '24ms', uses: 56 },
  { id: 'finder', method: 'POST', path: '/api/finder', desc: 'FINDER // bez webu', status: 'LIVE', category: 'SYSTEM', auth: 'API_KEY', latency: '450ms', uses: 128 },
  // NOVÉ - co chybělo
  { id: 'get-notes', method: 'GET', path: '/api/notes/ja', desc: 'Poznámky uživatele JA', status: 'LIVE', category: 'POZNAMKY', auth: 'JWT', latency: '18ms', agent: 'JA', uses: 89 },
  { id: 'post-notes', method: 'POST', path: '/api/notes/ja', desc: 'Uložit poznámku do D:/data/ja/poznamky', status: 'LIVE', category: 'POZNAMKY', auth: 'JWT', latency: '34ms', agent: 'JA', uses: 67 },
  { id: 'chat-router', method: 'POST', path: '/api/router/sekretarka', desc: 'SEKRETÁŘKA // router na agenty', status: 'BETA', category: 'ROUTER', auth: 'JWT', latency: '1.2s', agent: 'Sekretarka', uses: 23 },
  { id: 'memory-search', method: 'POST', path: '/api/memory/search', desc: 'RAG search // LukasMak.md', status: 'LIVE', category: 'MEMORY', auth: 'API_KEY', latency: '210ms', agent: 'LukasMak', uses: 201 },
  { id: 'tools-exec', method: 'POST', path: '/api/tools/:toolId/exec', desc: 'Spustit tool agenta', status: 'LIVE', category: 'TOOLS', auth: 'API_KEY', latency: '150ms', uses: 45 },
  { id: 'webhooks-in', method: 'POST', path: '/api/webhooks/in/:source', desc: 'Příchozí webhook // mobil, telegram', status: 'BETA', category: 'SYSTEM', auth: 'PUBLIC', latency: '40ms', uses: 9 },
  { id: 'ws-agents', method: 'WS', path: '/ws/agents/live', desc: 'Live stav agentů // socket', status: 'LIVE', category: 'SYSTEM', auth: 'JWT', latency: '—', uses: 3 },
]

const EXTERNAL_APIS: ExternalApi[] = [
  { id: 'openai', provider: 'OpenAI', name: 'GPT-4o + Embeddings', category: 'LLM', status: 'CONNECTED', keyId: 'openai_prod', quota: '200$ / měs', used: '42.3$ (21%)', cost: '42.3$', endpoint: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'text-embedding-3-large'], docs: 'platform.openai.com/docs' },
  { id: 'anthropic', provider: 'Anthropic', name: 'Claude 3.5 Sonnet', category: 'LLM', status: 'CONNECTED', keyId: 'claude_prod', quota: '100$ / měs', used: '18.1$ (18%)', cost: '18.1$', endpoint: 'https://api.anthropic.com', models: ['claude-3-5-sonnet', 'claude-3-haiku'], docs: 'docs.anthropic.com' },
  { id: 'groq', provider: 'Groq', name: 'Llama 3 Fast Inference', category: 'LLM', status: 'CONNECTED', keyId: 'groq_fast', quota: '14.4k req / den', used: '2.1k', cost: '0$ (free)', endpoint: 'https://api.groq.com/openai/v1', models: ['llama3-70b', 'mixtral-8x7b'], docs: 'console.groq.com' },
  { id: 'tavily', provider: 'Tavily', name: 'Search API // Finder', category: 'SEARCH', status: 'CONNECTED', keyId: 'tavily_search', quota: '1000 req / měs', used: '124 / 1000', cost: '0$', endpoint: 'https://api.tavily.com/search', docs: 'tavily.com/docs' },
  { id: 'eleven', provider: 'ElevenLabs', name: 'Voice // Sekretářka hlas', category: 'VOICE', status: 'QUOTA', keyId: 'eleven_voice', quota: '10k znaků', used: '9.8k (98%)', cost: '22$', endpoint: 'https://api.elevenlabs.io/v1', docs: 'elevenlabs.io/docs' },
  { id: 'google-cal', provider: 'Google', name: 'Calendar + Gmail // JA', category: 'CALENDAR', status: 'CONNECTED', keyId: 'google_oauth_ja', quota: 'OAuth neomezeno', used: '342 req', cost: '0$', endpoint: 'https://www.googleapis.com/calendar/v3', docs: 'developers.google.com/calendar' },
  { id: 'supabase', provider: 'Supabase', name: 'DB + Auth + Storage', category: 'DATA', status: 'CONNECTED', keyId: 'supabase_prod', quota: '500MB DB', used: '124MB', cost: '0$', endpoint: 'https://xyz.supabase.co', docs: 'supabase.com/docs' },
]

const API_KEYS = [
  { id: 'openai_prod', name: 'OPENAI_API_KEY', provider: 'OpenAI', masked: 'sk-proj-•••••••••••••••a8f2', status: 'VALID', lastUsed: 'před 12 min', expires: 'nikdy', scope: 'all models' },
  { id: 'claude_prod', name: 'ANTHROPIC_API_KEY', provider: 'Anthropic', masked: 'sk-ant-•••••••••••••••9c1d', status: 'VALID', lastUsed: 'před 1h', expires: 'nikdy', scope: 'claude-3.5' },
  { id: 'tavily_search', name: 'TAVILY_API_KEY', provider: 'Tavily', masked: 'tvly-•••••••••••3k9a', status: 'VALID', lastUsed: 'před 3h', expires: 'nikdy', scope: 'search' },
  { id: 'eleven_voice', name: 'ELEVENLABS_API_KEY', provider: 'ElevenLabs', masked: '•••••••••••••••e7b2', status: 'QUOTA_EXCEEDED', lastUsed: 'včera', expires: 'nikdy', scope: 'tts' },
  { id: 'loyo_internal', name: 'LOYO_OS_INTERNAL_KEY', provider: 'LOYO-OS', masked: 'loyo_•••••••••••ja_24', status: 'VALID', lastUsed: 'právě', expires: '90 dní', scope: 'internal /*' },
]

const LOGS = [
  { time: '11:42:12', method: 'POST', path: '/api/notes/ja', status: 200, ms: 34, agent: 'JA', ip: '127.0.0.1' },
  { time: '11:41:55', method: 'POST', path: '/api/memory/search', status: 200, ms: 210, agent: 'LukasMak', ip: '127.0.0.1' },
  { time: '11:40:02', method: 'GET', path: '/api/agents', status: 200, ms: 12, agent: '—', ip: '127.0.0.1' },
  { time: '11:39:11', method: 'POST', path: '/api/router/sekretarka', status: 502, ms: 1200, agent: 'Sekretarka', ip: '192.168.1.5 (mobil)' },
  { time: '11:38:44', method: 'POST', path: '/api/finder', status: 200, ms: 450, agent: '—', ip: '127.0.0.1' },
  { time: '11:30:01', method: 'GET', path: '/api/teams', status: 401, ms: 8, agent: '—', ip: '127.0.0.1' },
]

const WEBHOOKS = [
  { id: 'wh_mobil', name: 'Mobil -> Sekretářka', direction: 'IN', url: '/api/webhooks/in/mobil', source: 'iOS Shortcut', secret: 'whsec_•••••a1', events: ['voice.note', 'text.command'], last: '11:39 - OK 200', status: 'LIVE' },
  { id: 'wh_telegram', name: 'Telegram Bot -> Router', direction: 'IN', url: '/api/webhooks/in/telegram', source: 'Telegram', secret: 'whsec_•••••b2', events: ['message', 'voice'], last: 'včera - OK', status: 'LIVE' },
  { id: 'wh_out', name: 'LOYO -> Make.com', direction: 'OUT', url: 'https://hook.eu1.make.com/xxxx', source: 'LOYO-OS', secret: '•••••', events: ['agent.done', 'note.created'], last: '11:42 - OK', status: 'LIVE' },
]

const MCP_SERVERS = [
  { id: 'fs', name: 'filesystem', status: 'LIVE', tools: 8, desc: 'Čtení/zápis do D:/dev/loyo-os/data/**', transport: 'stdio' },
  { id: 'memory', name: 'loyo-memory', status: 'LIVE', tools: 3, desc: 'RAG nad LukasMak.md + poznamky', transport: 'stdio' },
  { id: 'calendar', name: 'google-calendar', status: 'IDLE', tools: 5, desc: 'Čtení kalendáře JA', transport: 'sse' },
  { id: 'tavily-mcp', name: 'tavily-search', status: 'LIVE', tools: 2, desc: 'Web search pro agenty', transport: 'stdio' },
]

export default function Api() {
  const [tab, setTab] = useState<Tab>('internal')
  const [selectedInternal, setSelectedInternal] = useState('get-agents')
  const [selectedExternal, setSelectedExternal] = useState('openai')
  const [search, setSearch] = useState('')

  const activeInternal = useMemo(() => INTERNAL_ENDPOINTS.find(e => e.id === selectedInternal)!, [selectedInternal])
  const activeExternal = useMemo(() => EXTERNAL_APIS.find(e => e.id === selectedExternal)!, [selectedExternal])

  const filteredInternal = useMemo(() => {
    if (!search) return INTERNAL_ENDPOINTS
    return INTERNAL_ENDPOINTS.filter(e => e.path.toLowerCase().includes(search.toLowerCase()) || e.desc.toLowerCase().includes(search.toLowerCase()))
  }, [search])

  const filteredExternal = useMemo(() => {
    if (!search) return EXTERNAL_APIS
    return EXTERNAL_APIS.filter(e => e.provider.toLowerCase().includes(search.toLowerCase()) || e.name.toLowerCase().includes(search.toLowerCase()))
  }, [search])

  return (
    <div className="p-8 bg-[#F8F6F1] font-mono">
      {/* HEADER */}
      <div className="bg-white border-2 border-white p-6 flex justify-between items-center mb-6">
        <div>
          <div className="text-[10px] tracking-[0.4em] text-black/40">API OS // LOYO-OS • localhost:3001 • TAURI READY</div>
          <h1 className="text-3xl font-black mt-1 tracking-tighter">API CENTRUM // {INTERNAL_ENDPOINTS.length} INTERNÍ + {EXTERNAL_APIS.length} EXTERNÍ</h1>
          <div className="mt-2 flex gap-2">
            <span className="text-[10px] px-2 py-1 bg-black text-white">REQ TODAY: 1,247</span>
            <span className="text-[10px] px-2 py-1 border-2 border-black">AVG LATENCY: 124ms</span>
            <span className="text-[10px] px-2 py-1 border-2" style={{ borderColor: GOLD, background: GOLD }}>COST MONTH: $82.40</span>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="text-[10px] px-3 py-1 bg-black text-white">ONLINE • 2 ERRORS</div>
          <div className="w-3 h-3 animate-pulse" style={{ background: BLUE }}></div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: 'internal', label: `INTERNÍ // ${INTERNAL_ENDPOINTS.length}`, color: BLUE },
          { id: 'external', label: `EXTERNÍ // ${EXTERNAL_APIS.length}`, color: GOLD },
          { id: 'keys', label: `KLÍČE VAULT // ${API_KEYS.length}` },
          { id: 'logs', label: `LOGY // LIVE` },
          { id: 'webhooks', label: `WEBHOOKS // ${WEBHOOKS.length}` },
          { id: 'mcp', label: `MCP SERVERS // ${MCP_SERVERS.length}` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className="px-4 py-2 text-xs font-black tracking-widest border-2 border-black transition-all"
            style={{ background: tab === t.id ? (t as any).color || 'black' : 'white', color: tab === t.id ? (t.id === 'internal' ? 'black' : t.id === 'external' ? 'black' : 'white') : 'black' }}
          >
            {t.label}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="HLEDAT ENDPOINT / PROVIDERA..."
          className="ml-auto px-3 py-2 text-xs bg-black text-white border-2 border-black outline-none placeholder:text-white/40 w-[260px]"
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT LIST */}
        <div className="col-span-5 bg-white border-2 border-black h-[calc(100vh-220px)] flex flex-col">
          <div className="p-4 text-[10px] tracking-[0.4em] text-black/40 border-b-2 border-black">
            {tab === 'internal' && `INTERNÍ ENDPOINTS // ${filteredInternal.length}`}
            {tab === 'external' && `EXTERNÍ API // ${filteredExternal.length} PROVIDERŮ`}
            {tab === 'keys' && `VAULT // ŠIFROVANÉ KLÍČE`}
            {tab === 'logs' && `LIVE LOGS // POSLEDNÍCH 100`}
            {tab === 'webhooks' && `WEBHOOKS // IN + OUT`}
            {tab === 'mcp' && `MCP // MODEL CONTEXT PROTOCOL`}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === 'internal' && filteredInternal.map(ep => {
              const isActive = selectedInternal === ep.id
              return (
                <div
                  key={ep.id}
                  onClick={() => setSelectedInternal(ep.id)}
                  className="p-5 cursor-pointer border-b-2 border-black flex justify-between items-center"
                  style={isActive ? { background: BLUE } : { background: 'white' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] px-2 py-1 bg-black text-white font-black">{ep.method}</span>
                      <span className="text-[10px] px-2 py-0.5 border border-black/20">{ep.category}</span>
                      <span className="text-[10px] opacity-60">{ep.latency}</span>
                    </div>
                    <div className="font-black text-sm mt-1 truncate">{ep.path}</div>
                    <div className="text-[11px] mt-1 opacity-60 truncate">{ep.desc}</div>
                  </div>
                  <div className="ml-3 text-right">
                    <div className="text-[10px] font-black px-2 py-1 bg-black text-white">{ep.status}</div>
                    <div className="text-[9px] mt-1 opacity-50">{ep.uses} uses</div>
                  </div>
                </div>
              )
            })}

            {tab === 'external' && filteredExternal.map(ex => {
              const isActive = selectedExternal === ex.id
              const statusColor = ex.status === 'CONNECTED' ? '#22c55e' : ex.status === 'QUOTA' ? GOLD : '#ef4444'
              return (
                <div
                  key={ex.id}
                  onClick={() => setSelectedExternal(ex.id)}
                  className="p-5 cursor-pointer border-b-2 border-black flex justify-between"
                  style={isActive ? { background: GOLD } : { background: 'white' }}
                >
                  <div>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs font-black">{ex.provider.toUpperCase()}</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-black text-white">{ex.category}</span>
                      <span className="w-2 h-2 rounded-full" style={{ background: statusColor }}></span>
                    </div>
                    <div className="font-bold text-sm mt-1">{ex.name}</div>
                    <div className="text-[10px] opacity-60 mt-1">{ex.used} • {ex.cost}</div>
                  </div>
                  <div className="text-[10px] font-black">{ex.status}</div>
                </div>
              )
            })}

            {tab === 'keys' && API_KEYS.map(k => (
              <div key={k.id} className="p-4 border-b-2 border-black flex justify-between items-center">
                <div>
                  <div className="flex gap-2 items-center">
                    <span className="font-black text-xs">{k.provider}</span>
                    <span className="text-[9px] px-2 py-0.5 bg-black text-white">{k.status}</span>
                  </div>
                  <div className="text-xs mt-1 font-mono">{k.name}</div>
                  <div className="text-[11px] font-mono mt-1 opacity-60">{k.masked}</div>
                </div>
                <div className="text-right text-[10px] opacity-60">
                  <div>{k.lastUsed}</div>
                  <div className="mt-1">{k.scope}</div>
                </div>
              </div>
            ))}

            {tab === 'logs' && LOGS.map((l, i) => (
              <div key={i} className="p-3 border-b border-black/10 font-mono text-[11px] flex gap-2">
                <span className="opacity-40">{l.time}</span>
                <span className="font-black px-1 bg-black text-white">{l.method}</span>
                <span className="truncate flex-1">{l.path}</span>
                <span className={l.status === 200 ? 'text-green-600' : 'text-red-600 font-black'}>{l.status}</span>
                <span className="opacity-40">{l.ms}ms</span>
              </div>
            ))}

            {tab === 'webhooks' && WEBHOOKS.map(w => (
              <div key={w.id} className="p-4 border-b-2 border-black">
                <div className="flex justify-between">
                  <span className="font-black text-xs">{w.name}</span>
                  <span className="text-[9px] px-2 py-0.5 bg-black text-white">{w.direction} • {w.status}</span>
                </div>
                <div className="text-[11px] mt-1 font-mono opacity-60 truncate">{w.url}</div>
                <div className="text-[10px] mt-1 opacity-50">{w.events.join(', ')} • {w.last}</div>
              </div>
            ))}

            {tab === 'mcp' && MCP_SERVERS.map(m => (
              <div key={m.id} className="p-4 border-b-2 border-black flex justify-between">
                <div>
                  <div className="font-black text-xs">{m.name} <span className="text-[10px] opacity-40">• {m.transport}</span></div>
                  <div className="text-[11px] opacity-60 mt-1">{m.desc}</div>
                  <div className="text-[10px] mt-1">{m.tools} tools</div>
                </div>
                <div className="text-[10px] font-black px-2 py-1 h-fit bg-black text-white">{m.status}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT DETAIL */}
        <div className="col-span-7 bg-white p-8 border-2 border-black h-[calc(100vh-220px)] overflow-y-auto">
          {tab === 'internal' && (
            <>
              <div className="text-[10px] tracking-[0.4em] text-black/40">DETAIL // {activeInternal.method} // {activeInternal.category}</div>
              <div className="text-2xl font-black mt-2 tracking-tighter">{activeInternal.path}</div>
              <div className="text-sm text-black/60 mt-1">{activeInternal.desc} • Agent: {activeInternal.agent || 'SYSTEM'} • Auth: {activeInternal.auth} • {activeInternal.uses} použití</div>

              <div className="mt-8 grid grid-cols-2 gap-0 border-2 border-black">
                <div className="p-4 bg-black text-white">
                  <div className="text-[10px] tracking-widest text-white/60">REQUEST EXAMPLE</div>
                  <pre className="text-xs mt-3 font-mono whitespace-pre-wrap">
{activeInternal.id === 'get-agents' ? `curl localhost:3001${activeInternal.path} \\
  -H "x-api-key: $LOYO_KEY"` : 
 activeInternal.id === 'post-notes' ? `curl -X POST localhost:3001${activeInternal.path} \\
  -H "Authorization: Bearer $JWT" \\
  -d '{ "title": "Napad", "content": "..." }'` :
 activeInternal.id === 'chat-router' ? `{
  "from": "mobil",
  "text": "Najdi poznamku o klientovi X",
  "routeTo": "auto"
}` : `{
  "id": "${activeInternal.id}",
  "auth": "${activeInternal.auth}"
}`}
                  </pre>
                </div>
                <div className="p-4" style={{ background: GOLD }}>
                  <div className="text-[10px] tracking-widest">RESPONSE • {activeInternal.latency}</div>
                  <pre className="text-xs mt-3 font-mono whitespace-pre-wrap">
{activeInternal.id === 'get-agents' ? `{
  success: true,
  count: 1,
  agents: [{ id: "LukasMak", name: "Lukáš" }]
}` : activeInternal.id.includes('notes') ? `{
  success: true,
  file: "2026-05-13-napad.md",
  path: "D:/dev/loyo-os/data/ja/poznamky/..."
}` : `{
  success: true,
  latency: "${activeInternal.latency}",
  status: "${activeInternal.status}"
}`}
                  </pre>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="border-2 border-black p-3">
                  <div className="text-[9px] opacity-40">AUTH</div>
                  <div className="font-black text-xs mt-1">{activeInternal.auth}</div>
                </div>
                <div className="border-2 border-black p-3">
                  <div className="text-[9px] opacity-40">AGENT</div>
                  <div className="font-black text-xs mt-1">{activeInternal.agent || 'SYSTEM'}</div>
                </div>
                <div className="border-2 border-black p-3" style={{ background: BLUE }}>
                  <div className="text-[9px] opacity-60">LATENCY P95</div>
                  <div className="font-black text-xs mt-1">{activeInternal.latency}</div>
                </div>
              </div>

              <div className="mt-6 bg-black text-white p-4 text-xs font-mono">
                <div className="opacity-40">[LIVE LOG • {activeInternal.path}]</div>
                {LOGS.filter(l => l.path.includes(activeInternal.path.split('/')[2] || '')).slice(0,3).map((l,i) => (
                  <div key={i}>{l.method} {l.path} → {l.status} • {l.ms}ms • {l.agent}</div>
                ))}
                {LOGS.filter(l => l.path.includes(activeInternal.path.split('/')[2] || '')).length === 0 && <div>Žádné logy pro tento endpoint • vše OK</div>}
              </div>
            </>
          )}

          {tab === 'external' && (
            <>
              <div className="text-[10px] tracking-[0.4em] text-black/40">EXTERNÍ API // {activeExternal.provider.toUpperCase()} // {activeExternal.category}</div>
              <div className="flex justify-between items-start mt-2">
                <div>
                  <div className="text-2xl font-black tracking-tighter">{activeExternal.name}</div>
                  <div className="text-sm text-black/60 mt-1">{activeExternal.endpoint} • Docs: {activeExternal.docs}</div>
                </div>
                <div className="w-3 h-3" style={{ background: activeExternal.status === 'CONNECTED' ? '#22c55e' : GOLD }}></div>
              </div>

              <div className="mt-8 border-2 border-black p-6">
                <div className="text-[10px] tracking-[0.4em] text-black/40">MODELY / SLUŽBY</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeExternal.models?.map(m => (
                    <span key={m} className="text-xs px-3 py-1 border-2 border-black font-bold" style={{ background: BLUE }}>{m}</span>
                  )) || <span className="text-xs">Jedna služba</span>}
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div><div className="text-[9px] opacity-40">STATUS</div><div className="font-black mt-1 text-sm">{activeExternal.status}</div></div>
                  <div><div className="text-[9px] opacity-40">QUOTA</div><div className="font-bold mt-1 text-sm">{activeExternal.quota}</div></div>
                  <div><div className="text-[9px] opacity-40">POUŽITO</div><div className="font-bold mt-1 text-sm">{activeExternal.used}</div></div>
                  <div><div className="text-[9px] opacity-40">NÁKLADY MĚSÍC</div><div className="font-black mt-1 text-sm">{activeExternal.cost}</div></div>
                  <div><div className="text-[9px] opacity-40">KLÍČ</div><div className="font-mono mt-1 text-xs">{activeExternal.keyId}</div></div>
                  <div><div className="text-[9px] opacity-40">ENDPOINT</div><div className="font-mono mt-1 text-[11px] truncate">{activeExternal.endpoint}</div></div>
                </div>

                <div className="mt-6 flex gap-2">
                  <button className="px-4 py-2 bg-black text-white text-xs font-black">TEST PŘIPOJENÍ</button>
                  <button className="px-4 py-2 border-2 border-black text-xs font-bold">ZOBRAZIT DOKUMENTACI</button>
                  <button className="px-4 py-2 border-2 border-black text-xs font-bold" style={{ borderColor: GOLD }}>ROTATE KEY</button>
                </div>
              </div>

              <div className="mt-6 text-[10px] text-black/40 leading-relaxed">
                <b className="text-black">PROČ TO MÁŠ V OS:</b> Externí API ti umožňují aby agenti používali GPT/Claude/Groq místo aby vše běželo lokálně. 
                Tavily = Finder bez webu. ElevenLabs = hlas sekretářky. Google = kalendář. Tady vidíš kolik tě to stojí a jestli ti nedošla kvóta (jako u ElevenLabs teď).
              </div>
            </>
          )}

          {tab !== 'internal' && tab !== 'external' && (
            <div className="text-center py-20">
              <div className="text-xs tracking-[0.3em] opacity-30">PROFI OS OBSAHUJE:</div>
              <div className="mt-6 text-left max-w-[520px] mx-auto text-xs leading-relaxed space-y-3">
                <div><b>• API Keys Vault</b> - šifrované úložiště klíčů, rotace, expirace, audit log kdo kdy použil jaký klíč. Nikdy ne v .env v gitu.</div>
                <div><b>• Rate Limiting & Quota</b> - hlídá kolik requestů může agent udělat, kolik stojí, kdy dojde free tier.</div>
                <div><b>• Logs & Tracing</b> - každý request kdo, kdy, jak dlouho, kolik stál. Důležité pro sekretářku - víš co dělala.</div>
                <div><b>• Webhooks</b> - IN: mobil, Telegram, Make.com → dovnitř do LOYO-OS. OUT: LOYO-OS → Notion, Slack, e-mail když agent něco dodělá.</div>
                <div><b>• MCP Servers</b> - Model Context Protocol - standard jak dát agentovi tools (filesystem, memory, search). To je budoucnost.</div>
                <div><b>• API Gateway</b> - jedno místo localhost:3001 přes které jde vše, s auth, CORS, logováním. Agenti nevolají externí API přímo, ale přes gateway.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
