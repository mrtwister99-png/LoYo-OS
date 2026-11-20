import { profile4Colors } from './themeP4'
export type MenuNodeP4 = { type: 'item'; id: string; label: string } | { type: 'group'; id: string; label: string; children: { id: string; label: string }[] }
export const MENU_STRUCTURE_P4: MenuNodeP4[] = [
  { type: 'item', id: 'dashboard', label: 'GRAFIK DASHBOARD' },
  { type: 'item', id: 'grnotes', label: 'GR NOTES' },
  { type: 'item', id: 'helenevim', label: 'HELE NEVIM' },
  { type: 'item', id: 'shaders', label: 'SHADERS' },
  { type: 'item', id: 'threed', label: '3D' },
  { type: 'item', id: 'detskykoutek', label: 'DĚTSKÝ KOUTEK' },
]
export const MENU_META_P4: Record<string, { color: string; num: string }> = {
  dashboard: { color: profile4Colors.accent, num: '4_01' },
  grnotes: { color: '#9a9a9a', num: '4_02' },
  helenevim: { color: '#9a9a9a', num: '4_03' },
  shaders: { color: '#12a4ff', num: '4_04' },
  threed: { color: '#9a9a9a', num: '4_05' },
  detskykoutek: { color: '#12a4ff', num: '4_06' },
}
