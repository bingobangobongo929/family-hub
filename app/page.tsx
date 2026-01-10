'use client'

import { useState, useEffect } from 'react'
import Card, { CardHeader } from '@/components/Card'
import { Calendar, CheckSquare, ShoppingCart, StickyNote, Clock, Sun, Moon } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { type ShoppingListItem, type ShoppingList, getCategoryConfig } from '@/lib/database.types'

const upcomingEvents = [
  { id: 1, title: "Olivia's Playgroup", time: "10:00 AM", color: "bg-purple-500" },
  { id: 2, title: "Ellie's Nap Time", time: "1:00 PM", color: "bg-green-500" },
  { id: 3, title: "Family Swim Class", time: "Tomorrow 9:30 AM", color: "bg-pink-500" },
]

const recentTasks = [
  { id: 1, title: "Prepare Olivia's lunch box", assignee: "Mum", done: true },
  { id: 2, title: "Restock nappies", assignee: "Dad", done: false },
  { id: 3, title: "Book GP appointment for Ellie", assignee: "Mum", done: false },
  { id: 4, title: "Fix baby gate", assignee: "Dad", done: false },
]

// Morning and evening routines for the kids
const defaultRoutines = {
  morning: [
    { id: 'm1', title: 'Get dressed', for: 'both' },
    { id: 'm2', title: 'Brush teeth', for: 'Olivia' },
    { id: 'm3', title: 'Eat breakfast', for: 'both' },
    { id: 'm4', title: 'Tidy living room', for: 'Olivia' },
  ],
  evening: [
    { id: 'e1', title: 'Tidy living room', for: 'Olivia' },
    { id: 'e2', title: 'Bath time', for: 'both' },
    { id: 'e3', title: 'Put on pyjamas', for: 'both' },
    { id: 'e4', title: 'Brush teeth', for: 'Olivia' },
    { id: 'e5', title: 'Bedtime story', for: 'both' },
  ],
}

export default function Dashboard() {
  const { user } = useAuth()
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([])
  const [shoppingLoading, setShoppingLoading] = useState(true)
  const [routineTime, setRoutineTime] = useState<'morning' | 'evening'>(() => {
    const hour = new Date().getHours()
    return hour < 14 ? 'morning' : 'evening'
  })
  const [completedRoutines, setCompletedRoutines] = useState<Set<string>>(new Set())

  const completedTasks = recentTasks.filter(t => t.done).length
  const totalTasks = recentTasks.length

  useEffect(() => {
    const fetchShopping = async () => {
      if (!user) {
        setShoppingLoading(false)
        return
      }

      try {
        const { data: listData } = await supabase
          .from('shopping_lists')
          .select('*')
          .limit(1)

        const list = (listData as ShoppingList[] | null)?.[0]

        if (list) {
          const { data: items } = await supabase
            .from('shopping_list_items')
            .select('*')
            .eq('list_id', list.id)
            .eq('is_checked', false)
            .order('created_at', { ascending: false })
            .limit(8)

          setShoppingItems((items as ShoppingListItem[] | null) || [])
        }
      } catch (error) {
        console.error('Error fetching shopping:', error)
      }
      setShoppingLoading(false)
    }

    fetchShopping()
  }, [user])

  // Load completed routines from localStorage
  useEffect(() => {
    const today = new Date().toDateString()
    const saved = localStorage.getItem('routines-' + today)
    if (saved) {
      setCompletedRoutines(new Set(JSON.parse(saved)))
    }
  }, [])

  const toggleRoutine = (id: string) => {
    const newCompleted = new Set(completedRoutines)
    if (newCompleted.has(id)) {
      newCompleted.delete(id)
    } else {
      newCompleted.add(id)
    }
    setCompletedRoutines(newCompleted)
    // Save to localStorage with today's date (resets daily)
    const today = new Date().toDateString()
    localStorage.setItem('routines-' + today, JSON.stringify([...newCompleted]))
  }

  const currentRoutines = defaultRoutines[routineTime]
  const routineProgress = currentRoutines.filter(r => completedRoutines.has(r.id)).length
  const uncheckedCount = shoppingItems.length

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Welcome back!</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Here's what's happening with your family today.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link href="/calendar">
          <Card className="bg-gradient-to-br from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 transition-all cursor-pointer">
            <div className="flex items-center gap-4">
              <Calendar className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-primary-100 text-sm">Events</p>
                <p className="text-2xl font-bold">3</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/tasks">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-all cursor-pointer">
            <div className="flex items-center gap-4">
              <CheckSquare className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-green-100 text-sm">Tasks</p>
                <p className="text-2xl font-bold">{completedTasks}/{totalTasks}</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/shopping">
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 transition-all cursor-pointer">
            <div className="flex items-center gap-4">
              <ShoppingCart className="w-8 h-8 opacity-80" />
              <div>
                <p className="text-orange-100 text-sm">Shopping</p>
                <p className="text-2xl font-bold">{shoppingLoading ? '...' : uncheckedCount}</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/routines">
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-all cursor-pointer">
            <div className="flex items-center gap-4">
              {routineTime === 'morning' ? <Sun className="w-8 h-8 opacity-80" /> : <Moon className="w-8 h-8 opacity-80" />}
              <div>
                <p className="text-purple-100 text-sm">Routines</p>
                <p className="text-2xl font-bold">{routineProgress}/{currentRoutines.length}</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Kids Routines - Prominent placement */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <CardHeader
              title={routineTime === 'morning' ? "Morning Routine" : "Evening Routine"}
              icon={routineTime === 'morning' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRoutineTime('morning')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  routineTime === 'morning'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Sun className="w-4 h-4 inline mr-1" />
                Morning
              </button>
              <button
                onClick={() => setRoutineTime('evening')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  routineTime === 'evening'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Moon className="w-4 h-4 inline mr-1" />
                Evening
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {currentRoutines.map((routine) => {
              const isDone = completedRoutines.has(routine.id)
              return (
                <button
                  key={routine.id}
                  onClick={() => toggleRoutine(routine.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    isDone
                      ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-300 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                    isDone ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-600'
                  }`}>
                    {isDone ? '✓' : '○'}
                  </div>
                  <span className="text-sm font-medium text-center">{routine.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    routine.for === 'Olivia' ? 'bg-purple-100 text-purple-600' :
                    routine.for === 'Ellie' ? 'bg-green-100 text-green-600' :
                    'bg-pink-100 text-pink-600'
                  }`}>
                    {routine.for === 'both' ? 'Both' : routine.for}
                  </span>
                </button>
              )
            })}
          </div>
          {routineProgress === currentRoutines.length && (
            <div className="mt-4 p-3 rounded-xl bg-green-100 text-green-700 text-center font-medium">
              All done! Great job everyone! 🎉
            </div>
          )}
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader
            title="Upcoming Events"
            icon={<Clock className="w-5 h-5" />}
            action={
              <Link href="/calendar" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
                View all
              </Link>
            }
          />
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href="/calendar"
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <div className={`w-2 h-10 rounded-full ${event.color}`} />
                <div className="flex-1">
                  <p className="font-medium text-slate-700 dark:text-slate-200">{event.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{event.time}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader
            title="Family Tasks"
            icon={<CheckSquare className="w-5 h-5" />}
            action={
              <Link href="/tasks" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
                View all
              </Link>
            }
          />
          <div className="space-y-2">
            {recentTasks.map((task) => (
              <Link
                key={task.id}
                href="/tasks"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                  task.done
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {task.done && <span className="text-xs">✓</span>}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${task.done ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                    {task.title}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {task.assignee}
                </span>
              </Link>
            ))}
          </div>
        </Card>

        {/* Shopping List */}
        <Card>
          <CardHeader
            title="Shopping List"
            icon={<ShoppingCart className="w-5 h-5" />}
            action={
              <Link href="/shopping" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
                View all
              </Link>
            }
          />
          {shoppingLoading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>
          ) : shoppingItems.length > 0 ? (
            <Link href="/shopping" className="flex flex-wrap gap-2 cursor-pointer">
              {shoppingItems.map((item) => {
                const config = getCategoryConfig(item.category)
                return (
                  <span
                    key={item.id}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity ${config.color}`}
                  >
                    {config.emoji} {item.item_name}
                  </span>
                )
              })}
            </Link>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No items to buy</p>
          )}
        </Card>

        {/* Quick Notes */}
        <Card>
          <CardHeader
            title="Quick Notes"
            icon={<StickyNote className="w-5 h-5" />}
            action={
              <Link href="/notes" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
                View all
              </Link>
            }
          />
          <div className="space-y-2">
            <Link href="/notes" className="block p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors cursor-pointer">
              <p className="text-sm text-slate-700 dark:text-slate-200">Olivia's 3rd birthday party on Saturday - cake ordered from bakery!</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">- Mum</p>
            </Link>
            <Link href="/notes" className="block p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer">
              <p className="text-sm text-slate-700 dark:text-slate-200">Health visitor coming Thursday 10am</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">- Dad</p>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
