export type CapabilityType =
  | 'agent'
  | 'mcp'
  | 'cli'
  | 'rag'
  | 'loop'
  | 'workflow'
  | 'team'
  | 'skill';

export type CapabilityStatus =
  | 'draft'      // právě vytvořen, netestovaný
  | 'testing'    // prochází QA review
  | 'active'     // registrovaný v runtime
  | 'paused'     // existuje, ale nevykonává se
  | 'deprecated' // archivovaný
  | 'broken';    // poslední běh selhal

export type Runtime =
  | 'node'
  | 'python'
  | 'rust'
  | 'prompt'        // čistě LLM prompt, žádný kód
  | 'ollama'
  | 'composite';    // kombinuje více runtime
