'use client'

import { useState, useEffect } from 'react'
import { differenceInDays, differenceInHours, parseISO, format } from 'date-fns'
import { PartyPopper, Calendar, Gift, Plane, Star } from 'lucide-react'

interface CountdownEvent {
  id: string
  title: string
  date: string
  emoji: string
  type: 'birthday' | 'holiday' | 'event' | 'trip'
}

// Demo countdowns
const DEMO_COUNTDOWNS: CountdownEvent[] = [
  { id: '1', title: "Olivia's Birthday", date: getNextBirthday(3, 15), emoji: '🎂', type: 'birthday' },
  { id: '2', title: 'Summer Holiday', date: '2025-07-15', emoji: '✈️', type: 'trip' },
  { id: '3', title: 'Easter', date: '2025-04-20', emoji: '🐰', type: 'holiday' },
]

function getNextBirthday(month: number, day: number): string {
  const now = new Date()
  let year = now.getFullYear()
  const birthday = new Date(year, month - 1, day)
  if (birthday < now) {
    year++
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function CountdownWidget() {
  const [countdowns] = useState<CountdownEvent[]>(DEMO_COUNTDOWNS)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  // Get the nearest upcoming event
  const sortedCountdowns = [...countdowns]
    .map(c => ({ ...c, daysLeft: differenceInDays(parseISO(c.date), now) }))
    .filter(c => c.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const nextEvent = sortedCountdowns[0]
  const otherEvents = sortedCountdowns.slice(1, 3)

  if (!nextEvent) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
        <p className="text-slate-500 dark:text-slate-400">No upcoming events</p>
      </div>
    )
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'birthday': return 'from-pink-500 to-rose-500'
      case 'holiday': return 'from-amber-500 to-orange-500'
      case 'trip': return 'from-blue-500 to-cyan-500'
      default: return 'from-purple-500 to-indigo-500'
    }
  }

  return (
    <div className="h-full flex flex-col p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
      {/* Main countdown */}
      <div className={`flex-1 flex flex-col items-center justify-center text-center rounded-xl bg-gradient-to-br ${getTypeColor(nextEvent.type)} p-4 text-white`}>
        <span className="text-3xl mb-1">{nextEvent.emoji}</span>
        <p className="text-sm opacity-90 mb-1">{nextEvent.title}</p>
        <div className="text-4xl font-bold">
          {nextEvent.daysLeft === 0 ? (
            <span>Today!</span>
          ) : nextEvent.daysLeft === 1 ? (
            <span>Tomorrow!</span>
          ) : (
            <span>{nextEvent.daysLeft} days</span>
          )}
        </div>
        <p className="text-xs opacity-75 mt-1">
          {format(parseISO(nextEvent.date), 'EEEE, MMM d')}
        </p>
      </div>

      {/* Other upcoming */}
      {otherEvents.length > 0 && (
        <div className="mt-3 space-y-1">
          {otherEvents.map(event => (
            <div key={event.id} className="flex items-center gap-2 text-sm">
              <span>{event.emoji}</span>
              <span className="flex-1 text-slate-700 dark:text-slate-300 truncate">{event.title}</span>
              <span className="text-slate-500 dark:text-slate-400">{event.daysLeft}d</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
