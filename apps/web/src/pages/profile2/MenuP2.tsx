import type { Page } from '../../hooks/useAppState'
import { profile2Colors } from './themeP2'

export type MenuNodeP2 =
  | { type: 'item'; id: string; label: string }
  | { type: 'group'; id: string; label: string; children: { id: string; label: string }[] }

export const MENU_STRUCTURE_P2: MenuNodeP2[] = [
  { type: 'item', id: 'dashboard', label: 'DEV DASHBOARD' },
  { type: 'item', id: 'rozdelane', label: 'ROZDĚLANÉ' },
  { type: 'item', id: 'musthave', label: 'MUST HAVE' },
  { type: 'item', id: 'testy', label: 'TESTY' },
  { type: 'item', id: 'knowledgebase', label: 'KNOWLEDGE BASE' },
  { type: 'item', id: 'notes', label: 'CODING NOTES' },
]

export const MENU_META_P2: Record<string, { color: string; num: string }> = {
  dashboard: { color: profile2Colors.accent, num: '1_00' },
  rozdelane: { color: '#9a9a9a', num: '2_01' },
  musthave: { color: '#9a9a9a', num: '2_02' },
  testy: { color: '#12a4ff', num: '2_03' },
  knowledgebase: { color: '#9a9a9a', num: '2_05' },
  notes: { color: profile2Colors.accent, num: '2_04' },
}
