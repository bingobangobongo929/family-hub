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
  formatDanishDate,
} from '@/lib/f1-api'

interface F1Data {
  isRaceWeekend: boolean
  meeting: OpenF1Meeting | null
  session?: OpenF1Session | null
  sessions: OpenF1Session[]
}

export default function F1Widget() {
  const [ref, { size }] = useWidgetSize()
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
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Update countdown every second
  useEffect(() => {
    if (!data?.session) return

    function updateCountdown() {
      if (data?.session) {
        const sessionDate = new Date(data.session.date_start)
        setCountdown(getCountdown(sessionDate))
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [data?.session])

  // Get next session from the list
  const nextSession = useMemo(() => {
    if (!data?.sessions?.length) return null
    const now = new Date()
    return data.sessions.find(s => new Date(s.date_start) > now) || data.sessions[0]
  }, [data?.sessions])

  // Get completed sessions (for showing results during race weekend)
  const completedSessions = useMemo(() => {
    if (!data?.sessions?.length) return []
    const now = new Date()
    return data.sessions.filter(s => new Date(s.date_end || s.date_start) < now)
  }, [data?.sessions])

  // Size-based styling
  const titleSize = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
    xlarge: 'text-lg',
  }[size]

  const countdownSize = {
    small: 'text-2xl',
    medium: 'text-3xl',
    large: 'text-4xl',
    xlarge: 'text-5xl',
  }[size]

  if (loading) {
    return (
      <div ref={ref} className="h-full flex items-center justify-center p-3 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl">
        <div className="animate-pulse text-white">Loading F1...</div>
      </div>
    )
  }

  if (!data?.meeting) {
    return (
      <Link href="/f1" className="block h-full">
        <div ref={ref} className="h-full flex flex-col items-center justify-center p-3 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl">
          <span className="text-3xl mb-2">🏎️</span>
          <span className="text-white text-sm">No upcoming races</span>
        </div>
      </Link>
    )
  }

  const sessionToShow = nextSession || data.session
  const sessionDate = sessionToShow ? new Date(sessionToShow.date_start) : null
  const danishTime = sessionDate ? toDanishTime(sessionDate) : null

  return (
    <Link href="/f1" className="block h-full">
      <div ref={ref} className="h-full flex flex-col p-3 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏎️</span>
            <span className={`${titleSize} font-bold text-white`}>F1</span>
          </div>
          {data.isRaceWeekend && (
            <span className="px-2 py-0.5 bg-white/20 text-white text-xs rounded-full font-medium">
              Race Weekend
            </span>
          )}
        </div>

        {/* Race name */}
        <div className="mb-2">
          <p className={`${titleSize} font-semibold text-white truncate`}>
            {data.meeting.meeting_name}
          </p>
          <p className="text-xs text-white/70">
            {data.meeting.circuit_short_name} • {data.meeting.country_name}
          </p>
        </div>

        {/* Countdown or session info */}
        <div className="flex-1 flex flex-col justify-center">
          {sessionToShow && (
            <>
              <div className="text-center">
                <p className="text-xs text-white/80 uppercase tracking-wide mb-1">
                  {SESSION_NAMES[sessionToShow.session_name] || sessionToShow.session_name}
                </p>
                <p className={`${countdownSize} font-bold text-white font-mono`}>
                  {countdown.text || '--'}
                </p>
              </div>
              {danishTime && size !== 'small' && (
                <p className="text-xs text-white/70 text-center mt-2">
                  {formatDanishDate(danishTime)} • {formatDanishTime(danishTime)}
                </p>
              )}
            </>
          )}
        </div>

        {/* Session list (for larger sizes during race weekend) */}
        {data.isRaceWeekend && size !== 'small' && data.sessions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/20">
            <div className="flex flex-wrap gap-1 justify-center">
              {data.sessions.slice(0, size === 'medium' ? 3 : 5).map((session, i) => {
                const sessionTime = new Date(session.date_start)
                const isPast = sessionTime < new Date()
                const isNext = session.session_key === nextSession?.session_key

                return (
                  <span
                    key={session.session_key}
                    className={`px-2 py-0.5 text-xs rounded ${
                      isNext
                        ? 'bg-white text-red-600 font-bold'
                        : isPast
                        ? 'bg-white/20 text-white/60'
                        : 'bg-white/10 text-white/80'
                    }`}
                  >
                    {SESSION_NAMES[session.session_name] || session.session_name}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
