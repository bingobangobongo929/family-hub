'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'
import { DEFAULT_SETTINGS } from './database.types'

interface SettingsContextType {
  settings: Record<string, any>
  updateSetting: (key: string, value: any) => Promise<void>
  rewardsEnabled: boolean
  aiModel: 'claude' | 'gemini'
  googleCalendarAutoPush: boolean
  showBirthdaysOnCalendar: boolean
  countdownRelationshipGroups: string[]
  // Google Photos settings
  googlePhotosAlbumId: string | null
  googlePhotosAlbumTitle: string | null
  googlePhotosRotationInterval: number
  // Sidebar settings
  sidebarNavOrder: string[] | null
  // F1 Spoiler-Free settings
  f1SpoilerFreeEnabled: boolean
  f1SpoilerFreeAutoWeekend: boolean
  f1SpoilerFreeManualOverride: boolean | null // null = use auto, true/false = manual override
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<Record<string, any>>(DEFAULT_SETTINGS)

  const fetchSettings = useCallback(async () => {
    if (!user) {
      // Load from localStorage for demo mode
      const saved = localStorage.getItem('family-hub-settings')
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
      }
      return
    }

    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')

      if (data) {
        const loadedSettings: Record<string, any> = { ...DEFAULT_SETTINGS }
        data.forEach(s => {
          loadedSettings[s.key] = s.value
        })
        setSettings(loadedSettings)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }, [user])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Listen for localStorage changes (for when settings page updates)
  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('family-hub-settings')
      if (saved) {
        setSettings(prev => ({ ...prev, ...JSON.parse(saved) }))
      }
    }

    window.addEventListener('storage', handleStorage)

    // Also poll for changes since storage event doesn't fire in same tab
    const interval = setInterval(() => {
      const saved = localStorage.getItem('family-hub-settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        setSettings(prev => {
          if (JSON.stringify(prev) !== JSON.stringify({ ...prev, ...parsed })) {
            return { ...prev, ...parsed }
          }
          return prev
        })
      }
    }, 1000)

    return () => {
      window.removeEventListener('storage', handleStorage)
      clearInterval(interval)
    }
  }, [])

  const updateSetting = useCallback(async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)

    if (!user) {
      localStorage.setItem('family-hub-settings', JSON.stringify(newSettings))
      return
    }

    try {
      await supabase
        .from('app_settings')
        .upsert({ key, value, user_id: user.id }, { onConflict: 'user_id,key' })
    } catch (error) {
      console.error('Error saving setting:', error)
    }
  }, [settings, user])

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        rewardsEnabled: settings.rewards_enabled as boolean,
        aiModel: (settings.ai_model as 'claude' | 'gemini') || 'claude',
        googleCalendarAutoPush: settings.google_calendar_auto_push as boolean ?? false,
        showBirthdaysOnCalendar: settings.show_birthdays_on_calendar as boolean ?? true,
        countdownRelationshipGroups: (settings.countdown_relationship_groups as string[]) || ['family_us', 'grandparents', 'friends'],
        // Google Photos settings
        googlePhotosAlbumId: (settings.google_photos_album_id as string | null) ?? null,
        googlePhotosAlbumTitle: (settings.google_photos_album_title as string | null) ?? null,
        googlePhotosRotationInterval: (settings.google_photos_rotation_interval as number) ?? 10,
        // Sidebar settings
        sidebarNavOrder: (settings.sidebar_nav_order as string[] | null) ?? null,
        // F1 Spoiler-Free settings
        f1SpoilerFreeEnabled: (settings.f1_spoiler_free_enabled as boolean) ?? false,
        f1SpoilerFreeAutoWeekend: (settings.f1_spoiler_free_auto_weekend as boolean) ?? true,
        f1SpoilerFreeManualOverride: (settings.f1_spoiler_free_manual_override as boolean | null) ?? null,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
