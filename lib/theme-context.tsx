'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { ThemePreference } from '@/lib/database.types'

type Theme = ThemePreference

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [theme, setThemeState] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const applyTheme = useCallback((newTheme: Theme) => {
    if (newTheme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', systemDark)
    } else {
      document.documentElement.classList.toggle('dark', newTheme === 'dark')
    }
  }, [])

  // Load theme from Supabase or localStorage
  const loadTheme = useCallback(async () => {
    setIsLoading(true)

    // If logged in, try Supabase first
    if (user) {
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('theme')
          .eq('user_id', user.id)
          .single()

        if (data && !error) {
          setThemeState(data.theme as Theme)
          applyTheme(data.theme as Theme)
          // Also update localStorage for instant loading next time
          localStorage.setItem('theme', data.theme)
          setIsLoading(false)
          return
        }
      } catch {
        // Fall through to localStorage
      }
    }

    // Fall back to localStorage
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved) {
      setThemeState(saved)
      applyTheme(saved)
    } else {
      // Default to system
      applyTheme('system')
    }
    setIsLoading(false)
  }, [user, applyTheme])

  // Save theme to Supabase and localStorage
  const saveTheme = useCallback(async (newTheme: Theme) => {
    // Always save to localStorage for instant next load
    localStorage.setItem('theme', newTheme)

    // If logged in, save to Supabase
    if (user) {
      try {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            theme: newTheme,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })

        if (error) {
          console.error('Error saving theme preference:', error)
        }
      } catch (error) {
        console.error('Error saving theme preference:', error)
      }
    }
  }, [user])

  // Initial load
  useEffect(() => {
    setMounted(true)
    loadTheme()
  }, [loadTheme])

  // Subscribe to real-time changes for cross-device sync
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('user_preferences_theme')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_preferences',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new && 'theme' in payload.new) {
            const newTheme = payload.new.theme as Theme
            setThemeState(newTheme)
            applyTheme(newTheme)
            localStorage.setItem('theme', newTheme)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, applyTheme])

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, applyTheme])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    saveTheme(newTheme)
  }

  // Prevent flash of wrong theme
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
