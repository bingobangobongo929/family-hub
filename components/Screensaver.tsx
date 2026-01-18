'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns'
import { useTranslation } from '@/lib/i18n-context'
import { getDateLocale } from '@/lib/date-locale'
import { getUpcomingCollections, getBinInfo, BinType } from '@/lib/bin-schedule'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface ScreensaverProps {
  mode: 'clock' | 'photos' | 'gradient' | 'blank' | 'dashboard'
  enabled: boolean
  timeout: number // seconds
  sleepStart: string
  sleepEnd: string
  onWake: () => void
}

interface NextEvent {
  title: string
  date: Date
  emoji: string
}

const GRADIENTS = [
  'from-indigo-500 via-purple-500 to-pink-500',
  'from-cyan-500 via-blue-500 to-purple-500',
  'from-green-400 via-teal-500 to-blue-500',
  'from-yellow-400 via-orange-500 to-red-500',
  'from-pink-400 via-purple-500 to-indigo-500',
  'from-emerald-400 via-cyan-500 to-blue-500',
]

// Ambient positions for slow movement (prevents burn-in)
const POSITIONS = [
  { x: 0, y: 0 },
  { x: 5, y: 3 },
  { x: -3, y: 5 },
  { x: 3, y: -3 },
  { x: -5, y: -2 },
  { x: 2, y: -5 },
]

export default function Screensaver({
  mode,
  enabled,
  timeout,
  sleepStart,
  sleepEnd,
  onWake
}: ScreensaverProps) {
  const { t, locale } = useTranslation()
  const { user } = useAuth()
  const dateLocale = getDateLocale(locale)
  const [isActive, setIsActive] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [gradientIndex, setGradientIndex] = useState(0)
  const [positionIndex, setPositionIndex] = useState(0)
  const [isSleepTime, setIsSleepTime] = useState(false)
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null)

  // Get next bin collection
  const nextBin = useMemo(() => {
    const collections = getUpcomingCollections(7)
    if (collections.length === 0) return null
    const first = collections[0]
    const daysUntil = differenceInDays(first.date, startOfDay(new Date()))
    const binInfo = getBinInfo(first.bins[0])
    return {
      emoji: binInfo.emoji,
      name: binInfo.shortName,
      daysUntil,
      allBins: first.bins.map(b => getBinInfo(b).emoji).join(' ')
    }
  }, [currentTime])

  // Fetch next calendar event
  const fetchNextEvent = useCallback(async () => {
    if (!user) return

    try {
      const now = new Date()
      const { data } = await supabase
        .from('calendar_events')
        .select('title, start_time')
        .gte('start_time', now.toISOString())
        .order('start_time', { ascending: true })
        .limit(1)
        .single()

      if (data) {
        // Get emoji based on title
        const title = data.title.toLowerCase()
        let emoji = '📅'
        if (title.includes('birthday')) emoji = '🎂'
        else if (title.includes('doctor') || title.includes('dentist')) emoji = '🏥'
        else if (title.includes('school')) emoji = '🏫'
        else if (title.includes('meeting')) emoji = '💼'
        else if (title.includes('dinner') || title.includes('lunch')) emoji = '🍽️'
        else if (title.includes('party')) emoji = '🎉'

        setNextEvent({
          title: data.title,
          date: parseISO(data.start_time),
          emoji
        })
      }
    } catch (error) {
      // Silently fail - screensaver still works without event
    }
  }, [user])

  useEffect(() => {
    if (isActive && mode === 'dashboard') {
      fetchNextEvent()
    }
  }, [isActive, mode, fetchNextEvent])

  // Check if current time is within sleep hours
  const checkSleepTime = useCallback(() => {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const [startHour, startMin] = sleepStart.split(':').map(Number)
    const [endHour, endMin] = sleepEnd.split(':').map(Number)

    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    if (startMinutes > endMinutes) {
      setIsSleepTime(currentMinutes >= startMinutes || currentMinutes < endMinutes)
    } else {
      setIsSleepTime(currentMinutes >= startMinutes && currentMinutes < endMinutes)
    }
  }, [sleepStart, sleepEnd])

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
      checkSleepTime()
    }, 1000)

    return () => clearInterval(timer)
  }, [checkSleepTime])

  // Change gradient every 10 seconds
  useEffect(() => {
    if (mode !== 'gradient') return

    const timer = setInterval(() => {
      setGradientIndex(prev => (prev + 1) % GRADIENTS.length)
    }, 10000)

    return () => clearInterval(timer)
  }, [mode])

  // Slowly move position every 30 seconds (burn-in prevention)
  useEffect(() => {
    if (!isActive) return

    const timer = setInterval(() => {
      setPositionIndex(prev => (prev + 1) % POSITIONS.length)
    }, 30000)

    return () => clearInterval(timer)
  }, [isActive])

  // Idle detection
  useEffect(() => {
    if (!enabled) {
      setIsActive(false)
      return
    }

    let idleTimer: NodeJS.Timeout

    const resetIdleTimer = () => {
      clearTimeout(idleTimer)
      if (isActive) {
        setIsActive(false)
        onWake()
      }
      idleTimer = setTimeout(() => {
        setIsActive(true)
      }, timeout * 1000)
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, resetIdleTimer, { passive: true })
    })

    idleTimer = setTimeout(() => {
      setIsActive(true)
    }, timeout * 1000)

    return () => {
      clearTimeout(idleTimer)
      events.forEach(event => {
        document.removeEventListener(event, resetIdleTimer)
      })
    }
  }, [enabled, timeout, isActive, onWake])

  const handleWake = useCallback(() => {
    setIsActive(false)
    onWake()
  }, [onWake])

  if (!isActive) return null

  const effectiveMode = isSleepTime ? 'blank' : mode
  const position = POSITIONS[positionIndex]

  // Format event time
  const formatEventTime = (date: Date) => {
    const daysUntil = differenceInDays(startOfDay(date), startOfDay(new Date()))
    if (daysUntil === 0) return `Today ${format(date, 'HH:mm')}`
    if (daysUntil === 1) return `Tomorrow ${format(date, 'HH:mm')}`
    return format(date, 'EEE HH:mm', { locale: dateLocale })
  }

  return (
    <div
      className="fixed inset-0 z-[9999] cursor-pointer"
      onClick={handleWake}
      onTouchStart={handleWake}
    >
      {effectiveMode === 'blank' && (
        <div className="w-full h-full bg-black" />
      )}

      {effectiveMode === 'clock' && (
        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center">
          <div
            className="text-white text-center transition-transform duration-[3000ms] ease-in-out"
            style={{ transform: `translate(${position.x}%, ${position.y}%)` }}
          >
            <div className="text-[12rem] font-light tracking-tight leading-none">
              {format(currentTime, 'HH:mm')}
            </div>
            <div className="text-4xl font-light text-slate-400 mt-4">
              {format(currentTime, 'EEEE, MMMM d', { locale: dateLocale })}
            </div>
          </div>
          <p className="absolute bottom-8 text-slate-600 text-sm">
            {t('screensaver.tapToWake')}
          </p>
        </div>
      )}

      {effectiveMode === 'gradient' && (
        <div className={`w-full h-full bg-gradient-to-br ${GRADIENTS[gradientIndex]} transition-all duration-[3000ms] flex flex-col items-center justify-center`}>
          <div
            className="text-white text-center drop-shadow-lg transition-transform duration-[3000ms] ease-in-out"
            style={{ transform: `translate(${position.x}%, ${position.y}%)` }}
          >
            <div className="text-[10rem] font-light tracking-tight leading-none">
              {format(currentTime, 'HH:mm')}
            </div>
            <div className="text-3xl font-light text-white/80 mt-4">
              {format(currentTime, 'EEEE, MMMM d', { locale: dateLocale })}
            </div>
          </div>
          <p className="absolute bottom-8 text-white/40 text-sm">
            {t('screensaver.tapToWake')}
          </p>
        </div>
      )}

      {effectiveMode === 'dashboard' && (
        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-8">
          <div
            className="text-white text-center transition-transform duration-[5000ms] ease-in-out max-w-2xl"
            style={{ transform: `translate(${position.x}%, ${position.y}%)` }}
          >
            {/* Large Time */}
            <div className="text-[10rem] font-extralight tracking-tight leading-none text-white">
              {format(currentTime, 'HH:mm')}
            </div>

            {/* Date */}
            <div className="text-3xl font-light text-slate-400 mt-2 mb-8">
              {format(currentTime, 'EEEE, MMMM d', { locale: dateLocale })}
            </div>

            {/* Info Cards */}
            <div className="flex items-center justify-center gap-6 flex-wrap">
              {/* Next Event */}
              {nextEvent && (
                <div className="flex items-center gap-3 bg-slate-800/50 px-5 py-3 rounded-2xl">
                  <span className="text-3xl">{nextEvent.emoji}</span>
                  <div className="text-left">
                    <p className="text-white/90 font-medium truncate max-w-[180px]">
                      {nextEvent.title}
                    </p>
                    <p className="text-slate-400 text-sm">
                      {formatEventTime(nextEvent.date)}
                    </p>
                  </div>
                </div>
              )}

              {/* Next Bin Collection */}
              {nextBin && (
                <div className="flex items-center gap-3 bg-slate-800/50 px-5 py-3 rounded-2xl">
                  <span className="text-3xl">{nextBin.allBins}</span>
                  <div className="text-left">
                    <p className="text-white/90 font-medium">Bin Day</p>
                    <p className="text-slate-400 text-sm">
                      {nextBin.daysUntil === 0 ? 'Today' :
                       nextBin.daysUntil === 1 ? 'Tomorrow' :
                       `In ${nextBin.daysUntil} days`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="absolute bottom-8 text-slate-600 text-sm">
            {t('screensaver.tapToWake')}
          </p>
        </div>
      )}

      {effectiveMode === 'photos' && (
        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center">
          <div
            className="text-white text-center transition-transform duration-[3000ms] ease-in-out"
            style={{ transform: `translate(${position.x}%, ${position.y}%)` }}
          >
            <div className="text-6xl mb-4">📸</div>
            <div className="text-[8rem] font-light tracking-tight leading-none">
              {format(currentTime, 'HH:mm')}
            </div>
            <div className="text-2xl font-light text-slate-400 mt-4">
              {format(currentTime, 'EEEE, MMMM d', { locale: dateLocale })}
            </div>
          </div>
          <p className="absolute bottom-8 text-slate-600 text-sm">
            {t('screensaver.tapToWake')}
          </p>
        </div>
      )}
    </div>
  )
}
