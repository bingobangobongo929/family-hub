'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useDevice, getDeviceCSSVars } from '@/lib/device-context'
import { usePush } from '@/lib/push-context'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import Screensaver from './Screensaver'
import { DEFAULT_SETTINGS } from '@/lib/database.types'
import { saveCurrentRoute, getSavedRoute } from '@/lib/route-persistence'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { isMobile, isKitchen, device } = useDevice()
  const { isNative } = usePush()
  const pathname = usePathname()
  const router = useRouter()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [appReady, setAppReady] = useState(false)
  const hasRestoredRoute = useRef(false)
  const initialLoadComplete = useRef(false)

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

  // Save current route whenever pathname changes (for persistence)
  useEffect(() => {
    if (pathname && initialLoadComplete.current) {
      saveCurrentRoute(pathname)
    }
  }, [pathname])

  // Restore saved route on initial load
  useEffect(() => {
    if (!hasRestoredRoute.current && !loading && user) {
      hasRestoredRoute.current = true
      const savedRoute = getSavedRoute()

      // If we're on homepage but have a saved route, restore it
      if (savedRoute && pathname === '/' && savedRoute !== '/') {
        console.log('[Route Restore] Restoring to:', savedRoute)
        router.replace(savedRoute)
      }

      // Mark initial load as complete (so we start saving routes)
      setTimeout(() => {
        initialLoadComplete.current = true
      }, 500)
    }
  }, [loading, user, pathname, router])

  // App ready state - show loading screen until ready
  useEffect(() => {
    // Give a minimum display time for the loading screen (prevents flash)
    const minDisplayTimer = setTimeout(() => {
      if (!loading) {
        setAppReady(true)
      }
    }, 300)

    return () => clearTimeout(minDisplayTimer)
  }, [loading])

  // Also set ready when loading completes
  useEffect(() => {
    if (!loading && !appReady) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => setAppReady(true), 100)
      return () => clearTimeout(timer)
    }
  }, [loading, appReady])

  // Hide the initial CSS loader when app is ready
  useEffect(() => {
    if (appReady) {
      const loader = document.getElementById('initial-loader')
      if (loader) {
        loader.classList.add('hidden')
        // Remove from DOM after transition completes
        setTimeout(() => loader.remove(), 300)
      }
    }
  }, [appReady])

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

  // Don't render anything while app is loading - CSS loader handles it
  if (!appReady && isSupabaseConfigured) {
    return null
  }

  // Login page - no sidebar
  if (isLoginPage) {
    return <>{children}</>
  }

  // Demo mode (no Supabase) or logged in - show full app
  if (!isSupabaseConfigured || user) {
    // Sidebar width: 256px desktop, 320px kitchen
    const sidebarMargin = isKitchen ? 'lg:ml-80' : 'lg:ml-64'
    // Padding: larger on kitchen for readability from distance
    const mainPadding = isKitchen ? 'p-6 lg:p-10' : 'p-4 sm:p-6 lg:p-8'

    return (
      <div
        className="flex min-h-screen bg-warm-50 dark:bg-slate-900"
        style={getDeviceCSSVars(device)}
        data-device={device}
      >
        {/* Sidebar - hidden on mobile, always visible on desktop */}
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        {/* Main Content */}
        <main className={`flex-1 ${sidebarMargin} pb-20 lg:pb-0 ${mainPadding} overflow-x-hidden`}>
          {children}
        </main>

        {/* Mobile Bottom Navigation - hidden on kitchen display */}
        {!isKitchen && <MobileNav onMoreClick={openSidebar} />}

        {/* Screensaver - disabled on native mobile apps (iPhone/Android) */}
        {!isNative && (
          <Screensaver
            mode={settings.screensaver_mode as 'clock' | 'photos' | 'gradient' | 'blank' | 'dashboard'}
            enabled={settings.screensaver_enabled as boolean}
            timeout={settings.screensaver_timeout as number}
            sleepStart={settings.sleep_start as string}
            sleepEnd={settings.sleep_end as string}
            onWake={handleScreensaverWake}
          />
        )}
      </div>
    )
  }

  // Not logged in and not on login page - will redirect
  return null
}
