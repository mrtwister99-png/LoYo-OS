import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_DIR } from '../lib/dataPaths.js'
import { logActivity } from '../routes/activity.js'

const RUNS_DIR = join(DATA_DIR, 'logs/runs')
const AGENTS_INDEX = join(DATA_DIR, 'capabilities/agents/index.json')
const REP_FILE = join(DATA_DIR, 'activity/reputation.json')
const ALPHA = 0.3

type RepMap = Record<string,{ ewma:number; runs:number; fails:number; last:string }>

async function loadRep(): Promise<RepMap>{ try{return JSON.parse(await readFile(REP_FILE,'utf-8'))}catch{return{}} }
async function saveRep(m:RepMap){ await mkdir(join(DATA_DIR,'activity'),{recursive:true}); await writeFile(REP_FILE,JSON.stringify(m,null,2),'utf-8') }

function extractTools(txt:string){
  const tools=['fs_read','fs_write','web_search','rag','sms_send','cli_firmy','memory_search','fs','read_note','save_note']
  const low=txt.toLowerCase(); const found:string[]=[]
  for(const t of tools) if(low.includes(t) || low.includes(t.replace('_',' '))) found.push(t)
  if(low.includes('permission') && low.includes('write') &&!found.includes('fs_write')) found.push('fs_write')
  if(low.includes('permission') && low.includes('read') &&!found.includes('fs_read')) found.push('fs_read')
  return [...new Set(found)]
}

export async function runKosterad(){
  let failed:any[]=[]
  try{
    const files=await readdir(RUNS_DIR)
    for(const f of files.filter(f=>f.endsWith('.json'))){
      try{
        const c=JSON.parse(await readFile(join(RUNS_DIR,f),'utf-8'))
        const isFailed = c.status==='failed' || c.error || c.failed || (typeof c.status==='string' && c.status.toLowerCase().includes('fail'))
        if(isFailed) failed.push({file:f,data:c})
      }catch{}
    }
  }catch{ return {fixed:0,scanned:0} }

  if(failed.length===0){
    await logActivity({agent:'Koštěrad',type:'system',action:'Koštěrad: žádná failed runs ke kontrole',meta:{scanned:0}}).catch(()=>{})
    return {fixed:0,scanned:0}
  }

  let agentsIndex:any={agents:[]}
  try{ agentsIndex=JSON.parse(await readFile(AGENTS_INDEX,'utf-8')) }catch{}

  let rep=await loadRep()
  let fixed=0; let fixes:any[]=[]

  for(const {file,data} of failed){
    const errTxt=JSON.stringify(data.error||data.message||data).slice(0,3000)
    const missing=extractTools(errTxt)
    if(missing.length===0) continue
    const agentId=data.agent||data.agentId||data.meta?.agent||null
    let targets:any[]=[]
    if(agentId){
      const found=agentsIndex.agents.find((a:any)=>a.id===agentId || a.id.toLowerCase()===agentId.toLowerCase())
      if(found) targets.push(found)
    } else {
      targets=agentsIndex.agents.filter((a:any)=> missing.some(t=>!a.tools?.includes(t)))
    }
    for(const ag of targets){
      if(!ag.tools) ag.tools=[]
      let changed=false
      for(const tool of missing) if(!ag.tools.includes(tool)){ ag.tools.push(tool); changed=true }
      if(changed){
        fixed++; fixes.push({agent:ag.id,file,added:missing})
        if(!rep[ag.id]) rep[ag.id]={ewma:0.5,runs:0,fails:0,last:new Date().toISOString()}
        rep[ag.id].runs++; rep[ag.id].ewma=ALPHA*1+(1-ALPHA)*rep[ag.id].ewma; rep[ag.id].last=new Date().toISOString()
      } else {
        if(!rep[ag.id]) rep[ag.id]={ewma:0.5,runs:0,fails:0,last:new Date().toISOString()}
        rep[ag.id].runs++; rep[ag.id].fails++; rep[ag.id].ewma=ALPHA*0+(1-ALPHA)*rep[ag.id].ewma; rep[ag.id].last=new Date().toISOString()
      }
    }
  }

  if(fixed>0){
    try{ await writeFile(AGENTS_INDEX,JSON.stringify({...agentsIndex,last_sync:new Date().toISOString()},null,2),'utf-8') }catch{}
    await saveRep(rep)
    await logActivity({agent:'Koštěrad',type:'system',action:`Koštěrad opravil ${fixed} manifesty`,meta:{fixed,fixes,reputation:rep}}).catch(()=>{})
  } else {
    await saveRep(rep)
    await logActivity({agent:'Koštěrad',type:'system',action:`Koštěrad zkontroloval ${failed.length} failed runs - žádná oprava potřeba`,meta:{scanned:failed.length}}).catch(()=>{})
  }
  return {fixed,scanned:failed.length,fixes}
}

export async function generateMcpManifest(researchText: string): Promise<string> {
  const snippet = researchText.slice(0, 4000)
  const tools = extractTools(snippet)
  // plný manifest kompatibilní s McpBuilder.tsx
  const manifest = {
    id: `filesystem`,
    type: 'mcp',
    displayName: 'Filesystem MCP',
    number: 23,
    version: '0.1.0',
    status: 'draft',
    description: `Auto-generováno z research 2026. ${snippet.slice(0, 180)}...`,
    runtime: 'node',
    entrypoint: './src/server.ts',
    transport: 'stdio',
    tools: tools.length? tools : ['fs_read','fs_write','fs_list'],
    tags: ['fs','filesystem','research'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    research: snippet.slice(0, 2000),
  }
  return JSON.stringify(manifest, null, 2)
}