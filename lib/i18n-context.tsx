'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { en, type Translations } from '@/messages/en'
import { da } from '@/messages/da'

export type Locale = 'en' | 'da'

const messages: Record<Locale, Translations> = { en, da }

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
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
  const [locale, setLocaleState] = useState<Locale>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(LOCALE_KEY) as Locale | null
    if (saved && (saved === 'en' || saved === 'da')) {
      setLocaleState(saved)
      document.documentElement.lang = saved
    }
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem(LOCALE_KEY, newLocale)
    document.documentElement.lang = newLocale
  }, [])

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
    <I18nContext.Provider value={{ locale, setLocale, t }}>
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
