import React, { useState, useMemo } from 'react';

type TaskStatus = 'done' | 'todo' | 'in-progress';

interface Task {
  id: number;
  title: string;
  phase: string;
  phaseLabel: string;
  status: TaskStatus;
  description: string;
}

const INITIAL_TASKS: Task[] = [
  // FÁZE 0 - HOTOVO v 4.2
  { id: 1, title: 'Odstranění D:/dev hardcoded cest', phase: 'F0', phaseLabel: 'FÁZE 0 - HOTOVO v 4.2', status: 'done', description: '14 výskytů D:/dev/loyo-os -> DATA_DIR + LOYO_DATA_DIR env' },
  { id: 2, title: 'Kompletní .gitignore', phase: 'F0', phaseLabel: 'FÁZE 0 - HOTOVO v 4.2', status: 'done', description: 'chat_history, memory, cache, leads, reports, .tmp, dist' },
  { id: 3, title: 'Smazání starého modulu Projekty', phase: 'F0', phaseLabel: 'FÁZE 0 - HOTOVO v 4.2', status: 'done', description: 'Menu.tsx, App.tsx, useAppState.ts reference pryč' },
  { id: 4, title: 'Sjednocení hadr palety', phase: 'F0', phaseLabel: 'FÁZE 0 - HOTOVO v 4.2', status: 'done', description: '#ededed bg, #dbdbdb blok, #040b8d modrá, #ac0001 červená, #CDA24D karamelová' },
  { id: 5, title: 'Oprava turbo.json a dev scriptu', phase: 'F0', phaseLabel: 'FÁZE 0 - HOTOVO v 4.2', status: 'done', description: 'persistent:true, cache:false, turbo run dev' },
  { id: 6, title: 'Smazání kompilovaného JS z src/', phase: 'F0', phaseLabel: 'FÁZE 0 - HOTOVO v 4.2', status: 'done', description: 'apps/mcp/src/*.js a *.js.map smazat' },

  // FÁZE 1 - JÁDRO v4.5
  { id: 7, title: 'SQLite index pro manifesty', phase: 'F1', phaseLabel: 'FÁZE 1 - JÁDRO v4.5', status: 'done', description: 'data/index.db FTS5, <10ms i při 100 agentech' },
  { id: 8, title: 'Git auto-commit pro data/capabilities', phase: 'F1', phaseLabel: 'FÁZE 1 - JÁDRO v4.5', status: 'done', description: 'isomorphic-git auto: agent updated, time-travel' },
  { id: 9, title: 'Model router - Fast Path', phase: 'F1', phaseLabel: 'FÁZE 1 - JÁDRO v4.5', status: 'done', description: '<120 chars -> qwen2.5-coder:3b (0.5s), chat -> qwen3:8b, screen -> qwen2.5vl:7b, research -> 8192' },
  { id: 10, title: 'Fronta úkolů file-based', phase: 'F1', phaseLabel: 'FÁZE 1 - JÁDRO v4.5', status: 'done', description: 'data/queue/pending.json, priorita, 5x /find = fronta ne crash' },
  { id: 11, title: 'Self-healing Koštěrad', phase: 'F1', phaseLabel: 'FÁZE 1 - JÁDRO v4.5', status: 'todo', description: 'Noc projde failed runs, navrhne opravu manifestu, EWMA reputace' },
  { id: 12, title: 'Health check endpoint', phase: 'F1', phaseLabel: 'FÁZE 1 - JÁDRO v4.5', status: 'todo', description: '/api/health VRAM, model status, disk, záloha' },

  // FÁZE 2 - UX v4.5
  { id: 13, title: 'Poznámky auto save!', phase: 'F2', phaseLabel: 'FÁZE 2 - UX v4.5', status: 'done', description: 'Notes.tsx debounce 800ms PUT, 🟡 ukládám / 🟢 uloženo' },
  { id: 14, title: 'Layout rychlý', phase: 'F2', phaseLabel: 'FÁZE 2 - UX v4.5', status: 'done', description: 'React.memo Menu, useReducer, lazy load <100ms' },
  { id: 15, title: 'Kategorie různou barvou', phase: 'F2', phaseLabel: 'FÁZE 2 - UX v4.5', status: 'done', description: 'theme.ts categoryColors border-left podle type' },
  { id: 16, title: 'Kanban pro úkoly', phase: 'F2', phaseLabel: 'FÁZE 2 - UX v4.5', status: 'todo', description: 'List / Kanban ToDo/Doing/Done drag&drop' },
  { id: 17, title: 'Timeline pro kalendář', phase: 'F2', phaseLabel: 'FÁZE 2 - UX v4.5', status: 'todo', description: 'Grid/Timeline Google Calendar překryvy' },
  { id: 18, title: 'Focus mode', phase: 'F2', phaseLabel: 'FÁZE 2 - UX v4.5', status: 'todo', description: 'Header schová Menu/Bottom, jen Chat + úkol, Ctrl+Shift+F' },
  { id: 19, title: 'Undo pro poznámky/tasks', phase: 'F2', phaseLabel: 'FÁZE 2 - UX v4.5', status: 'todo', description: 'data/history/notes/:id/:timestamp.md Ctrl+Z' },
  { id: 20, title: 'Profile programming dashboard', phase: 'F2', phaseLabel: 'FÁZE 2 - UX v4.5', status: 'todo', description: 'RPG karta agenta level EWMA, skills, success rate' },

  // FÁZE 3 - PŘÍKAZY v5.0
  { id: 21, title: 'Všechno do čísel', phase: 'F3', phaseLabel: 'FÁZE 3 - PŘÍKAZY v5.0', status: 'todo', description: 'index.json number: 1,2,3 Agent 1=mary-jane, MCP 22=filesystem' },
  { id: 22, title: 'Příkaz /edit', phase: 'F3', phaseLabel: 'FÁZE 3 - PŘÍKAZY v5.0', status: 'todo', description: '/edit agent 2 -> Builder, /edit mcp 22' },
  { id: 23, title: 'Příkaz /add mcp 22 -> vyber agenta', phase: 'F3', phaseLabel: 'FÁZE 3 - PŘÍKAZY v5.0', status: 'todo', description: 'Najde manifest 22, přiřadí dependencies: ["fs:22"]' },
  { id: 24, title: 'Příkaz /new mcp -> builder + research', phase: 'F3', phaseLabel: 'FÁZE 3 - PŘÍKAZY v5.0', status: 'todo', description: 'Julia research best MCP 2026, Koštěrad předvyplní manifest' },
  { id: 25, title: 'Builder v2 - Team 0 agentů', phase: 'F3', phaseLabel: 'FÁZE 3 - PŘÍKAZY v5.0', status: 'todo', description: 'Team název 0 agentů + přidat existující + vytvořit nového' },
  { id: 26, title: 'Tlačítko RAG vedle agenta + 01/02/03', phase: 'F3', phaseLabel: 'FÁZE 3 - PŘÍKAZY v5.0', status: 'todo', description: 'RAG/agents/2/ a CORE_IDENTITY rychlý přístup' },
  { id: 27, title: 'Chat zvuk + příkazy', phase: 'F3', phaseLabel: 'FÁZE 3 - PŘÍKAZY v5.0', status: 'todo', description: 'Tauri audio cink při odpovědi Mary, /edit /add /new v chatu' },
  { id: 28, title: 'Mobil příkazy - swipe 1-9', phase: 'F3', phaseLabel: 'FÁZE 3 - PŘÍKAZY v5.0', status: 'todo', description: 'Swipe left list 1-9, tap spustí agenta' },
  { id: 29, title: 'Příkaz /pause /run /status s čísly', phase: 'F3', phaseLabel: 'FÁZE 3 - PŘÍKAZY v5.0', status: 'todo', description: '/pause loop 5, /run workflow 12, /status 2' },
  { id: 30, title: 'Příkaz /find s auto-tagging', phase: 'F3', phaseLabel: 'FÁZE 3 - PŘÍKAZY v5.0', status: 'todo', description: 'Auto tag obor/město/bez_webu do leads/' },

  // FÁZE 4 - RAG v5.2
  { id: 31, title: 'Složka RAG/ - struktura', phase: 'F4', phaseLabel: 'FÁZE 4 - RAG v5.2', status: 'todo', description: 'RAG/agents/1-mary-jane/ agentRAG.md, 01_CORE.rag.md' },
  { id: 32, title: 'RAG kontrola podle internetu - HLAVNÍ PRAVIDLO!', phase: 'F4', phaseLabel: 'FÁZE 4 - RAG v5.2', status: 'todo', description: 'Builder Agent na reality -> Julia research -> Koštěrad přepíše CORE_IDENTITY podle best practices' },
  { id: 33, title: 'LlamaIndex.TS + Qdrant lokálně', phase: 'F4', phaseLabel: 'FÁZE 4 - RAG v5.2', status: 'todo', description: 'Qdrant Docker + nomic-embed-text, index 100 souborů <10s' },
  { id: 34, title: '3 vrstvy paměti', phase: 'F4', phaseLabel: 'FÁZE 4 - RAG v5.2', status: 'todo', description: 'Krátká chat_history 14d, Střední memory.json 20 zpráv, Dlouhá RAG' },
  { id: 35, title: 'Auto-sumarizace starých chatů do RAG', phase: 'F4', phaseLabel: 'FÁZE 4 - RAG v5.2', status: 'todo', description: 'Cron noc sumarizace chat_history >14d do memory_long.md' },
  { id: 36, title: 'Knowledge Graph', phase: 'F4', phaseLabel: 'FÁZE 4 - RAG v5.2', status: 'todo', description: 'data/graph/entities/IČO.json propojení lidí/adres' },
  { id: 37, title: 'Daily brief s počasím a zálohou', phase: 'F4', phaseLabel: 'FÁZE 4 - RAG v5.2', status: 'todo', description: '7:00 activity + ukoly + počasí Weather API + záloha' },
  { id: 38, title: 'RAG validace manifestu před uložením', phase: 'F4', phaseLabel: 'FÁZE 4 - RAG v5.2', status: 'todo', description: 'RAGster kontrola smyslu podle internetu' },
  { id: 39, title: 'RAG enabled true/false v manifestu', phase: 'F4', phaseLabel: 'FÁZE 4 - RAG v5.2', status: 'todo', description: 'rag: {enabled, path}' },
  { id: 40, title: 'Reporty z research do data/reports/', phase: 'F4', phaseLabel: 'FÁZE 4 - RAG v5.2', status: 'todo', description: 'Julia ukládá <topic>-<date>.md s citacemi' },

  // FÁZE 5 - VISION v5.5
  { id: 41, title: 'Instalace vizuálních modelů', phase: 'F5', phaseLabel: 'FÁZE 5 - VISION v5.5', status: 'todo', description: 'qwen2.5vl:7b, moondream 1.7GB, minicpm-v:8b OCR' },
  { id: 42, title: 'Tauri screenshot plugin (F8)', phase: 'F5', phaseLabel: 'FÁZE 5 - VISION v5.5', status: 'todo', description: 'main.rs screenshots + F8 -> data/cache/screen-*.png' },
  { id: 43, title: 'Screen record lišta REC ● Click [x,y]', phase: 'F5', phaseLabel: 'FÁZE 5 - VISION v5.5', status: 'todo', description: 'Tenká lišta REC ● Click [324,580] -> chrome.exe -> /task, rdev' },
  { id: 44, title: 'Makro s podmínkou IF', phase: 'F5', phaseLabel: 'FÁZE 5 - VISION v5.5', status: 'todo', description: 'IF pixel červený -> klik ELSE počkej 2s, workflow if/else' },
  { id: 45, title: 'Visual agent - najdi tlačítko', phase: 'F5', phaseLabel: 'FÁZE 5 - VISION v5.5', status: 'todo', description: 'qwen2.5vl:7b image + "najdi Koupit" -> {x,y,w,h}' },
  { id: 46, title: 'Enigo click - kliknutí', phase: 'F5', phaseLabel: 'FÁZE 5 - VISION v5.5', status: 'todo', description: 'Rust enigo click na [x,y]' },
  { id: 47, title: 'Uložení makra + /run macro', phase: 'F5', phaseLabel: 'FÁZE 5 - VISION v5.5', status: 'todo', description: 'data/macros/koupit-makro.json, /run macro koupit' },
  { id: 48, title: 'Clipboard watcher - IČO -> ARES', phase: 'F5', phaseLabel: 'FÁZE 5 - VISION v5.5', status: 'todo', description: '8 čísel -> ARES, email -> úkol, toast' },
  { id: 49, title: 'File watcher - Downloads PDF -> OCR', phase: 'F5', phaseLabel: 'FÁZE 5 - VISION v5.5', status: 'todo', description: 'Downloads PDF faktura -> Julia OCR minicpm-v -> úkol' },
  { id: 50, title: 'Visual diff před/po makru', phase: 'F5', phaseLabel: 'FÁZE 5 - VISION v5.5', status: 'todo', description: 'Screenshot před/po, broken detekce' },

  // FÁZE 6 - MOBIL + HLAS + CLOUD v5.8
  { id: 51, title: 'PWA - vite-plugin-pwa', phase: 'F6', phaseLabel: 'FÁZE 6 - MOBIL + HLAS + CLOUD v5.8', status: 'todo', description: 'PWA instalovatelná, push SSE /api/chat/watch' },
  { id: 52, title: 'Mobil app - Tauri Mobile / Capacitor', phase: 'F6', phaseLabel: 'FÁZE 6 - MOBIL + HLAS + CLOUD v5.8', status: 'todo', description: 'Nativní appka Mary chat, příkazy 1-9, APK/IPA' },
  { id: 53, title: 'Wake word "Hej Mary" lokálně', phase: 'F6', phaseLabel: 'FÁZE 6 - MOBIL + HLAS + CLOUD v5.8', status: 'todo', description: 'openWakeWord + whisper-large-v3 česky' },
  { id: 54, title: 'Piper TTS česky - Mary mluví', phase: 'F6', phaseLabel: 'FÁZE 6 - MOBIL + HLAS + CLOUD v5.8', status: 'todo', description: 'Piper cs_CZ-jirka wav, Tauri přehraje' },
  { id: 55, title: 'Share to LoYo + Android widgety', phase: 'F6', phaseLabel: 'FÁZE 6 - MOBIL + HLAS + CLOUD v5.8', status: 'todo', description: 'Sdílet z prohlížeče -> /note, widget 2x2 úkoly + mic' },
  { id: 56, title: 'Privátní cloud záloha na tvůj server', phase: 'F6', phaseLabel: 'FÁZE 6 - MOBIL + HLAS + CLOUD v5.8', status: 'todo', description: 'restic + rclone + age, cron 2:00 backup -> tvuj-server:/backup/loyo' },
  { id: 57, title: 'Login PIN + biometrika + vault', phase: 'F6', phaseLabel: 'FÁZE 6 - MOBIL + HLAS + CLOUD v5.8', status: 'todo', description: 'Login.tsx safe-storage PIN hash + otisk, secrets age' },
  { id: 58, title: 'Permissions enforcement', phase: 'F6', phaseLabel: 'FÁZE 6 - MOBIL + HLAS + CLOUD v5.8', status: 'todo', description: 'capabilities.ts kontrola fs:write:data/leads' },
  { id: 59, title: 'Audit log viewer', phase: 'F6', phaseLabel: 'FÁZE 6 - MOBIL + HLAS + CLOUD v5.8', status: 'todo', description: 'Activity filtr jen chyby + časová osa + detail runu' },
  { id: 60, title: 'Tip Ťop Polish - FULL SELF v6.0', phase: 'F6', phaseLabel: 'FÁZE 6 - MOBIL + HLAS + CLOUD v5.8', status: 'todo', description: 'Agent debate, VRAM tracker, Sunday self-improvement, time-travel debugger, marketplace, gamifikace' },
];

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [selectedPhase, setSelectedPhase] = useState<string>('ALL');
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(9);
  const [search, setSearch] = useState('');

  const overallDone = useMemo(() => tasks.filter(t => t.status === 'done').length, [tasks]);
  const overallProgress = useMemo(() => Math.round((overallDone / tasks.length) * 100), [overallDone, tasks.length]);

  const phases = useMemo(() => {
    const map = new Map<string, { label: string; total: number; done: number }>();
    tasks.forEach(t => {
      const entry = map.get(t.phase) || { label: t.phaseLabel, total: 0, done: 0 };
      entry.total += 1;
      if (t.status === 'done') entry.done += 1;
      map.set(t.phase, entry);
    });
    return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (selectedPhase !== 'ALL') list = list.filter(t => t.phase === selectedPhase);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    return list;
  }, [tasks, selectedPhase, search]);

  const currentTask = useMemo(() => tasks.find(t => t.id === currentTaskId) || null, [tasks, currentTaskId]);
  const currentPhaseProgress = useMemo(() => {
    if (!currentTask) return 0;
    const phaseTasks = tasks.filter(t => t.phase === currentTask.phase);
    const done = phaseTasks.filter(t => t.status === 'done').length;
    return Math.round((done / phaseTasks.length) * 100);
  }, [tasks, currentTask]);

  const toggleStatus = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t));
  };

  const setInProgress = (id: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'in-progress' as TaskStatus } : t));
    setCurrentTaskId(id);
  };

  return (
    <div className="min-h-screen bg-[#ededed] text-black p-4 md:p-8 font-mono">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header - HADR */}
        <div className="bg-[#dbdbdb] border-2 border-black rounded-none p-4 md:p-6 flex flex-col md:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tighter">LoYo OS v4.2 → v6.0 FULL SELF</h1>
            <p className="text-sm mt-1 font-bold">60 ÚKOLŮ PO 1 • HADR SINGULARITY • bg:#ededed #dbdbdb #040b8d #ac0001 #CDA24D</p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="bg-black text-[#ededed] px-4 py-2 text-sm font-bold">OVERALL {overallDone}/60 • {overallProgress}%</div>
            <div className="bg-[#040b8d] text-white px-4 py-2 text-sm font-bold">CURRENT #{currentTask?.id || '-'}</div>
          </div>
        </div>

        {/* Overall progress - hadr */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#dbdbdb] border-2 border-black p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black">CELKOVÝ PROCES • {overallDone}/60 • {overallProgress}%</h2>
              <div className="flex gap-2">
                <div className="w-3 h-3 bg-[#040b8d] border border-black"></div>
                <div className="w-3 h-3 bg-[#CDA24D] border border-black"></div>
                <div className="w-3 h-3 bg-[#ac0001] border border-black"></div>
              </div>
            </div>
            <div className="w-full h-6 bg-[#ededed] border-2 border-black overflow-hidden">
              <div className="h-full bg-[#040b8d] transition-all duration-500 flex items-center justify-end pr-2" style={{ width: `${overallProgress}%` }}>
                <span className="text-[10px] text-white font-bold">{overallProgress}%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {phases.map(p => (
                <div key={p.key} className="bg-[#ededed] border border-black p-2 text-[11px]">
                  <div className="font-bold truncate">{p.key} {p.done}/{p.total}</div>
                  <div className="w-full h-2 bg-white border border-black mt-1">
                    <div className="h-full bg-[#040b8d]" style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} />
                  </div>
                  <div className="text-[10px] mt-1">{Math.round((p.done / p.total) * 100)}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Current selector */}
          <div className="bg-[#040b8d] border-2 border-black p-5 text-white space-y-3">
            <h2 className="font-black text-sm">CURRENT • VYBER SI CO DĚLÁŠ TEĎ</h2>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="hledat úkol..."
              className="w-full bg-[#ededed] border-2 border-black px-3 py-2 text-black text-xs outline-none"
            />
            <div className="bg-black text-[#ededed] p-3 text-xs">
              <div className="font-bold">#{currentTask?.id} {currentTask?.title}</div>
              <div className="text-[#CDA24D] mt-1">{currentTask?.phaseLabel}</div>
              <div className="mt-2 text-[11px] leading-tight">{currentTask?.description}</div>
              <div className="mt-3 w-full h-2 bg-[#dbdbdb] border border-white">
                <div className="h-full bg-[#CDA24D]" style={{ width: `${currentPhaseProgress}%` }} />
              </div>
              <div className="mt-1 text-[10px]">FÁZE PROGRESS {currentPhaseProgress}%</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => currentTask && toggleStatus(currentTask.id)} className="bg-[#CDA24D] border-2 border-black text-black font-black text-xs py-2 hover:bg-white">
                {currentTask?.status === 'done' ? 'ZRUŠIT HOTOVO' : 'OZNAČIT HOTOVO'}
              </button>
              <button onClick={() => setSelectedPhase('ALL')} className="bg-[#ededed] border-2 border-black text-black font-bold text-xs py-2">ALL 60</button>
            </div>
          </div>
        </div>

        {/* Phase selector + task list */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="bg-[#dbdbdb] border-2 border-black p-4 space-y-2">
            <h3 className="font-black text-xs">FÁZE FILTR • CURRENT VÝBĚR</h3>
            <button onClick={() => setSelectedPhase('ALL')} className={`w-full text-left px-3 py-2 border-2 border-black text-xs font-bold ${selectedPhase === 'ALL' ? 'bg-[#040b8d] text-white' : 'bg-[#ededed]'}`}>ALL • {overallDone}/60 • {overallProgress}%</button>
            {phases.map(p => (
              <button key={p.key} onClick={() => setSelectedPhase(p.key)} className={`w-full text-left px-3 py-2 border border-black text-[11px] font-bold ${selectedPhase === p.key ? 'bg-black text-[#ededed]' : 'bg-[#ededed] hover:bg-white'}`}>
                {p.label.split(' - ')[0]} • {p.done}/{p.total}
              </button>
            ))}
            <div className="pt-3 text-[10px] leading-tight">
              <div className="font-black">HADR PALETA:</div>
              <div className="flex gap-1 mt-1"><span className="px-2 py-1 bg-[#ededed] border border-black">#ededed bg</span><span className="px-2 py-1 bg-[#dbdbdb] border border-black">#dbdbdb blok</span></div>
              <div className="flex gap-1 mt-1"><span className="px-2 py-1 bg-[#040b8d] text-white border border-black">#040b8d modrá</span><span className="px-2 py-1 bg-[#ac0001] text-white border border-black">#ac0001 red</span></div>
              <div className="mt-1 px-2 py-1 bg-[#CDA24D] border border-black">#CDA24D karamel</div>
            </div>
          </div>

          <div className="lg:col-span-3 bg-[#ededed] border-2 border-black p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black text-xs">ÚKOLY • {selectedPhase} • {filteredTasks.length} ks • {filteredTasks.filter(t => t.status === 'done').length} HOTOVO</h3>
              <div className="text-[10px] font-bold">KLIK = CURRENT • CHECK = HOTOVO • DOUBLE = IN-PROGRESS</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[700px] overflow-auto pr-1">
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => setCurrentTaskId(task.id)}
                  className={`border-2 p-3 cursor-pointer transition-all text-[11px] leading-tight ${currentTaskId === task.id ? 'border-[#040b8d] bg-[#040b8d] text-white' : task.status === 'done' ? 'border-black bg-[#dbdbdb] opacity-70' : task.status === 'in-progress' ? 'border-[#CDA24D] bg-[#CDA24D] text-black' : 'border-black bg-white hover:bg-[#dbdbdb]'}`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-black">#{task.id} {task.title}</span>
                    <input type="checkbox" checked={task.status === 'done'} onChange={(e) => { e.stopPropagation(); toggleStatus(task.id); }} className="accent-[#040b8d]" />
                  </div>
                  <div className="text-[10px] mt-1 opacity-80">{task.phaseLabel}</div>
                  <div className="text-[10px] mt-1">{task.description}</div>
                  <div className="flex gap-1 mt-2">
                    <button onClick={(e) => { e.stopPropagation(); setInProgress(task.id); }} className="text-[9px] px-2 py-1 border border-black bg-[#ededed] text-black font-bold hover:bg-black hover:text-white">▶ CURRENT</button>
                    <span className={`text-[9px] px-2 py-1 border border-black font-bold ${task.status === 'done' ? 'bg-black text-[#ededed]' : task.status === 'in-progress' ? 'bg-[#ac0001] text-white' : 'bg-white'}`}>{task.status.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer stats */}
        <div className="bg-black text-[#ededed] border-2 border-black p-3 flex flex-wrap gap-4 text-[11px] font-bold">
          <span>LoYo OS v6.0 FULL SELF • 60 ÚKOLŮ PO 1 • {overallDone} HOTOVO • {60 - overallDone} ZBÝVÁ • CURRENT #{currentTaskId}</span>
          <span className="ml-auto">HADR #ededed / #dbdbdb / #040b8d / #ac0001 / #CDA24D • v4.2→v6.0 SINGULARITY</span>
        </div>
      </div>
    </div>
  );
}
