'use client'

import { useState, useEffect, useMemo } from 'react'
import { useWidgetSize } from '@/lib/useWidgetSize'
import Link from 'next/link'
import { Wrench, Clock, Zap, Flag } from 'lucide-react'
import {
  OpenF1Meeting,
  OpenF1Session,
  SESSION_NAMES,
  getCountdown,
  toDanishTime,
} from '@/lib/f1-api'

interface F1Data {
  isRaceWeekend: boolean
  meeting: OpenF1Meeting | null
  session?: OpenF1Session | null
  sessions: OpenF1Session[]
}

function SessionIcon({ sessionName, className = "w-4 h-4" }: { sessionName: string; className?: string }) {
  if (sessionName.includes('Practice')) return <Wrench className={className} />
  if (sessionName.includes('Qualifying') || sessionName.includes('Sprint Shootout')) return <Clock className={className} />
  if (sessionName.includes('Sprint') && !sessionName.includes('Qualifying') && !sessionName.includes('Shootout')) return <Zap className={className} />
  return <Flag className={className} />
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short' })
}

export default function F1Widget() {
  const [ref, { isWide }] = useWidgetSize()
  const [data, setData] = useState<F1Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, text: '' })

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/f1/next')
        if (response.ok) setData(await response.json())
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

  const upcomingSessions = useMemo(() => {
    if (!data?.sessions?.length) return []
    const now = new Date()
    return data.sessions.filter(s => new Date(s.date_start) > now)
  }, [data?.sessions])

  const nextSession = upcomingSessions[0]

  useEffect(() => {
    if (!nextSession) return
    function update() {
      if (nextSession) setCountdown(getCountdown(new Date(nextSession.date_start)))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [nextSession])

  if (loading) {
    return (
      <div ref={ref} className="h-full flex items-center justify-center p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl">
        <div className="animate-pulse text-red-600 dark:text-red-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (!data?.meeting) {
    return (
      <Link href="/f1" className="block h-full">
        <div ref={ref} className="h-full flex flex-col items-center justify-center p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl">
          <Flag className="w-8 h-8 text-red-500 mb-2" />
          <span className="text-slate-600 dark:text-slate-300 text-sm">No races</span>
        </div>
      </Link>
    )
  }

  const flagUrl = data.meeting.country_flag
  const maxSessions = isWide ? 6 : 5

  return (
    <Link href="/f1" className="block h-full">
      <div ref={ref} className="h-full flex flex-col p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flagUrl} alt="" width={28} height={16} className="rounded shadow-sm object-cover" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate flex-1">
            {data.meeting.circuit_short_name}
          </span>
          {data.isRaceWeekend && (
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded font-medium">LIVE</span>
          )}
        </div>

        {/* Countdown */}
        {nextSession && (
          <div className="text-center mb-2">
            <div className="flex items-center justify-center gap-1 text-xs text-slate-600 dark:text-slate-400 mb-1">
              <SessionIcon sessionName={nextSession.session_name} className="w-3 h-3" />
              <span>{SESSION_NAMES[nextSession.session_name] || nextSession.session_name}</span>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono">
              {countdown.days > 0 && <span>{countdown.days}d </span>}
              {countdown.hours}h {countdown.minutes}m
            </p>
          </div>
        )}

        {/* Session list */}
        <div className="flex-1 flex flex-col gap-1 min-h-0 overflow-hidden">
          {upcomingSessions.slice(0, maxSessions).map((session, i) => {
            const time = toDanishTime(new Date(session.date_start))
            const isNext = i === 0
            return (
              <div
                key={session.session_key}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${
                  isNext ? 'bg-red-100 dark:bg-red-900/40' : 'bg-white/50 dark:bg-slate-800/50'
                }`}
              >
                <SessionIcon
                  sessionName={session.session_name}
                  className={`w-3 h-3 flex-shrink-0 ${isNext ? 'text-red-600' : 'text-slate-500'}`}
                />
                <span className={`flex-1 truncate ${isNext ? 'font-semibold text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300'}`}>
                  {SESSION_NAMES[session.session_name] || session.session_name}
                </span>
                <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">
                  {formatDay(time)} {formatTime(time)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Link>
  )
}
