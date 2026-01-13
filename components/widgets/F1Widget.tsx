'use client'

import { useState, useEffect, useMemo } from 'react'
import { useWidgetSize } from '@/lib/useWidgetSize'
import Link from 'next/link'
import Image from 'next/image'
import { Wrench, Clock, Zap, Flag } from 'lucide-react'
import {
  OpenF1Meeting,
  OpenF1Session,
  SESSION_NAMES,
  getCountdown,
  toDanishTime,
  formatDanishTime,
  getCountryCode,
} from '@/lib/f1-api'

interface F1Data {
  isRaceWeekend: boolean
  meeting: OpenF1Meeting | null
  session?: OpenF1Session | null
  sessions: OpenF1Session[]
}

// Session icon component
function SessionIcon({ sessionName, className = "w-5 h-5" }: { sessionName: string; className?: string }) {
  if (sessionName.includes('Practice')) {
    return <Wrench className={className} />
  }
  if (sessionName.includes('Qualifying') || sessionName.includes('Sprint Shootout')) {
    return <Clock className={className} />
  }
  if (sessionName.includes('Sprint') && !sessionName.includes('Qualifying') && !sessionName.includes('Shootout')) {
    return <Zap className={className} />
  }
  return <Flag className={className} />
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

  // Get upcoming sessions
  const upcomingSessions = useMemo(() => {
    if (!data?.sessions?.length) return []
    const now = new Date()
    return data.sessions
      .filter(s => new Date(s.date_start) > now)
      .slice(0, isWide ? 6 : 4)
  }, [data?.sessions, isWide])

  const nextSession = upcomingSessions[0]

  // Update countdown
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

  const countryCode = getCountryCode(data.meeting.country_name)
  const flagUrl = `https://flagcdn.com/w80/${countryCode}.png`

  return (
    <Link href="/f1" className="block h-full">
      <div ref={ref} className="h-full flex flex-col p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
        {/* Header - flag and circuit */}
        <div className="flex items-center gap-2 mb-2">
          <Image
            src={flagUrl}
            alt={data.meeting.country_name}
            width={28}
            height={21}
            className="rounded shadow-sm"
            unoptimized
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {data.meeting.circuit_short_name}
            </p>
          </div>
          {data.isRaceWeekend && (
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded font-medium">
              LIVE
            </span>
          )}
        </div>

        {/* Session columns */}
        <div className="flex-1 flex gap-1.5 min-h-0">
          {upcomingSessions.slice(0, isWide ? 6 : 4).map((session) => {
            const shortName = SESSION_NAMES[session.session_name] || session.session_name
            const danishTime = formatDanishTime(toDanishTime(new Date(session.date_start)))
            const isNext = session.session_key === nextSession?.session_key

            return (
              <div
                key={session.session_key}
                className={`flex-1 flex flex-col items-center justify-between py-2 px-1 rounded-xl border-2 transition-all ${
                  isNext
                    ? 'bg-red-100 dark:bg-red-900/40 border-red-400 dark:border-red-600'
                    : 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-600'
                }`}
              >
                {/* Icon */}
                <SessionIcon
                  sessionName={session.session_name}
                  className={`w-5 h-5 ${isNext ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
                />

                {/* Session name */}
                <span className={`text-xs font-bold ${isNext ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300'}`}>
                  {shortName.replace('Sprint ', 'S').replace('Quali', 'Q')}
                </span>

                {/* Countdown or time */}
                {isNext ? (
                  <div className="text-center">
                    <span className="text-sm font-bold text-red-600 dark:text-red-400 font-mono block">
                      {countdown.days > 0 ? `${countdown.days}d` : countdown.hours > 0 ? `${countdown.hours}h` : `${countdown.minutes}m`}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
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
