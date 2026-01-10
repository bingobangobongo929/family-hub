'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'

interface ScreensaverProps {
  mode: 'clock' | 'photos' | 'gradient' | 'blank'
  enabled: boolean
  timeout: number // seconds
  sleepStart: string
  sleepEnd: string
  onWake: () => void
}

const GRADIENTS = [
  'from-indigo-500 via-purple-500 to-pink-500',
  'from-cyan-500 via-blue-500 to-purple-500',
  'from-green-400 via-teal-500 to-blue-500',
  'from-yellow-400 via-orange-500 to-red-500',
  'from-pink-400 via-purple-500 to-indigo-500',
  'from-emerald-400 via-cyan-500 to-blue-500',
]

export default function Screensaver({
  mode,
  enabled,
  timeout,
  sleepStart,
  sleepEnd,
  onWake
}: ScreensaverProps) {
  const [isActive, setIsActive] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [gradientIndex, setGradientIndex] = useState(0)
  const [isSleepTime, setIsSleepTime] = useState(false)

  // Check if current time is within sleep hours
  const checkSleepTime = useCallback(() => {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const [startHour, startMin] = sleepStart.split(':').map(Number)
    const [endHour, endMin] = sleepEnd.split(':').map(Number)

    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    // Handle overnight sleep periods (e.g., 22:00 to 06:00)
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

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, resetIdleTimer, { passive: true })
    })

    // Start initial timer
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

  // Handle wake from screensaver
  const handleWake = useCallback(() => {
    setIsActive(false)
    onWake()
  }, [onWake])

  if (!isActive) return null

  // During sleep time, always show blank/dimmed screen
  const effectiveMode = isSleepTime ? 'blank' : mode

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
          <div className="text-white text-center">
            <div className="text-[12rem] font-light tracking-tight leading-none">
              {format(currentTime, 'HH:mm')}
            </div>
            <div className="text-4xl font-light text-slate-400 mt-4">
              {format(currentTime, 'EEEE, MMMM d')}
            </div>
          </div>
          <p className="absolute bottom-8 text-slate-600 text-sm">
            Tap anywhere to wake
          </p>
        </div>
      )}

      {effectiveMode === 'gradient' && (
        <div className={`w-full h-full bg-gradient-to-br ${GRADIENTS[gradientIndex]} transition-all duration-[3000ms] flex flex-col items-center justify-center`}>
          <div className="text-white text-center drop-shadow-lg">
            <div className="text-[10rem] font-light tracking-tight leading-none">
              {format(currentTime, 'HH:mm')}
            </div>
            <div className="text-3xl font-light text-white/80 mt-4">
              {format(currentTime, 'EEEE, MMMM d')}
            </div>
          </div>
          <p className="absolute bottom-8 text-white/40 text-sm">
            Tap anywhere to wake
          </p>
        </div>
      )}

      {effectiveMode === 'photos' && (
        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center">
          {/* Placeholder for photo slideshow - would need photo integration */}
          <div className="text-white text-center">
            <div className="text-6xl mb-4">📸</div>
            <div className="text-[8rem] font-light tracking-tight leading-none">
              {format(currentTime, 'HH:mm')}
            </div>
            <div className="text-2xl font-light text-slate-400 mt-4">
              {format(currentTime, 'EEEE, MMMM d')}
            </div>
          </div>
          <p className="absolute bottom-8 text-slate-600 text-sm">
            Tap anywhere to wake
          </p>
        </div>
      )}
    </div>
  )
}
