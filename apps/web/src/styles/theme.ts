export const colors = {

  bg: '#f5f5f3',
  bgSoft: '#e9e9e9',
  white: '#FFFFFF',
  black: '#0A0A0A',
  border: 'rgba(10,10,10,0.08)',
  borderStrong: 'rgba(10,10,10,0.15)',
  text: '#0A0A0A',
  textSoft: 'rgba(10,10,10,0.6)',
  textFaint: 'rgba(10,10,10,0.3)',
  accent: '#040b8d',
  red: '#ac0001',
  gold: '#CDA24D',
  green: '#00D084',
  purple: '#6300c7',
  blue: '#040b8d',
}

export const theme = {
  radius: { sm: '8px', md: '10px', lg: '16px', pill: '999px' },
  font: {
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    sans: 'Inter, system-ui, sans-serif',
  },
  tracking: { wide: '0.25em', wider: '0.3em' }
}

export const layout = { menuWidth: '300px', headerHeight: '56px' }

export const categoryColors = {
  agents: '#6300c7',
  agent: '#6300c7',
  teams: '#ff6f00',
  team: '#ff6f00',
  workflows: '#d9ff00',
  workflow: '#d9ff00',
  loops: '#00f2ff',
  loop: '#00f2ff',
  skills: '#fff700',
  skill: '#fff700',
  mcp: '#33a3ff',
  cli: '#40ff00',
  api: '#ffa600',
  dashboard: '#040b8d',
  activity: '#ac0001',
  tasks: '#CDA24D',
  notes: '#6300c7',
  calendar: '#33a3ff',
}

export const categoryNumbers = {
  dashboard: 0,
  activity: 0,
  tasks: 0,
  notes: 0,
  calendar: 0,
  agents: 1,
  agent: 1,
  teams: 2,
  team: 2,
  skills: 3,
  skill: 3,
  mcp: 4,
  cli: 5,
  loops: 6,
  loop: 6,
  workflows: 7,
  workflow: 7,
  api: 8,
}

export const categoryGradients = {
  activity: 'linear-gradient(135deg, #f5f5f3 0%, #f5f5f3 70%, #ac0001 100%)',
  tasks: 'linear-gradient(135deg, #f5f5f3 0%, #f5f5f3 70%, #CDA24D 100%)',
  notes: 'linear-gradient(135deg, #f5f5f3 0%, #f5f5f3 70%, #6300c7 100%)',
  calendar: 'linear-gradient(135deg, #f5f5f3 0%, #f5f5f3 70%, #33a3ff 100%)',
  dashboard: '#040b8d',
}

export const clay = {
  ink: '#1A1A1A',
  face: '#FEFEFE',
  panelBg: '#EFEFF2',
  radiusOuter: 16,
  radiusInner: 12,
  depth: 4,
  outerPad: 3,
  minH: 34,
  innerPad: '5px 12px',
  shadowIdle: '0 4px 0 #1A1A1A, 0 8px 14px rgba(0,0,0,0.18)',
  insetIdle: 'inset 0 2px 0 rgba(255,255,255,1), inset 0 -3px 5px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.04)',
  insetActive: 'inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -2px 6px rgba(0,0,0,0.16), inset 0 1px 1px rgba(255,255,255,0.9)',
  pattern: `url("data:image/svg+xml,%3Csvg width='26' height='26' viewBox='0 0 26 26' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='9' y='9' width='8' height='8' rx='1.8' fill='%23A8A9AD' fill-opacity='0.95'/%3E%3C/svg%3E")`,
}