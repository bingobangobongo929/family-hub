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
  getSessionUrgency,
  getSessionUrgencyStyles,
} from '@/lib/f1-api'

interface F1Data {
  isRaceWeekend: boolean
  meeting: OpenF1Meeting | null
  session?: OpenF1Session | null
  sessions: OpenF1Session[]
}

interface SessionWithMeta extends OpenF1Session {
  countdown: { days: number; hours: number; minutes: number; text: string }
  urgency: string
  icon: string
  shortName: string
}

export default function F1Widget() {
  const [ref, { size, isWide }] = useWidgetSize()
  const [data, setData] = useState<F1Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)

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

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Process sessions with countdown and urgency
  const sessionsWithMeta: SessionWithMeta[] = useMemo(() => {
    if (!data?.sessions?.length) return []
    const now = new Date()

    return data.sessions
      .filter(s => new Date(s.date_start) > now)
      .slice(0, 6)
      .map(session => {
        const sessionDate = new Date(session.date_start)
        return {
          ...session,
          countdown: getCountdown(sessionDate),
          urgency: getSessionUrgency(sessionDate),
          icon: getSessionIcon(session.session_name),
          shortName: SESSION_NAMES[session.session_name] || session.session_name,
        }
      })
  }, [data?.sessions, ])

  // Next session (first upcoming)
  const nextSession = sessionsWithMeta[0]

  // Size-based config
  const showTiles = size !== 'small' || isWide
  const tilesCount = {
    small: 1,
    medium: 4,
    large: isWide ? 6 : 4,
    xlarge: isWide ? 6 : 4,
  }[size]

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

  // Small size - compact single session view
  if (size === 'small' && !isWide) {
    return (
      <Link href="/f1" className="block h-full">
        <div ref={ref} className="h-full flex flex-col p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{countryFlag}</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
              {data.meeting.circuit_short_name}
            </span>
          </div>
          {nextSession && (
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                <span>{nextSession.icon}</span>
                <span>{nextSession.shortName}</span>
              </div>
              <span className="text-xl font-bold text-red-600 dark:text-red-400 font-mono">
                {nextSession.countdown.text}
              </span>
            </div>
          )}
        </div>
      </Link>
    )
  }

  // Grid layout with tiles (Bindicator-style)
  const gridCols = isWide ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <Link href="/f1" className="block h-full">
      <div ref={ref} className="h-full flex flex-col p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{countryFlag}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                {data.meeting.circuit_short_name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {data.meeting.country_name}
              </p>
            </div>
          </div>
          {data.isRaceWeekend && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-medium animate-pulse">
              Live
            </span>
          )}
        </div>

        {/* Session tiles grid */}
        <div className={`flex-1 grid ${gridCols} gap-1.5 min-h-0`}>
          {sessionsWithMeta.slice(0, tilesCount).map((session) => {
            const urgencyStyles = getSessionUrgencyStyles(session.urgency)
            const danishTime = toDanishTime(new Date(session.date_start))

            return (
              <div
                key={session.session_key}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 ${urgencyStyles.bg} ${urgencyStyles.border} transition-all min-h-0`}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-base">{session.icon}</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {session.shortName}
                  </span>
                </div>
                <span className={`text-lg font-bold font-mono ${urgencyStyles.text}`}>
                  {session.countdown.text}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDanishTime(danishTime)}
                </span>
              </div>
            )
          })}

          {/* Fill empty slots for consistent grid */}
          {sessionsWithMeta.length < tilesCount &&
            Array.from({ length: tilesCount - sessionsWithMeta.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex flex-col items-center justify-center p-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 opacity-30"
              >
                <span className="text-lg">🏎️</span>
              </div>
            ))}
        </div>
      </div>
    </Link>
  )
}
