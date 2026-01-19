'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { checkReduceMotion } from './native-plugin'

interface ReduceMotionContextType {
  reduceMotion: boolean
}

const ReduceMotionContext = createContext<ReduceMotionContextType>({
  reduceMotion: false,
})

export function ReduceMotionProvider({ children }: { children: ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    // Check initial state
    const checkMotion = async () => {
      try {
        const result = await checkReduceMotion()
        setReduceMotion(result.reduceMotion)
      } catch {
        // Fallback to CSS media query
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
        setReduceMotion(mediaQuery.matches)
      }
    }

    checkMotion()

    // Listen for changes (CSS media query for web)
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mediaQuery.addEventListener('change', handler)

    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return (
    <ReduceMotionContext.Provider value={{ reduceMotion }}>
      {children}
    </ReduceMotionContext.Provider>
  )
}

export function useReduceMotion() {
  return useContext(ReduceMotionContext)
}

/**
 * Get animation class based on reduce motion preference
 * @param normalAnimation - Animation class when motion is allowed
 * @param reducedAnimation - Animation class when motion is reduced (defaults to 'animate-fade-in')
 */
export function useAnimation(normalAnimation: string, reducedAnimation = 'animate-fade-in') {
  const { reduceMotion } = useReduceMotion()
  return reduceMotion ? reducedAnimation : normalAnimation
}

/**
 * Get duration multiplier based on reduce motion preference
 * Returns 0 for instant transitions when reduce motion is enabled
 */
export function useDurationMultiplier() {
  const { reduceMotion } = useReduceMotion()
  return reduceMotion ? 0 : 1
}
