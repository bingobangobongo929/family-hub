'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Timer, Play, Pause, X, Plus, Volume2, VolumeX } from 'lucide-react'
import { useWidgetSize } from '@/lib/useWidgetSize'
import { useTranslation } from '@/lib/i18n-context'

interface ActiveTimer {
  id: string
  label?: string
  emoji?: string
  totalSeconds: number
  secondsLeft: number
  isRunning: boolean
  isComplete: boolean
}

// Quick emoji options for timers
const QUICK_EMOJIS = ['⏰', '🍳', '📚', '🧹', '🛁', '🍽️', '🏃', '💪', '🎮', '📺', '🛏️', '☕']

// Sound effects using Web Audio API
function playSound(type: 'tick' | 'alarm' | 'start') {
  if (typeof window === 'undefined') return

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    if (type === 'tick') {
      oscillator.frequency.value = 800
      gainNode.gain.value = 0.1
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.05)
    } else if (type === 'start') {
      oscillator.frequency.value = 523.25 // C5
      gainNode.gain.value = 0.2
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.15)
    } else if (type === 'alarm') {
      // Play a fun melody for kids
      const notes = [523.25, 659.25, 783.99, 659.25, 523.25] // C5, E5, G5, E5, C5
      const durations = [0.2, 0.2, 0.4, 0.2, 0.4]
      let time = audioContext.currentTime

      notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator()
        const gain = audioContext.createGain()
        osc.connect(gain)
        gain.connect(audioContext.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.3, time)
        gain.gain.exponentialRampToValueAtTime(0.01, time + durations[i])
        osc.start(time)
        osc.stop(time + durations[i])
        time += durations[i]
      })
    }
  } catch (e) {
    console.log('Audio not available')
  }
}

export default function TimerWidget() {
  const [ref, { size, height }] = useWidgetSize()
  const { t } = useTranslation()
  const [timers, setTimers] = useState<ActiveTimer[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMinutes, setNewMinutes] = useState(5)
  const [newSeconds, setNewSeconds] = useState(0)
  const [newLabel, setNewLabel] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Timer tick logic
  useEffect(() => {
    const hasRunningTimers = timers.some(t => t.isRunning && t.secondsLeft > 0)

    if (hasRunningTimers) {
      intervalRef.current = setInterval(() => {
        setTimers(prev => prev.map(timer => {
          if (!timer.isRunning || timer.secondsLeft <= 0) return timer

          const newSecondsLeft = timer.secondsLeft - 1

          if (newSecondsLeft <= 0) {
            if (soundEnabled) playSound('alarm')
            return { ...timer, secondsLeft: 0, isRunning: false, isComplete: true }
          }

          // Tick sound for last 10 seconds
          if (newSecondsLeft <= 10 && soundEnabled) {
            playSound('tick')
          }

          return { ...timer, secondsLeft: newSecondsLeft }
        }))
      }, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timers, soundEnabled])

  const addTimer = useCallback(() => {
    const totalSeconds = newMinutes * 60 + newSeconds
    if (totalSeconds <= 0) return

    const newTimer: ActiveTimer = {
      id: Date.now().toString(),
      label: newLabel.trim() || undefined,
      emoji: newEmoji || undefined,
      totalSeconds,
      secondsLeft: totalSeconds,
      isRunning: true,
      isComplete: false,
    }

    if (soundEnabled) playSound('start')
    setTimers(prev => [...prev, newTimer])
    setShowAddForm(false)
    setNewMinutes(5)
    setNewSeconds(0)
    setNewLabel('')
    setNewEmoji('')
  }, [newMinutes, newSeconds, newLabel, newEmoji, soundEnabled])

  const toggleTimer = (id: string) => {
    setTimers(prev => prev.map(t =>
      t.id === id ? { ...t, isRunning: !t.isRunning } : t
    ))
  }

  const removeTimer = (id: string) => {
    setTimers(prev => prev.filter(t => t.id !== id))
  }

  const dismissComplete = (id: string) => {
    setTimers(prev => prev.filter(t => t.id !== id))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const compactMode = size === 'small'
  const hasTimers = timers.length > 0
  const activeTimers = timers.filter(t => !t.isComplete)
  const completedTimers = timers.filter(t => t.isComplete)

  // Calculate how many timers we can show based on widget height
  const timerRowHeight = compactMode ? 36 : 44
  const headerHeight = 44
  const addButtonHeight = 40
  const availableHeight = height - headerHeight - addButtonHeight - 16
  const maxVisibleTimers = Math.max(1, Math.floor(availableHeight / timerRowHeight))

  return (
    <div
      ref={ref}
      className="h-full flex flex-col p-3 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-teal-500" />
          <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100 text-sm">
            {t('timer.title')}
          </h3>
          {hasTimers && (
            <span className="text-xs text-slate-400">({activeTimers.length})</span>
          )}
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 transition-colors"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Add Timer Form */}
      {showAddForm && (
        <div className="mb-2 p-2 bg-white dark:bg-slate-700 rounded-xl border border-teal-200 dark:border-slate-600 flex-shrink-0">
          {/* Time inputs */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={99}
                value={newMinutes}
                onChange={e => setNewMinutes(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
                className="w-12 px-2 py-1 text-center text-lg font-mono bg-slate-100 dark:bg-slate-600 rounded border-0 focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-slate-500 text-xs">m</span>
            </div>
            <span className="text-slate-400 text-lg">:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={59}
                value={newSeconds}
                onChange={e => setNewSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                className="w-12 px-2 py-1 text-center text-lg font-mono bg-slate-100 dark:bg-slate-600 rounded border-0 focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-slate-500 text-xs">s</span>
            </div>
          </div>

          {/* Optional label */}
          <input
            type="text"
            placeholder={t('timer.optionalName')}
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            maxLength={20}
            className="w-full px-2 py-1 text-sm bg-slate-100 dark:bg-slate-600 rounded border-0 focus:ring-2 focus:ring-teal-500 mb-2"
          />

          {/* Quick emoji picker */}
          <div className="flex flex-wrap gap-1 mb-2">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => setNewEmoji(newEmoji === emoji ? '' : emoji)}
                className={`w-7 h-7 rounded text-base hover:bg-teal-100 dark:hover:bg-slate-500 transition-colors ${
                  newEmoji === emoji ? 'bg-teal-200 dark:bg-slate-500 ring-2 ring-teal-400' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={addTimer}
              disabled={newMinutes === 0 && newSeconds === 0}
              className="flex-1 py-1.5 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {t('timer.start')}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-600 dark:text-slate-300 text-sm rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Timer List */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {!hasTimers && !showAddForm ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Timer className="w-8 h-8 text-slate-300 dark:text-slate-500 mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              {t('timer.noTimers')}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Completed timers (show first with celebration) */}
            {completedTimers.slice(0, Math.min(1, maxVisibleTimers)).map(timer => (
              <div
                key={timer.id}
                className="flex items-center gap-2 p-2 bg-gradient-to-r from-teal-400 to-emerald-500 rounded-xl animate-pulse"
              >
                <span className="text-xl">🎉</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {timer.emoji || timer.label || t('timer.timesUp')}
                  </p>
                </div>
                <button
                  onClick={() => dismissComplete(timer.id)}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}

            {/* Active timers */}
            {activeTimers.slice(0, maxVisibleTimers - completedTimers.length).map(timer => {
              const progress = ((timer.totalSeconds - timer.secondsLeft) / timer.totalSeconds) * 100
              return (
                <div
                  key={timer.id}
                  className="relative flex items-center gap-2 p-2 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden"
                >
                  {/* Progress bar background */}
                  <div
                    className="absolute inset-0 bg-teal-100 dark:bg-teal-900/30 transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />

                  {/* Content */}
                  <div className="relative flex items-center gap-2 flex-1 min-w-0">
                    {timer.emoji && <span className="text-lg flex-shrink-0">{timer.emoji}</span>}
                    <div className="flex-1 min-w-0">
                      {timer.label && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{timer.label}</p>
                      )}
                      <p className={`font-mono font-bold ${compactMode ? 'text-base' : 'text-lg'} text-slate-800 dark:text-slate-100`}>
                        {formatTime(timer.secondsLeft)}
                      </p>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="relative flex items-center gap-1">
                    <button
                      onClick={() => toggleTimer(timer.id)}
                      className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-800 hover:bg-teal-200 dark:hover:bg-teal-700 transition-colors"
                    >
                      {timer.isRunning ? (
                        <Pause className="w-4 h-4 text-teal-600 dark:text-teal-300" />
                      ) : (
                        <Play className="w-4 h-4 text-teal-600 dark:text-teal-300" />
                      )}
                    </button>
                    <button
                      onClick={() => removeTimer(timer.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Show more indicator */}
            {(activeTimers.length + completedTimers.length) > maxVisibleTimers && (
              <p className="text-xs text-slate-400 text-center">
                +{(activeTimers.length + completedTimers.length) - maxVisibleTimers} more
              </p>
            )}
          </div>
        )}
      </div>

      {/* Add Timer Button */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-2 flex items-center justify-center gap-2 py-2 w-full bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('timer.addTimer')}
        </button>
      )}
    </div>
  )
}
