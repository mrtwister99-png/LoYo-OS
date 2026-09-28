// profile2/themeP2.ts - Theme pro Profil 2 (Pracovní) - červený akcent #ac0001
export const profile2Colors = {
  bg: '#ededed',
  bgSoft: '#dbdbdb',
  block: '#dbdbdb',
  white: '#FFFFFF',
  black: '#0A0A0A',
  border: '#7a7a7a',
  blue: '#040b8d',
  red: '#ac0001',
  caramel: '#CDA24D',
  neonGreen: '#d9ff00',
  accent: '#ac0001', // hlavní akcent pro P2
  accentHover: '#8a0001',
  text: '#000000',
  textSoft: 'rgba(0,0,0,0.6)',
  textFaint: 'rgba(0,0,0,0.3)',
}

export const profile2CategoryColors = {
  dashboard: '#ac0001', // místo karamelové - červená pro P2
  activity: '#ff1e00',
  tasks: '#95a64b',
  notes: '#ac0001', // coding notes taky červeně
  coding: '#ac0001',
  calendar: '#33a3ff',
  agents: '#a136ff',
  teams: '#ff6f00',
  skills: '#fff700',
  mcp: '#33a3ff',
  cli: '#40ff00',
  api: '#ffa600',
  loops: '#00f2ff',
  workflows: '#d9ff00',
}

export const profile2CategoryNumbers = {
  dashboard: 1,
  coding: 2,
  tasks: 3,
  activity: 4,
}

export const profile2Theme = {
  accent: profile2Colors.accent,
  colors: profile2Colors,
  categoryColors: profile2CategoryColors,
}
