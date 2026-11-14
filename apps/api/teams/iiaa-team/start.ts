import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

const TEAM_DIR = path.join(process.cwd(), 'data/capabilities/teams/iiaa-team/1start');
const TRIGGERS_DIR = path.join(TEAM_DIR, 'triggers');
const STATE_PATH = path.join(TEAM_DIR, 'state.json');
const ZADANI_PATH = path.join(TEAM_DIR, 'zadani.txt');

/**
 * POST /api/teams/iiaa-team/start
 * Body: { idea: string, runId?: string }
 * 
 * Flow:
 * 1. Zapíše idea do zadani.txt
 * 2. Resetuje state.json (všechny steps na pending)
 * 3. Vytvoří triggers/nofps.txt -> probudí CTO agenta
 * 4. Vrátí runId
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  const { idea, runId = `run-${Date.now()}` } = req.body;
  
  if (!idea || typeof idea !== 'string' || idea.trim().length < 10) {
    return res.status(400).json({ error: 'idea musí být string min 10 znaků' });
  }

  try {
    await fs.mkdir(TRIGGERS_DIR, { recursive: true });
    await fs.mkdir(path.join(TEAM_DIR, '02files'), { recursive: true });

    // 1. Zapiš zadání
    await fs.writeFile(ZADANI_PATH, idea.trim(), 'utf-8');

    // 2. Reset state.json
    const stateRaw = await fs.readFile(STATE_PATH, 'utf-8');
    const state = JSON.parse(stateRaw);
    state.runId = runId;
    state.idea = idea.slice(0, 500);
    state.currentStep = 'nofps';
    state.startedAt = new Date().toISOString();
    
    for (const key of Object.keys(state.steps)) {
      state.steps[key].status = 'pending';
      state.steps[key].startedAt = null;
      state.steps[key].finishedAt = null;
    }

    await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');

    // 3. Vyčisti staré triggery a 02files (kromě .gitkeep a TRIGGER_PROTOCOL)
    const oldTriggers = await fs.readdir(TRIGGERS_DIR);
    for (const f of oldTriggers) {
      if (f !== '.gitkeep') {
        await fs.unlink(path.join(TRIGGERS_DIR, f)).catch(() => {});
      }
    }

    // 4. Vytvoř trigger pro nofps (CTO)
    const triggerPath = path.join(TRIGGERS_DIR, 'nofps.txt');
    const triggerContent = `runId:${runId}\nidea:${idea.slice(0, 200)}\ncreated:${new Date().toISOString()}\nnext:delete`;
    await fs.writeFile(triggerPath, triggerContent, 'utf-8');

    console.log(`[IIAA-API] Started ${runId} - created ${triggerPath}`);

    return res.status(200).json({
      ok: true,
      runId,
      message: 'Pipeline spuštěn, nofps probuzen',
      trigger: 'nofps.txt',
      next: 'delete',
      statePath: 'data/capabilities/teams/iiaa-team/1start/state.json',
      flow: 'nofps -> delete -> cheater -> camper -> laggy -> error -> fatal -> cancel -> pwner -> op'
    });

  } catch (e: any) {
    console.error('[IIAA-API] Error', e);
    return res.status(500).json({ error: e.message });
  }
}
