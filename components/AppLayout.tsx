'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import Screensaver from './Screensaver'
import { RefreshCw } from 'lucide-react'
import { DEFAULT_SETTINGS } from '@/lib/database.types'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const handleScreensaverWake = useCallback(() => {
    // Could add analytics or other wake handlers here
  }, [])

  const openSidebar = useCallback(() => {
    setSidebarOpen(true)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
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
        {/* Sidebar - hidden on mobile, always visible on desktop */}
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 pb-20 lg:pb-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav onMoreClick={openSidebar} />

        {/* Screensaver */}
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
