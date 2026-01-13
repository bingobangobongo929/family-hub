'use client'

import { useState, useEffect, useMemo } from 'react'
import { useWidgetSize } from '@/lib/useWidgetSize'
import Link from 'next/link'
import {
  OpenF1Meeting,
  OpenF1Session,
  SESSION_NAMES,
  getCountdown,
  toDanishTime,
  formatDanishTime,
  getCountryFlag,
  getSessionIcon,
} from '@/lib/f1-api'

interface F1Data {
  isRaceWeekend: boolean
  meeting: OpenF1Meeting | null
  session?: OpenF1Session | null
  sessions: OpenF1Session[]
}

export default function F1Widget() {
  const [ref, { size, isWide }] = useWidgetSize()
  const [data, setData] = useState<F1Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, text: '' })

  // Fetch F1 data
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/f1/next')
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching F1 data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Get next upcoming session
  const nextSession = useMemo(() => {
    if (!data?.sessions?.length) return null
    const now = new Date()
    return data.sessions.find(s => new Date(s.date_start) > now)
  }, [data?.sessions])

  // Update countdown every second
  useEffect(() => {
    if (!nextSession) return

    function update() {
      if (nextSession) {
        setCountdown(getCountdown(new Date(nextSession.date_start)))
      }
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [nextSession])

  // Get sessions with status for race weekend view
  const sessionsWithStatus = useMemo(() => {
    if (!data?.sessions?.length) return []
    const now = new Date()

    return data.sessions.map(session => {
      const start = new Date(session.date_start)
      const end = new Date(session.date_end || session.date_start)
      end.setHours(end.getHours() + 2) // Sessions typically last ~2 hours

      let status: 'completed' | 'live' | 'upcoming' = 'upcoming'
      if (now > end) status = 'completed'
      else if (now >= start && now <= end) status = 'live'

      return { ...session, status }
    })
  }, [data?.sessions])

  if (loading) {
    return (
      <div ref={ref} className="h-full flex items-center justify-center p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl">
        <div className="animate-pulse text-red-600 dark:text-red-400">Loading F1...</div>
      </div>
    )
  }

  if (!data?.meeting) {
    return (
      <Link href="/f1" className="block h-full">
        <div ref={ref} className="h-full flex flex-col items-center justify-center p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl">
          <span className="text-3xl mb-2">🏎️</span>
          <span className="text-slate-600 dark:text-slate-300 text-sm">No upcoming races</span>
        </div>
      </Link>
    )
  }

  const countryFlag = getCountryFlag(data.meeting.country_name)
  const nextSessionIcon = nextSession ? getSessionIcon(nextSession.session_name) : '🏎️'
  const nextSessionName = nextSession ? (SESSION_NAMES[nextSession.session_name] || nextSession.session_name) : ''
  const nextSessionTime = nextSession ? formatDanishTime(toDanishTime(new Date(nextSession.date_start))) : ''

  // NOT race weekend - simple countdown view
  if (!data.isRaceWeekend) {
    return (
      <Link href="/f1" className="block h-full">
        <div ref={ref} className="h-full flex flex-col p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
          {/* Header with flag and location */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{countryFlag}</span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                {data.meeting.circuit_short_name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data.meeting.country_name}
              </p>
            </div>
          </div>

          {/* Countdown */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-bold text-red-600 dark:text-red-400 font-mono mb-1">
                {countdown.text || '--'}
              </p>
              {nextSession && (
                <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="text-lg">{nextSessionIcon}</span>
                  <span className="text-sm font-medium">{nextSessionName}</span>
                  <span className="text-xs text-slate-500">• {nextSessionTime}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  // RACE WEEKEND - show session tiles
  const gridCols = isWide ? 'grid-cols-3' : 'grid-cols-2'
  const maxSessions = isWide ? 6 : 4

  return (
    <Link href="/f1" className="block h-full">
      <div ref={ref} className="h-full flex flex-col p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{countryFlag}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {data.meeting.circuit_short_name}
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-medium animate-pulse">
            Race Weekend
          </span>
        </div>

        {/* Session tiles */}
        <div className={`flex-1 grid ${gridCols} gap-1.5 min-h-0`}>
          {sessionsWithStatus.slice(0, maxSessions).map((session) => {
            const icon = getSessionIcon(session.session_name)
            const shortName = SESSION_NAMES[session.session_name] || session.session_name
            const danishTime = formatDanishTime(toDanishTime(new Date(session.date_start)))

            const statusStyles = {
              completed: 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 opacity-60',
              live: 'bg-red-100 dark:bg-red-900/40 border-red-400 dark:border-red-600 ring-2 ring-red-400',
              upcoming: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600',
            }[session.status]

            return (
              <div
                key={session.session_key}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 ${statusStyles} transition-all`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-base">{icon}</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {shortName}
                  </span>
                </div>
                {session.status === 'live' ? (
                  <span className="text-sm font-bold text-red-600 dark:text-red-400 animate-pulse">
                    LIVE
                  </span>
                ) : session.status === 'completed' ? (
                  <span className="text-xs text-slate-500">Done</span>
                ) : (
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {danishTime}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Link>
  )
}
