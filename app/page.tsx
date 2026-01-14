'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Responsive, WidthProvider, Layout } from 'react-grid-layout'
import {
  ClockWidget,
  WeatherWidget,
  ScheduleWidget,
  ChoresWidget,
  StarsWidget,
  NotesWidget,
  CountdownWidget,
  MealPlanWidget,
  AnnouncementsWidget,
  QuickActionsWidget,
  PhotoWidget,
  ShoppingWidget,
  TimerWidget,
  BindicatorWidget,
  GooglePhotosWidget,
  F1Widget,
  AVAILABLE_WIDGETS,
  DEFAULT_LAYOUT,
} from '@/components/widgets'
import { Calendar, CheckSquare, ShoppingCart, Star, Edit3, X, Plus, Trash2, RotateCcw, Sun, Moon } from 'lucide-react'
import { supabase, recipeVaultSupabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { useSettings } from '@/lib/settings-context'
import { useEditMode } from '@/lib/edit-mode-context'
import { DEFAULT_SETTINGS, DASHBOARD_GRADIENTS } from '@/lib/database.types'
import { useTranslation } from '@/lib/i18n-context'

const ResponsiveGridLayout = WidthProvider(Responsive)

// Map widget IDs to components
const WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = {
  clock: ClockWidget,
  weather: WeatherWidget,
  schedule: ScheduleWidget,
  chores: ChoresWidget,
  stars: StarsWidget,
  notes: NotesWidget,
  countdown: CountdownWidget,
  meals: MealPlanWidget,
  announcements: AnnouncementsWidget,
  quickactions: QuickActionsWidget,
  photo: PhotoWidget,
  routine: QuickRoutineWidget,
  shopping: ShoppingWidget,
  timer: TimerWidget,
  bindicator: BindicatorWidget,
  googlephotos: GooglePhotosWidget,
  f1: F1Widget,
}

const STORAGE_KEY = 'family-hub-widget-layout'
const ACTIVE_WIDGETS_KEY = 'family-hub-active-widgets'

export default function Dashboard() {
  const { user } = useAuth()
  const { members } = useFamily()
  const { rewardsEnabled } = useSettings()
  const { isEditMode, setIsEditMode } = useEditMode()
  const { t } = useTranslation()
  const [shoppingCount, setShoppingCount] = useState(0)
  const [choreStats, setChoreStats] = useState({ completed: 0, total: 0 })
  const [eventCount, setEventCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showWidgetPicker, setShowWidgetPicker] = useState(false)
  const [layouts, setLayouts] = useState<{ lg: Layout[] }>({ lg: DEFAULT_LAYOUT })
  const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_LAYOUT.map(l => l.i))
  const [mounted, setMounted] = useState(false)
  const [backgroundGradient, setBackgroundGradient] = useState<string>('default')

  // Load saved layout on mount
  useEffect(() => {
    setMounted(true)
    const savedLayout = localStorage.getItem(STORAGE_KEY)
    const savedWidgets = localStorage.getItem(ACTIVE_WIDGETS_KEY)
    const savedSettings = localStorage.getItem('family-hub-settings')

    if (savedLayout) {
      try {
        setLayouts(JSON.parse(savedLayout))
      } catch (e) {
        console.error('Failed to parse saved layout')
      }
    }

    if (savedWidgets) {
      try {
        setActiveWidgets(JSON.parse(savedWidgets))
      } catch (e) {
        console.error('Failed to parse saved widgets')
      }
    }

    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings)
        if (settings.dashboard_gradient) {
          setBackgroundGradient(settings.dashboard_gradient)
        }
      } catch (e) {
        console.error('Failed to parse saved settings')
      }
    }
  }, [])

  // Save layout changes
  const handleLayoutChange = useCallback((currentLayout: Layout[], allLayouts: { lg: Layout[] }) => {
    if (!mounted) return
    setLayouts(allLayouts)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts))
  }, [mounted])

  // Add widget
  const addWidget = useCallback((widgetId: string) => {
    if (activeWidgets.includes(widgetId)) return

    const widgetConfig = AVAILABLE_WIDGETS.find(w => w.id === widgetId)
    if (!widgetConfig) return

    const newLayout: Layout = {
      i: widgetId,
      x: 0,
      y: Infinity, // Place at bottom
      w: widgetConfig.defaultSize.w,
      h: widgetConfig.defaultSize.h,
      minW: widgetConfig.minSize.w,
      minH: widgetConfig.minSize.h,
    }

    const newActiveWidgets = [...activeWidgets, widgetId]
    const newLayouts = {
      lg: [...layouts.lg, newLayout]
    }

    setActiveWidgets(newActiveWidgets)
    setLayouts(newLayouts)
    localStorage.setItem(ACTIVE_WIDGETS_KEY, JSON.stringify(newActiveWidgets))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayouts))
    setShowWidgetPicker(false)
  }, [activeWidgets, layouts])

  // Remove widget
  const removeWidget = useCallback((widgetId: string) => {
    const newActiveWidgets = activeWidgets.filter(w => w !== widgetId)
    const newLayouts = {
      lg: layouts.lg.filter(l => l.i !== widgetId)
    }

    setActiveWidgets(newActiveWidgets)
    setLayouts(newLayouts)
    localStorage.setItem(ACTIVE_WIDGETS_KEY, JSON.stringify(newActiveWidgets))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayouts))
  }, [activeWidgets, layouts])

  // Reset to default
  const resetLayout = useCallback(() => {
    const defaultWidgets = DEFAULT_LAYOUT.map(l => l.i)
    setActiveWidgets(defaultWidgets)
    setLayouts({ lg: DEFAULT_LAYOUT })
    localStorage.setItem(ACTIVE_WIDGETS_KEY, JSON.stringify(defaultWidgets))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lg: DEFAULT_LAYOUT }))
  }, [])

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split('T')[0]

      if (!user) {
        // Demo mode stats
        setShoppingCount(6)
        setChoreStats({ completed: 2, total: 5 })
        setEventCount(3)
        setLoading(false)
        return
      }

      try {
        // Shopping count (from Recipe Vault database)
        const recipeVaultUrl = process.env.NEXT_PUBLIC_RECIPE_VAULT_SUPABASE_URL
        const isRecipeVaultConfigured = recipeVaultUrl && recipeVaultUrl !== '' && recipeVaultUrl !== 'your-supabase-url'

        if (isRecipeVaultConfigured) {
          const { data: listData } = await recipeVaultSupabase
            .from('shopping_lists')
            .select('id')
            .limit(1)

          if (listData?.[0]) {
            const { count } = await recipeVaultSupabase
              .from('shopping_list_items')
              .select('*', { count: 'exact', head: true })
              .eq('list_id', listData[0].id)
              .eq('is_checked', false)

            setShoppingCount(count || 0)
          } else {
            // No list found, use demo count
            setShoppingCount(6)
          }
        } else {
          // Recipe Vault not configured, use demo count
          setShoppingCount(6)
        }

        // Chore stats (from Family Hub database)
        const { data: chores } = await supabase
          .from('chores')
          .select('status')
          .or(`due_date.is.null,due_date.eq.${today}`)

        if (chores) {
          setChoreStats({
            completed: chores.filter(c => c.status === 'completed').length,
            total: chores.length
          })
        }

        // Event count
        const { count: evtCount } = await supabase
          .from('calendar_events')
          .select('*', { count: 'exact', head: true })
          .gte('start_time', today + 'T00:00:00')
          .lte('start_time', today + 'T23:59:59')

        setEventCount(evtCount || 0)

      } catch (error) {
        console.error('Error fetching stats:', error)
      }
      setLoading(false)
    }

    fetchStats()
  }, [user])

  // Get kids' total stars
  const totalStars = members
    .filter(m => m.role === 'child')
    .reduce((acc, m) => acc + m.points, 0)

  // Available widgets that aren't active
  const availableToAdd = AVAILABLE_WIDGETS.filter(w => !activeWidgets.includes(w.id))

  // Get gradient class
  const gradientConfig = DASHBOARD_GRADIENTS.find(g => g.id === backgroundGradient)
  const gradientClass = gradientConfig?.class || ''

  if (!mounted) {
    return <div className="max-w-7xl mx-auto animate-pulse">{t('common.loading')}</div>
  }

  return (
    <div className={`max-w-7xl mx-auto ${gradientClass ? `-mx-4 -mt-4 px-4 pt-4 pb-8 min-h-screen bg-gradient-to-br ${gradientClass}` : ''}`}>
      {/* Header - with left padding on mobile for hamburger menu */}
      <div className="mb-8 pl-14 lg:pl-0">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-800 dark:text-slate-100">
          {t(`dashboard.greeting.${getTimeOfDay()}`)}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link href="/calendar">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 transition-all cursor-pointer shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/30 hover:-translate-y-0.5">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 opacity-90" />
              <div>
                <p className="text-teal-100 text-sm font-medium">{t('common.today')}</p>
                <p className="text-2xl font-bold">{loading ? '...' : t('dashboard.stats.events', { count: eventCount })}</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/tasks">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-8 h-8 opacity-90" />
              <div>
                <p className="text-emerald-100 text-sm font-medium">{t('chores.title')}</p>
                <p className="text-2xl font-bold">{loading ? '...' : `${choreStats.completed}/${choreStats.total}`}</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/shopping">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-coral-400 to-coral-500 text-white hover:from-coral-500 hover:to-coral-600 transition-all cursor-pointer shadow-lg shadow-coral-500/20 hover:shadow-xl hover:shadow-coral-500/30 hover:-translate-y-0.5">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 opacity-90" />
              <div>
                <p className="text-coral-100 text-sm font-medium">{t('shopping.title')}</p>
                <p className="text-2xl font-bold">{loading ? '...' : t('dashboard.stats.items', { count: shoppingCount })}</p>
              </div>
            </div>
          </div>
        </Link>

        {rewardsEnabled ? (
          <Link href="/rewards">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all cursor-pointer shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <Star className="w-8 h-8 opacity-90" />
                <div>
                  <p className="text-purple-100 text-sm font-medium">{t('dashboard.stats.totalStars')}</p>
                  <p className="text-2xl font-bold">{totalStars}</p>
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/notes">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all cursor-pointer shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <Star className="w-8 h-8 opacity-90" />
                <div>
                  <p className="text-purple-100 text-sm font-medium">{t('nav.family')}</p>
                  <p className="text-2xl font-bold">{members.length}</p>
                </div>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Edit Mode Toolbar */}
      {isEditMode && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-2xl border border-teal-200/50 dark:border-teal-800/50">
          <button
            onClick={() => setShowWidgetPicker(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-xl text-sm font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('dashboard.addWidget')}
          </button>
          <button
            onClick={resetLayout}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            {t('dashboard.resetLayout')}
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
            {t('dashboard.editModeHint')}
          </span>
        </div>
      )}

      {/* Widget Grid */}
      <div className={isEditMode ? 'edit-mode' : ''}>
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 6, md: 4, sm: 2, xs: 2, xxs: 1 }}
          rowHeight={100}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          onLayoutChange={handleLayoutChange}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          useCSSTransforms={true}
        >
          {activeWidgets.map(widgetId => {
            const WidgetComponent = WIDGET_COMPONENTS[widgetId]
            if (!WidgetComponent) return null

            return (
              <div key={widgetId} className="relative">
                <div className="h-full">
                  <WidgetComponent />
                </div>
                {isEditMode && (
                  <button
                    onClick={() => removeWidget(widgetId)}
                    className="absolute top-2 right-2 w-6 h-6 bg-coral-500 text-white rounded-full flex items-center justify-center hover:bg-coral-600 transition-colors z-10 shadow-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </ResponsiveGridLayout>
      </div>

      {/* Widget Picker Modal */}
      {showWidgetPicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-slate-800 dark:text-slate-100">{t('dashboard.addWidget')}</h2>
              <button
                onClick={() => setShowWidgetPicker(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              {availableToAdd.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  {t('dashboard.allWidgetsAdded')}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {availableToAdd.map(widget => (
                    <button
                      key={widget.id}
                      onClick={() => addWidget(widget.id)}
                      className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:ring-2 hover:ring-teal-500/20 transition-all text-left"
                    >
                      <span className="text-2xl">{widget.icon}</span>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{widget.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {widget.defaultSize.w}x{widget.defaultSize.h}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function
function getTimeOfDay() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

// Quick Routine Widget (inline for dashboard)
function QuickRoutineWidget() {
  const { t } = useTranslation()
  const [routineTime, setRoutineTime] = useState<'morning' | 'evening'>(() => {
    const hour = new Date().getHours()
    return hour < 14 ? 'morning' : 'evening'
  })
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  // Demo routine steps
  const steps = routineTime === 'morning'
    ? [
        { id: 'ms1', title: 'Get dressed', emoji: '👕' },
        { id: 'ms2', title: 'Brush teeth', emoji: '🪥' },
        { id: 'ms3', title: 'Eat breakfast', emoji: '🥣' },
        { id: 'ms4', title: 'Tidy bedroom', emoji: '🛏️' },
      ]
    : [
        { id: 'es1', title: 'Tidy up', emoji: '🧹' },
        { id: 'es2', title: 'Bath time', emoji: '🛁' },
        { id: 'es3', title: 'Pyjamas', emoji: '👚' },
        { id: 'es4', title: 'Brush teeth', emoji: '🪥' },
        { id: 'es5', title: 'Story', emoji: '📖' },
      ]

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const saved = localStorage.getItem('routine-completions-' + today)
    if (saved) {
      setCompletedSteps(new Set(JSON.parse(saved)))
    }
  }, [])

  const toggleStep = (id: string) => {
    const newCompleted = new Set(completedSteps)
    if (newCompleted.has(id)) {
      newCompleted.delete(id)
    } else {
      newCompleted.add(id)
    }
    setCompletedSteps(newCompleted)
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem('routine-completions-' + today, JSON.stringify([...newCompleted]))
  }

  const progress = steps.filter(s => completedSteps.has(s.id)).length

  return (
    <div className="h-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-widget dark:shadow-widget-dark">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {routineTime === 'morning' ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-500" />
          )}
          <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">
            {routineTime === 'morning' ? t('routines.morning') : t('routines.evening')} {t('routines.routine')}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRoutineTime('morning')}
            className={`p-1.5 rounded-lg transition-colors ${routineTime === 'morning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            <Sun className="w-4 h-4" />
          </button>
          <button
            onClick={() => setRoutineTime('evening')}
            className={`p-1.5 rounded-lg transition-colors ${routineTime === 'evening' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            <Moon className="w-4 h-4" />
          </button>
          <span className="ml-2 text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full">{progress}/{steps.length}</span>
        </div>
      </div>

      <div className="flex-1 flex items-center">
        <div className="w-full grid grid-cols-5 gap-2">
          {steps.slice(0, 5).map((step) => {
            const isDone = completedSteps.has(step.id)
            return (
              <button
                key={step.id}
                onClick={() => toggleStep(step.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  isDone
                    ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20'
                    : 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="text-xl">{isDone ? '✓' : step.emoji}</span>
                <span className="text-xs truncate w-full text-center font-medium">{step.title}</span>
              </button>
            )
          })}
        </div>
      </div>

      {progress === steps.length && (
        <div className="mt-2 text-center text-sm text-teal-600 dark:text-teal-400 font-medium">
          {t('routines.allDone')}
        </div>
      )}

      <Link
        href="/routines"
        className="mt-2 text-center text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
      >
        {t('routines.viewFull')}
      </Link>
    </div>
  )
}
