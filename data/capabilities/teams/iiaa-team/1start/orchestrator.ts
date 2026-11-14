import { readFile, writeFile } from 'fs/promises';
import path from 'path';

/**
 * IIAA Team Orchestrator - volá agenty podle file triggerů
 * Tohle je ta vrstva mezi file watcherem a Koog/Qwen agenty
 */

const TEAM_DIR = path.join(process.cwd(), 'data/capabilities/teams/iiaa-team/1start');

export async function startAgent(agentId: string, runId: string) {
  console.log(`[Orchestrator] Starting agent ${agentId} for ${runId}`);
  
  // 1. Načti vstupy
  const state = JSON.parse(await readFile(path.join(TEAM_DIR, 'state.json'), 'utf-8'));
  const zadani = await readFile(path.join(TEAM_DIR, 'zadani.txt'), 'utf-8');
  
  // 2. Najdi předchozí výstupy
  const prevOutputs = [];
  for (const [key, step] of Object.entries(state.steps as any)) {
    if (step.status === 'done') {
      // read files from step.outputDir
      prevOutputs.push(step.outputDir);
    }
  }
  
  // 3. Zavolej Koog agenta
  // const agent = await loadAgent(agentId);
  // const result = await agent.run({ idea: zadani, prevOutputs, runId });
  
  // 4. Agent by měl sám zapsat do 02files/{order}-{id}/
  // 5. Agent by měl updatnout state.json a vytvořit next trigger
  // Tohle dělá agent sám ve svém 02_WORKFLOW.md Kroku 0
  
  console.log(`[Orchestrator] Agent ${agentId} should now be working...`);
}

export async function completeAgent(agentId: string, nextAgent: string | null) {
  const statePath = path.join(TEAM_DIR, 'state.json');
  const state = JSON.parse(await readFile(statePath, 'utf-8'));
  
  const stepKey = Object.keys(state.steps).find(k => state.steps[k].id === agentId);
  if (stepKey) {
    state.steps[stepKey].status = 'done';
    state.steps[stepKey].finishedAt = new Date().toISOString();
  }
  
  if (nextAgent) {
    state.currentStep = nextAgent;
    const triggerPath = path.join(TEAM_DIR, 'triggers', `${nextAgent}.txt`);
    await writeFile(triggerPath, `runId:${state.runId}\nprev:${agentId}\nnext:${state.steps[Object.keys(state.steps).find(k=>state.steps[k].id===nextAgent)!]?.next||'END'}`, 'utf-8');
    console.log(`[Orchestrator] Created trigger for ${nextAgent}`);
  } else {
    state.currentStep = 'done';
    console.log(`[Orchestrator] Pipeline finished!`);
  }
  
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}
