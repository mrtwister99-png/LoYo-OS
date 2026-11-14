
import { profile3Colors } from './themeP3'
export type MenuNodeP3 = { type: 'item'; id: string; label: string } | { type: 'group'; id: string; label: string; children: { id: string; label: string }[] }
export const MENU_STRUCTURE_P3: MenuNodeP3[] = [
  { type: 'item', id: 'dashboard', label: 'JOB DASHBOARD' },
  { type: 'item', id: 'zapisky', label: 'ZÁPISKY' },
  { type: 'item', id: 'projekty', label: 'PROJEKTY' },
  { type: 'group', id: 'jobtools', label: 'JOB TOOLS', children: [{ id: 'tym', label: 'TEAMS' }, { id: 'tasks', label: 'TASKS' }] },
]
export const MENU_META_P3: Record<string, { color: string; num: string }> = {
  dashboard: { color: profile3Colors.accent, num: '3_01' },
  zapisky: { color: '#12a4ff', num: '3_02' },
  projekty: { color: '#9a9a9a', num: '3_03' },
  tym: { color: '#9a9a9a', num: '3_04' },
  tasks: { color: '#9a9a9a', num: '3_05' },
}
