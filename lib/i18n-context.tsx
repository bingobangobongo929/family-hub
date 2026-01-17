'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { LocalePreference } from '@/lib/database.types'
import { en, type Translations } from '@/messages/en'
import { da } from '@/messages/da'

export type Locale = LocalePreference

const messages: Record<Locale, Translations> = { en, da }

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  isLoading: boolean
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const LOCALE_KEY = 'family-hub-locale'

// Helper function to get nested value from object using dot notation
function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === 'string' ? current : undefined
}

// Helper function to replace {param} placeholders with values
function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str

  return str.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key]
    return value !== undefined ? String(value) : `{${key}}`
  })
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [locale, setLocaleState] = useState<Locale>('en')
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load locale from Supabase or localStorage
  const loadLocale = useCallback(async () => {
    setIsLoading(true)

    // If logged in, try Supabase first
    if (user) {
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('locale')
          .eq('user_id', user.id)
          .single()

        if (data && !error && data.locale) {
          setLocaleState(data.locale as Locale)
          document.documentElement.lang = data.locale
          // Also update localStorage for instant loading next time
          localStorage.setItem(LOCALE_KEY, data.locale)
          setIsLoading(false)
          return
        }
      } catch {
        // Fall through to localStorage
      }
    }

    // Fall back to localStorage
    const saved = localStorage.getItem(LOCALE_KEY) as Locale | null
    if (saved && (saved === 'en' || saved === 'da')) {
      setLocaleState(saved)
      document.documentElement.lang = saved
    }
    setIsLoading(false)
  }, [user])

  // Save locale to Supabase and localStorage
  const saveLocale = useCallback(async (newLocale: Locale) => {
    // Always save to localStorage for instant next load
    localStorage.setItem(LOCALE_KEY, newLocale)

    // If logged in, save to Supabase
    if (user) {
      try {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            locale: newLocale,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })

        if (error) {
          console.error('Error saving locale preference:', error)
        }
      } catch (error) {
        console.error('Error saving locale preference:', error)
      }
    }
  }, [user])

  // Initial load
  useEffect(() => {
    setMounted(true)
    loadLocale()
  }, [loadLocale])

  // Subscribe to real-time changes for cross-device sync
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('user_preferences_locale')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_preferences',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new && 'locale' in payload.new) {
            const newLocale = payload.new.locale as Locale
            setLocaleState(newLocale)
            document.documentElement.lang = newLocale
            localStorage.setItem(LOCALE_KEY, newLocale)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    document.documentElement.lang = newLocale
    saveLocale(newLocale)
  }, [saveLocale])

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const currentMessages = messages[locale]
    const value = getNestedValue(currentMessages, key)

    if (value === undefined) {
      // Fallback to English if key not found in current locale
      const fallback = getNestedValue(messages.en, key)
      if (fallback) {
        return interpolate(fallback, params)
      }
      // Return the key if not found anywhere (helps identify missing translations)
      console.warn(`Missing translation: ${key}`)
      return key
    }

    return interpolate(value, params)
  }, [locale])

  // Prevent flash of wrong locale
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, isLoading }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider')
  }
  return context
}

// Convenience hook for just getting locale
export function useLocale(): Locale {
  const { locale } = useTranslation()
  return locale
}
