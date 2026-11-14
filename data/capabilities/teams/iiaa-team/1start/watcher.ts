import fs from 'fs';
import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data/capabilities/teams/iiaa-team/1start');
const TRIGGERS_DIR = path.join(DATA_DIR, 'triggers');
const STATE_PATH = path.join(DATA_DIR, 'state.json');
const ZADANI_PATH = path.join(DATA_DIR, 'zadani.txt');

// Map agent -> next agent
const CHAIN: Record<string, string | null> = {
  nofps: 'delete',
  delete: 'cheater', // pro paralelu: ['cheater','camper','laggy','error']
  cheater: 'camper',
  camper: 'laggy',
  laggy: 'error',
  error: 'fatal',
  fatal: 'cancel',
  cancel: 'pwner',
  pwner: 'op',
  op: null,
  eskejp: null // on-demand
};

console.log('[IIAA-Watcher] Starting file watcher for', TRIGGERS_DIR);

async function onTriggerFile(agentId: string, filePath: string) {
  console.log(`[IIAA-Watcher] Trigger detected: ${agentId}.txt`);
  
  try {
    const stateRaw = await readFile(STATE_PATH, 'utf-8');
    const state = JSON.parse(stateRaw);
    
    // Najdi step pro agenta
    const stepKey = Object.keys(state.steps).find(k => state.steps[k].id === agentId);
    if (!stepKey) {
      console.log(`[Watcher] Unknown agent ${agentId}, ignoring (maybe eskejp)`);
      return;
    }

    // Kontrola dependencies - pro sequential stačí že předchozí je done
    // Pro barrier (fatal) bys čekal na 4 agenty
    state.steps[stepKey].status = 'running';
    state.steps[stepKey].startedAt = new Date().toISOString();
    state.currentStep = agentId;
    await writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');

    console.log(`[Watcher] Agent ${agentId} marked as running, waiting for his output...`);
    console.log(`[Watcher] Agent ${agentId} should write to ${state.steps[stepKey].outputDir}/ and then create triggers/${CHAIN[agentId]}.txt`);

    // TADY BY SE VOLAL TVŮJ ORCHESTRATOR
    // await orchestrator.startAgent(agentId, state.runId)

  } catch (e) {
    console.error('[Watcher] Error processing trigger', e);
  }
}

// Sleduj triggers/ folder
fs.watch(TRIGGERS_DIR, async (eventType, filename) => {
  if (!filename || !filename.endsWith('.txt')) return;
  if (filename === '.gitkeep') return;
  
  const agentId = filename.replace('.txt', '');
  const filePath = path.join(TRIGGERS_DIR, filename);
  
  // Debounce - soubor může být ještě zapisován
  setTimeout(() => {
    onTriggerFile(agentId, filePath);
  }, 100);
});

// Sleduj zadani.txt - když se změní, auto-spusť pipeline (pro dev)
fs.watchFile(ZADANI_PATH, { interval: 1000 }, async () => {
  try {
    const idea = await readFile(ZADANI_PATH, 'utf-8');
    if (!idea.trim() || idea.includes('Jak spustit') || idea.length < 20) return;
    
    console.log('[Watcher] zadani.txt changed, auto-starting pipeline...');
    
    // Pokud už existuje nofps.txt a je novější než zadani.txt, nespouštěj znovu
    // (pro API flow se tohle neděje, jen pro dev)
    
  } catch {}
});

console.log('[IIAA-Watcher] Watching... Ctrl+C to stop');
console.log('Chain:', Object.entries(CHAIN).map(([k,v]) => `${k}->${v||'END'}`).join(' -> '));
