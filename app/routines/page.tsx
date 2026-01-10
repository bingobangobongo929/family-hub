'use client'

import { useState, useEffect } from 'react'
import Card, { CardHeader } from '@/components/Card'
import { Sun, Moon, RotateCcw } from 'lucide-react'

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

export default function RoutinesPage() {
  const [routineTime, setRoutineTime] = useState<'morning' | 'evening'>(() => {
    const hour = new Date().getHours()
    return hour < 14 ? 'morning' : 'evening'
  })
  const [completedRoutines, setCompletedRoutines] = useState<Set<string>>(new Set())

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
    const today = new Date().toDateString()
    localStorage.setItem('routines-' + today, JSON.stringify([...newCompleted]))
  }

  const resetRoutines = (time: 'morning' | 'evening') => {
    const newCompleted = new Set(completedRoutines)
    const routinesToReset = defaultRoutines[time]
    routinesToReset.forEach(r => newCompleted.delete(r.id))
    setCompletedRoutines(newCompleted)
    const today = new Date().toDateString()
    localStorage.setItem('routines-' + today, JSON.stringify([...newCompleted]))
  }

  const currentRoutines = defaultRoutines[routineTime]
  const routineProgress = currentRoutines.filter(r => completedRoutines.has(r.id)).length
  const morningProgress = defaultRoutines.morning.filter(r => completedRoutines.has(r.id)).length
  const eveningProgress = defaultRoutines.evening.filter(r => completedRoutines.has(r.id)).length

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Kids Routines</h1>
        <p className="text-slate-500 mt-1">Daily morning and evening checklists for Olivia and Ellie</p>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card
          className={`cursor-pointer transition-all ${routineTime === 'morning' ? 'ring-2 ring-amber-400' : ''}`}
          onClick={() => setRoutineTime('morning')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Sun className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-500">Morning</p>
              <p className="text-2xl font-bold text-slate-800">{morningProgress}/{defaultRoutines.morning.length}</p>
            </div>
            {morningProgress === defaultRoutines.morning.length && (
              <span className="text-2xl">✓</span>
            )}
          </div>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${routineTime === 'evening' ? 'ring-2 ring-indigo-400' : ''}`}
          onClick={() => setRoutineTime('evening')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Moon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-500">Evening</p>
              <p className="text-2xl font-bold text-slate-800">{eveningProgress}/{defaultRoutines.evening.length}</p>
            </div>
            {eveningProgress === defaultRoutines.evening.length && (
              <span className="text-2xl">✓</span>
            )}
          </div>
        </Card>
      </div>

      {/* Current Routine */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <CardHeader
            title={routineTime === 'morning' ? "Morning Routine" : "Evening Routine"}
            icon={routineTime === 'morning' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          />
          <button
            onClick={() => resetRoutines(routineTime)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>

        <div className="space-y-3">
          {currentRoutines.map((routine, index) => {
            const isDone = completedRoutines.has(routine.id)
            return (
              <button
                key={routine.id}
                onClick={() => toggleRoutine(routine.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  isDone
                    ? 'bg-green-50 border-green-300'
                    : 'bg-slate-50 border-slate-200 hover:border-primary-300 hover:bg-primary-50'
                }`}
              >
                <span className="text-lg font-medium text-slate-400 w-6">{index + 1}</span>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                  isDone ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  {isDone ? '✓' : '○'}
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-medium text-lg ${isDone ? 'text-green-700' : 'text-slate-700'}`}>
                    {routine.title}
                  </p>
                </div>
                <span className={`text-sm px-3 py-1 rounded-full ${
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
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 text-center">
            <p className="text-xl font-bold mb-1">All done! Great job everyone!</p>
            <p className="text-sm">Time for {routineTime === 'morning' ? 'a great day' : 'sweet dreams'}!</p>
          </div>
        )}
      </Card>

      {/* Tips Section */}
      <Card className="mt-6">
        <CardHeader title="Routine Tips" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
            <p className="font-medium text-purple-700 mb-1">Olivia (3 years)</p>
            <p className="text-sm text-purple-600">Can help pick out her own clothes and loves being a "big helper" with tidying!</p>
          </div>
          <div className="p-4 rounded-xl bg-green-50 border border-green-100">
            <p className="font-medium text-green-700 mb-1">Ellie (1 year)</p>
            <p className="text-sm text-green-600">Learning through watching! She loves bath time splashing and storytime cuddles.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
