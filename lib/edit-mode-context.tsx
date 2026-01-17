'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface EditModeContextType {
  isEditMode: boolean
  setIsEditMode: (value: boolean) => void
  toggleEditMode: () => void
}

const EditModeContext = createContext<EditModeContextType | undefined>(undefined)

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false)

  const toggleEditMode = () => setIsEditMode(prev => !prev)

  return (
    <EditModeContext.Provider value={{ isEditMode, setIsEditMode, toggleEditMode }}>
      {children}
    </EditModeContext.Provider>
  )
}

// Default state for SSR
const defaultEditModeState: EditModeContextType = {
  isEditMode: false,
  setIsEditMode: () => {},
  toggleEditMode: () => {},
}

export function useEditMode() {
  const context = useContext(EditModeContext)
  // Return default state during SSR/prerendering
  if (!context) {
    return defaultEditModeState
  }
  return context
}
