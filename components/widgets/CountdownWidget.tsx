'use client'

import { useState, useEffect } from 'react'
import { differenceInDays, parseISO, format } from 'date-fns'
import { useWidgetSize } from '@/lib/useWidgetSize'

interface CountdownEvent {
  id: string
  title: string
  date: string
  emoji: string
  type: 'birthday' | 'holiday' | 'event' | 'trip'
}

// Family birthdays and events
const DEMO_COUNTDOWNS: CountdownEvent[] = [
  { id: '1', title: "Olivia's Birthday", date: getNextBirthday(12, 23), emoji: '🎂', type: 'birthday' },
  { id: '2', title: "Ellie's Birthday", date: getNextBirthday(9, 12), emoji: '🎂', type: 'birthday' },
  { id: '3', title: "Mum's Birthday", date: getNextBirthday(3, 28), emoji: '🎁', type: 'birthday' },
  { id: '4', title: "Ed's Birthday", date: getNextBirthday(5, 21), emoji: '🎁', type: 'birthday' },
  { id: '5', title: 'Christmas', date: getNextHoliday(12, 25), emoji: '🎄', type: 'holiday' },
  { id: '6', title: 'Easter', date: '2025-04-20', emoji: '🐰', type: 'holiday' },
]

function getNextHoliday(month: number, day: number): string {
  const now = new Date()
  let year = now.getFullYear()
  const holiday = new Date(year, month - 1, day)
  if (holiday < now) {
    year++
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

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
  const [ref, { size, isWide, isTall }] = useWidgetSize()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Get the nearest upcoming event
  const sortedCountdowns = [...countdowns]
    .map(c => ({ ...c, daysLeft: differenceInDays(parseISO(c.date), now) }))
    .filter(c => c.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const nextEvent = sortedCountdowns[0]

  // Number of secondary events based on size
  const secondaryCount = {
    small: 2,
    medium: 2,
    large: 4,
    xlarge: 5,
  }[size]

  const otherEvents = sortedCountdowns.slice(1, 1 + secondaryCount)

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'birthday': return 'from-pink-500 to-rose-500'
      case 'holiday': return 'from-amber-500 to-orange-500'
      case 'trip': return 'from-blue-500 to-cyan-500'
      default: return 'from-purple-500 to-indigo-500'
    }
  }

  // Size-based styling
  const emojiSize = {
    small: 'text-2xl',
    medium: 'text-3xl',
    large: 'text-4xl',
    xlarge: 'text-5xl',
  }[size]

  const countdownSize = {
    small: 'text-3xl',
    medium: 'text-4xl',
    large: 'text-5xl',
    xlarge: 'text-6xl',
  }[size]

  const titleSize = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
    xlarge: 'text-lg',
  }[size]

  if (!nextEvent) {
    return (
      <div ref={ref} className="h-full flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
        <p className="text-slate-500 dark:text-slate-400">No upcoming events</p>
      </div>
    )
  }

  // Wide layout - show multiple countdowns in grid
  if (isWide && (size === 'large' || size === 'xlarge')) {
    const displayEvents = sortedCountdowns.slice(0, 4)
    const useGrid = displayEvents.length === 4

    return (
      <div ref={ref} className={`h-full ${useGrid ? 'grid grid-cols-2 grid-rows-2' : 'flex'} gap-2 p-3 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl`}>
        {displayEvents.map((event, idx) => (
          <div
            key={event.id}
            className={`flex-1 flex flex-col items-center justify-center text-center rounded-xl bg-gradient-to-br ${getTypeColor(event.type)} p-2 text-white ${!useGrid && idx === 0 ? 'scale-[1.02]' : ''}`}
          >
            <span className="text-xl">{event.emoji}</span>
            <p className="text-[10px] opacity-90 mt-0.5 truncate w-full px-1">{event.title.replace("'s Birthday", "")}</p>
            <div className="font-bold text-xl">
              {event.daysLeft === 0 ? 'Today!' : event.daysLeft === 1 ? '1 day' : `${event.daysLeft}d`}
            </div>
            <p className="text-[9px] opacity-75">
              {format(parseISO(event.date), 'MMM d')}
            </p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className="h-full flex flex-col p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
      {/* Main countdown */}
      <div className={`flex-1 flex flex-col items-center justify-center text-center rounded-xl bg-gradient-to-br ${getTypeColor(nextEvent.type)} p-4 text-white`}>
        <span className={`${emojiSize} mb-1`}>{nextEvent.emoji}</span>
        <p className={`${titleSize} opacity-90 mb-1`}>{nextEvent.title}</p>
        <div className={`${countdownSize} font-bold`}>
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
        <div className={`mt-3 ${size === 'large' || size === 'xlarge' ? 'grid grid-cols-2 gap-2' : 'space-y-1'}`}>
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
