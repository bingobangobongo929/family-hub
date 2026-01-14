'use client'

import { useState, useEffect, useMemo } from 'react'
import { useWidgetSize } from '@/lib/useWidgetSize'
import Link from 'next/link'
import { Wrench, Clock, Zap, Flag, Trophy } from 'lucide-react'
import {
  OpenF1Meeting,
  OpenF1Session,
  SESSION_NAMES,
  getCountdown,
  toDanishTime,
  getTeamColor,
} from '@/lib/f1-api'
import { useTranslation } from '@/lib/i18n-context'
import { getDateLocale } from '@/lib/date-locale'

interface F1Data {
  isRaceWeekend: boolean
  meeting: OpenF1Meeting | null
  session?: OpenF1Session | null
  sessions: OpenF1Session[]
  drivers?: Array<{
    position: number
    code: string
    familyName: string
    constructorId: string
    points: number
  }>
}

function SessionIcon({ sessionName, className = "w-4 h-4" }: { sessionName: string; className?: string }) {
  if (sessionName.includes('Practice')) return <Wrench className={className} />
  if (sessionName.includes('Qualifying') || sessionName.includes('Sprint Shootout')) return <Clock className={className} />
  if (sessionName.includes('Sprint') && !sessionName.includes('Qualifying') && !sessionName.includes('Shootout')) return <Zap className={className} />
  return <Flag className={className} />
}

// Circular countdown ring component
function CountdownRing({ days, hours, minutes, totalHours }: { days: number; hours: number; minutes: number; totalHours: number }) {
  // Calculate progress (0-1) - assumes max 7 days countdown
  const maxHours = 7 * 24
  const currentHours = days * 24 + hours + minutes / 60
  const progress = Math.max(0, Math.min(1, 1 - currentHours / maxHours))

  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        {/* Background ring */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-slate-200 dark:text-slate-700"
        />
        {/* Progress ring */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#f1-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000"
        />
        <defs>
          <linearGradient id="f1-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono leading-none">
          {days > 0 ? (
            <>
              <span className="text-3xl">{days}</span>
              <span className="text-lg text-slate-500">d</span>
            </>
          ) : (
            <>
              <span className="text-3xl">{hours}</span>
              <span className="text-lg text-slate-500">h</span>
            </>
          )}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 font-mono">
          {days > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
        </div>
      </div>
    </div>
  )
}

// Session type to color mapping
function getSessionColor(sessionName: string): string {
  if (sessionName.includes('Race') && !sessionName.includes('Sprint')) return 'bg-red-500'
  if (sessionName.includes('Sprint') && !sessionName.includes('Qualifying') && !sessionName.includes('Shootout')) return 'bg-orange-500'
  if (sessionName.includes('Qualifying') || sessionName.includes('Shootout')) return 'bg-yellow-500'
  return 'bg-slate-400'
}

export default function F1Widget() {
  const [ref, { isWide, isTall, height }] = useWidgetSize()
  const { t, locale } = useTranslation()
  const dateLocale = getDateLocale(locale)
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

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString(locale === 'da' ? 'da-DK' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDay = (date: Date): string => {
    return date.toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB', { weekday: 'short' })
  }

  // Determine if we have a tall layout (2x3 or similar)
  const isTallLayout = isTall && height > 280

  if (loading) {
    return (
      <div ref={ref} className="h-full flex items-center justify-center p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl">
        <div className="animate-pulse text-red-600 dark:text-red-400 text-sm">{t('common.loading')}</div>
      </div>
    )
  }

  if (!data?.meeting) {
    return (
      <Link href="/f1" className="block h-full">
        <div ref={ref} className="h-full flex flex-col items-center justify-center p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl">
          <Flag className="w-8 h-8 text-red-500 mb-2" />
          <span className="text-slate-600 dark:text-slate-300 text-sm">{t('f1.noRaces')}</span>
        </div>
      </Link>
    )
  }

  const flagUrl = data.meeting.country_flag

  // Enhanced 2x3 layout
  if (isTallLayout) {
    return (
      <Link href="/f1" className="block h-full">
        <div ref={ref} className="h-full flex flex-col p-4 bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden">
          {/* Header with flag and circuit */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-8 rounded-md overflow-hidden shadow-md flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flagUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                {data.meeting.meeting_name?.replace('Grand Prix', 'GP') || data.meeting.circuit_short_name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {data.meeting.circuit_short_name}
              </p>
            </div>
            {data.isRaceWeekend && (
              <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-lg font-bold animate-pulse shadow-lg shadow-red-500/30">
                LIVE
              </span>
            )}
          </div>

          {/* Countdown ring - centered */}
          {nextSession && (
            <div className="flex flex-col items-center mb-3">
              <CountdownRing
                days={countdown.days}
                hours={countdown.hours}
                minutes={countdown.minutes}
                totalHours={countdown.days * 24 + countdown.hours}
              />
              <div className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/40">
                <SessionIcon sessionName={nextSession.session_name} className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                  {SESSION_NAMES[nextSession.session_name] || nextSession.session_name}
                </span>
              </div>
            </div>
          )}

          {/* Visual session timeline */}
          <div className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-hidden">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Schedule</p>
            {upcomingSessions.slice(0, 6).map((session, i) => {
              const time = toDanishTime(new Date(session.date_start))
              const isNext = i === 0
              const sessionColor = getSessionColor(session.session_name)

              return (
                <div
                  key={session.session_key}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all ${
                    isNext
                      ? 'bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40 shadow-sm'
                      : 'bg-white/60 dark:bg-slate-800/60'
                  }`}
                >
                  {/* Session type indicator dot */}
                  <div className={`w-2.5 h-2.5 rounded-full ${sessionColor} flex-shrink-0 ${isNext ? 'animate-pulse' : ''}`} />

                  <SessionIcon
                    sessionName={session.session_name}
                    className={`w-4 h-4 flex-shrink-0 ${isNext ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}
                  />

                  <span className={`flex-1 text-sm truncate ${
                    isNext
                      ? 'font-semibold text-red-700 dark:text-red-300'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {SESSION_NAMES[session.session_name] || session.session_name}
                  </span>

                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className={`text-xs font-medium ${isNext ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-500'}`}>
                      {formatDay(time)}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {formatTime(time)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Top drivers mini-display (if available) */}
          {data.drivers && data.drivers.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-1 mb-1">
                <Trophy className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Championship</span>
              </div>
              <div className="flex gap-2">
                {data.drivers.slice(0, 3).map((driver, i) => (
                  <div
                    key={driver.code}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/60 dark:bg-slate-800/60 flex-1"
                  >
                    <span className={`text-xs font-bold ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : 'text-amber-700'}`}>
                      {i + 1}
                    </span>
                    <div
                      className="w-1 h-4 rounded-full"
                      style={{ backgroundColor: getTeamColor(driver.constructorId) }}
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {driver.code}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-auto">{driver.points}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Link>
    )
  }

  // Standard compact layout
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
