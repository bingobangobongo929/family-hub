'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Sidebar from './Sidebar'
import Screensaver from './Screensaver'
import { RefreshCw } from 'lucide-react'
import { DEFAULT_SETTINGS } from '@/lib/database.types'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  const isLoginPage = pathname === '/login'
  const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL &&
                                process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your-supabase-url'

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('family-hub-settings')
    if (saved) {
      setSettings(prev => ({ ...prev, ...JSON.parse(saved) }))
    }
  }, [])

  useEffect(() => {
    // Only redirect if Supabase is configured
    if (!loading && isSupabaseConfigured) {
      if (!user && !isLoginPage) {
        router.push('/login')
      } else if (user && isLoginPage) {
        router.push('/')
      }
    }
  }, [user, loading, isLoginPage, router, isSupabaseConfigured])

  const handleScreensaverWake = useCallback(() => {
    // Could add analytics or other wake handlers here
  }, [])

  // Show loading spinner while checking auth
  if (loading && isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-50 to-warm-100 dark:from-slate-900 dark:to-slate-800">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    )
  }

  // Login page - no sidebar
  if (isLoginPage) {
    return <>{children}</>
  }

  // Demo mode (no Supabase) or logged in - show full app
  if (!isSupabaseConfigured || user) {
    return (
      <div className="flex min-h-screen bg-warm-50 dark:bg-slate-900">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          {children}
        </main>
        <Screensaver
          mode={settings.screensaver_mode as 'clock' | 'photos' | 'gradient' | 'blank'}
          enabled={settings.screensaver_enabled as boolean}
          timeout={settings.screensaver_timeout as number}
          sleepStart={settings.sleep_start as string}
          sleepEnd={settings.sleep_end as string}
          onWake={handleScreensaverWake}
        />
      </div>
    )
  }

  // Not logged in and not on login page - will redirect
  return null
}
