
import { profile4Colors } from './themeP4'
export type MenuNodeP4 = { type: 'item'; id: string; label: string } | { type: 'group'; id: string; label: string; children: { id: string; label: string }[] }
export const MENU_STRUCTURE_P4: MenuNodeP4[] = [
  { type: 'item', id: 'dashboard', label: 'GRAFIK DASHBOARD' },
  { type: 'item', id: 'grnotes', label: 'GR NOTES' },
  { type: 'item', id: 'helenevim', label: 'HELE NEVIM' },
  { type: 'item', id: 'shaders', label: 'SHADERS' },
  { type: 'item', id: 'threed', label: '3D' },
]
export const MENU_META_P4: Record<string, { color: string; num: string }> = {
  dashboard: { color: profile4Colors.accent, num: '4_01' },
  grnotes: { color: '#d9ff00', num: '4_02' },
  helenevim: { color: '#ff6f00', num: '4_03' },
  shaders: { color: '#00f2ff', num: '4_04' },
  threed: { color: '#ac0001', num: '4_05' },
}
