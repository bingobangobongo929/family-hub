'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { App } from '@capacitor/app'
import { useAuth } from '@/lib/auth-context'
import { useDevice, getDeviceCSSVars } from '@/lib/device-context'
import { usePush } from '@/lib/push-context'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import Screensaver from './Screensaver'
import { DEFAULT_SETTINGS } from '@/lib/database.types'
import { saveCurrentRoute, getSavedRoute, markAppBackgrounded } from '@/lib/route-persistence'
import { initDeepLinkHandler, cleanupDeepLinkHandler } from '@/lib/deep-link-handler'
import { getSharedContent, clearSharedContent, isNativeIOS } from '@/lib/native-plugin'
import { setupKeyboardListeners, dismissKeyboard } from '@/lib/keyboard'
import { NotificationTemplates } from '@/lib/local-notifications'
import { supabase } from '@/lib/supabase'
import { initDebugLogger } from '@/lib/debug-logger'

// Initialize debug logger for in-app console viewing
if (typeof window !== 'undefined') {
  initDebugLogger()
}

// Type for pending auto-process request
interface PendingAutoProcess {
  intent: 'task' | 'calendar'
  timestamp: number
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, session } = useAuth()
  const { isMobile, isKitchen, device } = useDevice()
  const { isNative, clearBadge } = usePush()
  const pathname = usePathname()
  const router = useRouter()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [appReady, setAppReady] = useState(false)
  const [pendingSharedContent, setPendingSharedContent] = useState(false)
  const [isAutoProcessing, setIsAutoProcessing] = useState(false)
  const [pendingAutoProcess, setPendingAutoProcess] = useState<PendingAutoProcess | null>(null)
  const hasRestoredRoute = useRef(false)
  const initialLoadComplete = useRef(false)
  const hasCheckedSharedContent = useRef(false)
  const hasAutoProcessed = useRef(false)

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

  // Clear app badge when app comes to foreground (native only)
  useEffect(() => {
    if (!isNative) return

    const handleAppStateChange = App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        clearBadge()

        // Check for pending shared content from share extension
        // Note: New flow uses intent from share extension, this is fallback for old content
        if (isNativeIOS()) {
          try {
            const content = await getSharedContent()
            if (content.hasContent) {
              console.log('[AppLayout] Found pending shared content on foreground:', content)
              setPendingSharedContent(true)

              // If content has intent, use the new auto-processing flow via state
              if (content.intent && !hasAutoProcessed.current) {
                console.log('[AppLayout] Setting pending auto-process for intent:', content.intent)
                setPendingAutoProcess({ intent: content.intent as 'task' | 'calendar', timestamp: Date.now() })
              } else if (!content.intent) {
                // Fallback: route based on content type
                const hasImages = content.images && content.images.length > 0
                if (hasImages) {
                  router.push('/calendar?scan=true')
                } else {
                  router.push('/tasks?shared=true')
                }
              }
            }
          } catch (e) {
            console.error('[AppLayout] Failed to check shared content:', e)
          }
        }
      } else {
        // App going to background - mark the time for cold start detection
        markAppBackgrounded()
      }
    })

    // Also clear badge and check shared content on initial mount
    clearBadge()

    // Check for shared content on initial load (with retry for App Group sync delay)
    const checkInitialSharedContent = async (attempt = 1) => {
      if (!isNativeIOS() || hasCheckedSharedContent.current) return

      try {
        const content = await getSharedContent()
        console.log(`[AppLayout] Initial shared content check (attempt ${attempt}):`, content)

        if (content.hasContent) {
          hasCheckedSharedContent.current = true
          console.log('[AppLayout] Found shared content on initial load:', content)
          setPendingSharedContent(true)

          // If content has intent, use the new auto-processing flow via state
          if (content.intent && !hasAutoProcessed.current) {
            console.log('[AppLayout] Setting pending auto-process from initial load:', content.intent)
            setPendingAutoProcess({ intent: content.intent as 'task' | 'calendar', timestamp: Date.now() })
          } else if (!content.intent) {
            // Fallback: route based on content type
            const hasImages = content.images && content.images.length > 0
            if (hasImages) {
              router.push('/calendar?scan=true')
            } else {
              router.push('/tasks?shared=true')
            }
          }
        } else if (attempt < 3) {
          // Retry after a short delay - App Group sync can be slow
          console.log(`[AppLayout] No content found, retrying in 500ms (attempt ${attempt}/3)`)
          setTimeout(() => checkInitialSharedContent(attempt + 1), 500)
        } else {
          hasCheckedSharedContent.current = true
          console.log('[AppLayout] No shared content after 3 attempts')
        }
      } catch (e) {
        console.error('[AppLayout] Failed to check shared content:', e)
        hasCheckedSharedContent.current = true
      }
    }
    checkInitialSharedContent()

    return () => {
      handleAppStateChange.then(h => h.remove())
    }
  }, [isNative, clearBadge, router])

  // Handle deep links from iOS widgets and share extension
  useEffect(() => {
    initDeepLinkHandler((route) => {
      console.log('[AppLayout] Deep link navigation to:', route)

      // Check if this is a process route from share extension
      if (route.includes('process=true')) {
        const urlParams = new URLSearchParams(route.split('?')[1] || '')
        const intent = urlParams.get('intent') as 'task' | 'calendar' | null
        if (intent && !hasAutoProcessed.current) {
          console.log('[AppLayout] Deep link triggered auto-process with intent:', intent)
          setPendingAutoProcess({ intent, timestamp: Date.now() })
        }
      }

      router.push(route)
    })

    return () => {
      cleanupDeepLinkHandler()
    }
  }, [router])

  // Handle hardware back button (Android and iOS swipe back)
  useEffect(() => {
    if (!isNative) return

    const backButtonListener = App.addListener('backButton', ({ canGoBack }) => {
      // Close sidebar if open
      if (sidebarOpen) {
        setSidebarOpen(false)
        return
      }

      // Navigate back if possible
      if (canGoBack && pathname !== '/') {
        window.history.back()
      }
      // Don't exit app on back - let user use home button
    })

    return () => {
      backButtonListener.then(h => h.remove())
    }
  }, [isNative, sidebarOpen, pathname])

  // Set up keyboard listeners for better mobile UX
  useEffect(() => {
    if (!isNative) return

    const cleanup = setupKeyboardListeners()
    return cleanup
  }, [isNative])

  // Auto-process shared content from share extension
  // This handles the new flow: user chooses Task/Calendar in share extension,
  // then we auto-process and send notification without showing UI
  useEffect(() => {
    const autoProcessSharedContent = async () => {
      // Check if we have pending auto-process from state (set by shared content check)
      if (!pendingAutoProcess || hasAutoProcessed.current || !isNativeIOS()) {
        console.log('[AutoProcess] Skipping - pending:', !!pendingAutoProcess, 'processed:', hasAutoProcessed.current, 'native:', isNativeIOS())
        return
      }

      // Wait for user to be available
      if (!user) {
        console.log('[AutoProcess] Waiting for user to be available...')
        return
      }

      // Prevent duplicate processing
      hasAutoProcessed.current = true
      setIsAutoProcessing(true)

      const intent = pendingAutoProcess.intent
      console.log('[AutoProcess] Starting auto-processing with intent:', intent)

      try {
        // Get shared content (includes the intent saved by share extension)
        const content = await getSharedContent()
        console.log('[AutoProcess] Shared content:', JSON.stringify(content, null, 2))

        if (!content.hasContent) {
          console.log('[AutoProcess] No shared content found')
          await NotificationTemplates.processingError()
          setPendingAutoProcess(null)
          return
        }

        if (intent === 'task') {
          await processAsTask(content)
        } else if (intent === 'calendar') {
          await processAsCalendar(content)
        }

        // Clear shared content
        await clearSharedContent()
        console.log('[AutoProcess] Cleared shared content')

      } catch (error) {
        console.error('[AutoProcess] Error:', error)
        await NotificationTemplates.processingError()
      } finally {
        setIsAutoProcessing(false)
        setPendingAutoProcess(null)
        // Reset the ref so future shares can be processed
        // Use a small delay to prevent immediate re-processing
        setTimeout(() => {
          hasAutoProcessed.current = false
          console.log('[AutoProcess] Reset hasAutoProcessed for future shares')
        }, 1000)
      }
    }

    // Process as Task
    const processAsTask = async (content: { texts?: string[]; images?: string[] }) => {
      console.log('[AutoProcess:Task] Starting task processing')
      console.log('[AutoProcess:Task] isNativeIOS:', isNativeIOS())
      const text = content.texts?.join('\n') || ''
      if (!text) {
        console.log('[AutoProcess:Task] No text content found')
        const notifResult = await NotificationTemplates.parseFailed('task')
        console.log('[AutoProcess:Task] Parse failed notification result:', notifResult)
        return
      }
      console.log('[AutoProcess:Task] Text to process:', text.substring(0, 100))

      try {
        // Use session from context (more reliable than getSession)
        const token = session?.access_token
        console.log('[AutoProcess:Task] Auth token available:', !!token, 'Session exists:', !!session)

        if (!token) {
          // Create simple task without AI parsing
          console.log('[AutoProcess:Task] No token, creating simple task')
          const { data: task, error } = await supabase
            .from('tasks')
            .insert({
              title: text.length > 100 ? text.substring(0, 97) + '...' : text,
              raw_input: text,
              user_id: user?.id,
              ai_parsed: false,
            })
            .select()
            .single()

          if (error) {
            console.error('[AutoProcess:Task] Supabase insert error:', error)
            throw error
          }

          console.log('[AutoProcess:Task] Task created:', task?.id)
          const notifResult = await NotificationTemplates.taskCreated(task?.title || text.substring(0, 50))
          console.log('[AutoProcess:Task] Notification result:', notifResult)
          return
        }

        // Parse with AI
        console.log('[AutoProcess:Task] Calling AI parse API')
        const parseResponse = await fetch('/api/tasks/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        })

        if (!parseResponse.ok) {
          const errorText = await parseResponse.text()
          console.error('[AutoProcess:Task] Parse API error:', parseResponse.status, errorText)
          throw new Error('Failed to parse task')
        }

        const parseData = await parseResponse.json()
        console.log('[AutoProcess:Task] Parse result:', JSON.stringify(parseData, null, 2))
        const createdTasks: string[] = []

        if (parseData.tasks && parseData.tasks.length > 0) {
          for (const parsedTask of parseData.tasks) {
            console.log('[AutoProcess:Task] Creating task:', parsedTask.title)
            const { data: task, error } = await supabase
              .from('tasks')
              .insert({
                title: parsedTask.title,
                description: parsedTask.description,
                raw_input: text,
                user_id: user?.id,
                assignee_id: parsedTask.assignee_match?.id || null,
                due_date: parsedTask.due_date,
                due_time: parsedTask.due_time,
                due_context: parsedTask.due_context,
                urgency: parsedTask.urgency,
                ai_parsed: true,
                ai_confidence: parseData.confidence,
              })
              .select()
              .single()

            if (error) {
              console.error('[AutoProcess:Task] Insert error for task:', error)
            }
            if (!error && task) {
              console.log('[AutoProcess:Task] Task inserted:', task.id)
              createdTasks.push(task.title)
            }
          }
        }

        if (createdTasks.length === 0) {
          // Create simple task
          console.log('[AutoProcess:Task] No AI tasks, creating simple task')
          const { data: task, error } = await supabase
            .from('tasks')
            .insert({
              title: text.length > 100 ? text.substring(0, 97) + '...' : text,
              raw_input: text,
              user_id: user?.id,
              ai_parsed: false,
            })
            .select()
            .single()

          if (error) {
            console.error('[AutoProcess:Task] Simple task insert error:', error)
          }
          console.log('[AutoProcess:Task] Simple task created:', task?.id)
          const nr1 = await NotificationTemplates.taskCreated(task?.title || text.substring(0, 50))
          console.log('[AutoProcess:Task] Notification result:', nr1)
        } else if (createdTasks.length === 1) {
          console.log('[AutoProcess:Task] Sending single task notification')
          const nr2 = await NotificationTemplates.taskCreated(createdTasks[0])
          console.log('[AutoProcess:Task] Notification result:', nr2)
        } else {
          console.log('[AutoProcess:Task] Sending multi-task notification:', createdTasks.length)
          const nr3 = await NotificationTemplates.tasksCreated(createdTasks.length)
          console.log('[AutoProcess:Task] Notification result:', nr3)
        }
      } catch (error) {
        console.error('[AutoProcess:Task] Task processing error:', error)
        const nr4 = await NotificationTemplates.parseFailed('task')
        console.log('[AutoProcess:Task] Error notification result:', nr4)
      }
    }

    // Process as Calendar
    const processAsCalendar = async (content: { texts?: string[]; images?: string[] }) => {
      console.log('[AutoProcess:Calendar] Starting calendar processing')
      console.log('[AutoProcess:Calendar] isNativeIOS:', isNativeIOS())
      const images = content.images || []
      const text = content.texts?.join('\n') || ''

      console.log('[AutoProcess:Calendar] Images count:', images.length, 'Text length:', text.length)
      if (images.length === 0 && !text) {
        console.log('[AutoProcess:Calendar] No content to process')
        const nr = await NotificationTemplates.parseFailed('event')
        console.log('[AutoProcess:Calendar] No content notification result:', nr)
        return
      }

      try {
        // Get AI model from settings
        const savedSettings = localStorage.getItem('family-hub-settings')
        const aiModel = savedSettings ? JSON.parse(savedSettings).ai_model || 'gemini-2.0-flash' : 'gemini-2.0-flash'
        console.log('[AutoProcess:Calendar] Using AI model:', aiModel)

        // Call calendar AI
        console.log('[AutoProcess:Calendar] Calling calendar AI API')
        const response = await fetch('/api/calendar-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text || undefined,
            image: images.length === 1 ? images[0] : undefined,
            images: images.length > 1 ? images : undefined,
            model: aiModel,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[AutoProcess:Calendar] API error:', response.status, errorText)
          throw new Error('Failed to process calendar content')
        }

        const data = await response.json()
        console.log('[AutoProcess:Calendar] API response:', JSON.stringify(data, null, 2))
        const createdEvents: string[] = []

        if (data.events && data.events.length > 0) {
          console.log('[AutoProcess:Calendar] Found', data.events.length, 'events to create')
          for (const event of data.events) {
            console.log('[AutoProcess:Calendar] Creating event:', event.title)
            const startDateTime = event.all_day
              ? `${event.start_date}T00:00:00`
              : `${event.start_date}T${event.start_time || '09:00'}:00`

            const endDateTime = event.all_day || !event.end_time
              ? null
              : `${event.end_date || event.start_date}T${event.end_time}:00`

            const { data: insertedEvent, error } = await supabase
              .from('calendar_events')
              .insert({
                title: event.title,
                description: event.description || null,
                start_time: new Date(startDateTime).toISOString(),
                end_time: endDateTime ? new Date(endDateTime).toISOString() : null,
                all_day: event.all_day,
                color: event.color || '#3b82f6',
                location: event.location || null,
                source: 'manual', // TODO: Change to 'ai' after running migration 028
                user_id: user?.id,
              })
              .select()
              .single()

            if (error) {
              console.error('[AutoProcess:Calendar] Insert error:', error)
            }
            if (!error && insertedEvent) {
              console.log('[AutoProcess:Calendar] Event created:', insertedEvent.id)
              createdEvents.push(insertedEvent.title)
            }
          }
        } else {
          console.log('[AutoProcess:Calendar] No events found in AI response')
        }

        if (createdEvents.length === 0) {
          console.log('[AutoProcess:Calendar] No events created, sending failure notification')
          const nr1 = await NotificationTemplates.parseFailed('event')
          console.log('[AutoProcess:Calendar] Notification result:', nr1)
        } else if (createdEvents.length === 1) {
          console.log('[AutoProcess:Calendar] Sending single event notification')
          const nr2 = await NotificationTemplates.eventCreated(createdEvents[0])
          console.log('[AutoProcess:Calendar] Notification result:', nr2)
        } else {
          console.log('[AutoProcess:Calendar] Sending multi-event notification:', createdEvents.length)
          const nr3 = await NotificationTemplates.eventsCreated(createdEvents.length)
          console.log('[AutoProcess:Calendar] Notification result:', nr3)
        }
      } catch (error) {
        console.error('[AutoProcess:Calendar] Calendar processing error:', error)
        const nr4 = await NotificationTemplates.parseFailed('event')
        console.log('[AutoProcess:Calendar] Error notification result:', nr4)
      }
    }

    // Only auto-process when app is ready, user is available, and we have pending work
    if (appReady && !loading && user && pendingAutoProcess) {
      console.log('[AutoProcess] Triggering auto-process - appReady:', appReady, 'loading:', loading, 'user:', !!user, 'session:', !!session, 'pending:', !!pendingAutoProcess)
      autoProcessSharedContent()
    }
  }, [appReady, loading, user, session, pendingAutoProcess])

  // Dismiss keyboard when tapping outside inputs
  const handleMainClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Don't dismiss if clicking on an input or interactive element
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return
    }
    // Dismiss keyboard if clicking on main content area
    if (isNative) {
      dismissKeyboard()
    }
  }, [isNative])

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
        <main
          className={`flex-1 ${sidebarMargin} pb-20 lg:pb-0 ${mainPadding} overflow-x-hidden`}
          onClick={handleMainClick}
        >
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
