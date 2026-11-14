// LoYo OS — ROYAL DARK
// Šedé plochy (90 %), modrá #12a4ff jen pro primární akci / aktivní stav / progress (~10 %),
// červená #ff1e00 (~4 %): live tečka, upozornění, chyby, mazání; zlatá #c9a646 (~1 %): drobné royal detaily.
// Nadpisy + logo: Playfair Display.
export const royal = {
  bg: '#2b2b2b',        // pozadí aplikace
  surface: '#353535',   // panely, sidebary
  card: '#3a3a3a',      // karty, inputy
  line: '#444444',      // bordery, oddělovače, neaktivní plochy
  text: '#f0f0f0',      // primární text
  textSoft: '#9a9a9a',  // sekundární text
  blue: '#12a4ff',      // jediný akcent
  live: '#ff1e00',      // ~4 %: live tečka, alert, chyba, smazat
  gold: '#c9a646',      // ~1 %: royal detail (verze, podpis, odznak)
}

export const colors = {
  bg: royal.bg,
  bgSoft: royal.surface,
  white: royal.card,
  black: royal.text,
  border: royal.line,
  borderStrong: '#555555',
  text: royal.text,
  textSoft: royal.textSoft,
  textFaint: 'rgba(240,240,240,0.35)',
  accent: royal.blue,
  red: royal.live,
  gold: royal.gold,
  green: royal.blue,
  purple: royal.textSoft,
  blue: royal.blue,
}

export const theme = {
  radius: { sm: '6px', md: '10px', lg: '14px', pill: '999px' },
  font: {
    display: "'Playfair Display', Georgia, serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    sans: "'Inter', system-ui, sans-serif",
  },
  tracking: { wide: '0.25em', wider: '0.3em' }
}

export const layout = { menuWidth: '300px', headerHeight: '56px' }

// Royal Dark je monochromní – každá kategorie má stejný (modrý) aktivní akcent.
const A = royal.blue
export const categoryColors = {
  agents: A, agent: A, teams: A, team: A, workflows: A, workflow: A,
  loops: A, loop: A, skills: A, skill: A, mcp: A, cli: A, api: A,
  dashboard: A, activity: A, tasks: A, notes: A, calendar: A,
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

const G = `linear-gradient(135deg, ${royal.surface} 0%, ${royal.card} 100%)`
export const categoryGradients = {
  activity: G,
  tasks: G,
  notes: G,
  calendar: G,
  dashboard: royal.surface,
}

export const clay = {
  ink: '#232323',
  face: royal.card,
  panelBg: royal.surface,
  radiusOuter: 12,
  radiusInner: 9,
  depth: 2,
  outerPad: 2,
  minH: 34,
  innerPad: '5px 12px',
  shadowIdle: '0 2px 0 #1f1f1f, 0 6px 14px rgba(0,0,0,0.35)',
  insetIdle: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px #444',
  insetActive: 'inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 6px rgba(0,0,0,0.18)',
  pattern: `url("data:image/svg+xml,%3Csvg width='26' height='26' viewBox='0 0 26 26' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='11' y='11' width='4' height='4' rx='1' fill='%23444444'/%3E%3C/svg%3E")`,
}
