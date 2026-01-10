'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Card, { CardHeader } from '@/components/Card'
import { ClockWidget, WeatherWidget, ScheduleWidget, ChoresWidget, StarsWidget, NotesWidget } from '@/components/widgets'
import { Calendar, CheckSquare, ShoppingCart, Gift, Sun, Moon, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useFamily } from '@/lib/family-context'
import { type ShoppingListItem, type ShoppingList, getCategoryConfig, Chore, CalendarEvent, Routine, RoutineStep } from '@/lib/database.types'

export default function Dashboard() {
  const { user } = useAuth()
  const { members } = useFamily()
  const [shoppingCount, setShoppingCount] = useState(0)
  const [choreStats, setChoreStats] = useState({ completed: 0, total: 0 })
  const [eventCount, setEventCount] = useState(0)
  const [loading, setLoading] = useState(true)

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
        // Shopping count
        const { data: listData } = await supabase
          .from('shopping_lists')
          .select('id')
          .limit(1)

        if (listData?.[0]) {
          const { count } = await supabase
            .from('shopping_list_items')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', listData[0].id)
            .eq('is_checked', false)

          setShoppingCount(count || 0)
        }

        // Chore stats
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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Good {getTimeOfDay()}!</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Here's what's happening with your family today.</p>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link href="/calendar">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-sage-500 to-sage-600 text-white hover:from-sage-600 hover:to-sage-700 transition-all cursor-pointer shadow-md hover:shadow-lg">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-sage-100 text-sm">Today</p>
                <p className="text-2xl font-bold">{loading ? '...' : eventCount} events</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/tasks">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all cursor-pointer shadow-md hover:shadow-lg">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-emerald-100 text-sm">Chores</p>
                <p className="text-2xl font-bold">{loading ? '...' : `${choreStats.completed}/${choreStats.total}`}</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/shopping">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition-all cursor-pointer shadow-md hover:shadow-lg">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-amber-100 text-sm">Shopping</p>
                <p className="text-2xl font-bold">{loading ? '...' : shoppingCount} items</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/rewards">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all cursor-pointer shadow-md hover:shadow-lg">
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-purple-100 text-sm">Total Stars</p>
                <p className="text-2xl font-bold">{totalStars}</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Row 1 */}
        <div className="h-48">
          <ClockWidget />
        </div>

        <div className="h-48">
          <WeatherWidget />
        </div>

        <div className="h-48">
          <StarsWidget />
        </div>

        {/* Row 2 */}
        <div className="h-64 lg:col-span-2">
          <ScheduleWidget />
        </div>

        <div className="h-64">
          <ChoresWidget />
        </div>

        {/* Row 3 */}
        <div className="h-48 lg:col-span-2">
          <QuickRoutineWidget />
        </div>

        <div className="h-48">
          <NotesWidget />
        </div>
      </div>
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
    <div className="h-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {routineTime === 'morning' ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-500" />
          )}
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            {routineTime === 'morning' ? 'Morning' : 'Evening'} Routine
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRoutineTime('morning')}
            className={`p-1.5 rounded-lg ${routineTime === 'morning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' : 'text-slate-400'}`}
          >
            <Sun className="w-4 h-4" />
          </button>
          <button
            onClick={() => setRoutineTime('evening')}
            className={`p-1.5 rounded-lg ${routineTime === 'evening' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-slate-400'}`}
          >
            <Moon className="w-4 h-4" />
          </button>
          <span className="ml-2 text-xs text-slate-500">{progress}/{steps.length}</span>
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
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="text-xl">{isDone ? '✓' : step.emoji}</span>
                <span className="text-xs truncate w-full text-center">{step.title}</span>
              </button>
            )
          })}
        </div>
      </div>

      {progress === steps.length && (
        <div className="mt-2 text-center text-sm text-green-600 dark:text-green-400 font-medium">
          All done! Great job!
        </div>
      )}

      <Link
        href="/routines"
        className="mt-2 text-center text-xs text-sage-600 dark:text-sage-400 hover:text-sage-700 dark:hover:text-sage-300"
      >
        View full routines
      </Link>
    </div>
  )
}
