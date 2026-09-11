import { createContext, useContext } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'dirty'

type SaveStatusContextType = {
  status: SaveStatus
  setStatus: (s: SaveStatus) => void
  onSaveClick: (() => void) | null
  setOnSaveClick: (fn: (() => void) | null) => void
  lastSavedAt: Date | null
  setLastSavedAt: (d: Date | null) => void
}

export const SaveStatusContext = createContext<SaveStatusContextType>({
  status: 'idle',
  setStatus: () => {},
  onSaveClick: null,
  setOnSaveClick: () => {},
  lastSavedAt: null,
  setLastSavedAt: () => {},
})

export const useSaveStatus = () => useContext(SaveStatusContext)
export const useSaveStatusContext = () => useContext(SaveStatusContext)