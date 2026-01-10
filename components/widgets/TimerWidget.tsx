'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Timer, Play, Pause, RotateCcw, Volume2, VolumeX, Moon, Bath, Utensils, BookOpen } from 'lucide-react'
import { useWidgetSize } from '@/lib/useWidgetSize'

interface TimerPreset {
  id: string
  label: string
  minutes: number
  emoji: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const TIMER_PRESETS: TimerPreset[] = [
  { id: 'bedtime-5', label: '5 min to bed', minutes: 5, emoji: '🛏️', icon: Moon, color: 'from-indigo-500 to-purple-500' },
  { id: 'bedtime-10', label: '10 min to bed', minutes: 10, emoji: '🌙', icon: Moon, color: 'from-indigo-500 to-purple-500' },
  { id: 'bath', label: 'Bath time', minutes: 15, emoji: '🛁', icon: Bath, color: 'from-cyan-500 to-blue-500' },
  { id: 'dinner', label: 'Dinner soon', minutes: 5, emoji: '🍽️', icon: Utensils, color: 'from-orange-500 to-amber-500' },
  { id: 'story', label: 'Story time', minutes: 10, emoji: '📖', icon: BookOpen, color: 'from-emerald-500 to-teal-500' },
  { id: 'tidy', label: 'Tidy up', minutes: 5, emoji: '🧹', icon: Timer, color: 'from-pink-500 to-rose-500' },
]

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
  const [ref, { size }] = useWidgetSize()
  const [selectedPreset, setSelectedPreset] = useState<TimerPreset | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [isComplete, setIsComplete] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Timer logic
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false)
            setIsComplete(true)
            if (soundEnabled) {
              playSound('alarm')
            }
            return 0
          }
          // Tick sound for last 10 seconds
          if (prev <= 11 && soundEnabled) {
            playSound('tick')
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, soundEnabled])

  const startTimer = useCallback((preset: TimerPreset) => {
    setSelectedPreset(preset)
    setTimeLeft(preset.minutes * 60)
    setIsRunning(true)
    setIsComplete(false)
    if (soundEnabled) {
      playSound('start')
    }
  }, [soundEnabled])

  const togglePause = () => {
    setIsRunning(prev => !prev)
  }

  const resetTimer = () => {
    setIsRunning(false)
    setTimeLeft(0)
    setSelectedPreset(null)
    setIsComplete(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const progress = selectedPreset ? ((selectedPreset.minutes * 60 - timeLeft) / (selectedPreset.minutes * 60)) * 100 : 0

  const compactMode = size === 'small'
  const showPresets = !selectedPreset
  const presetsToShow = compactMode ? 4 : 6

  return (
    <div
      ref={ref}
      className={`h-full flex flex-col p-4 rounded-2xl transition-all ${
        isComplete
          ? 'bg-gradient-to-br from-green-400 to-emerald-500 animate-pulse'
          : selectedPreset
          ? `bg-gradient-to-br ${selectedPreset.color}`
          : 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Timer className={`w-4 h-4 ${selectedPreset || isComplete ? 'text-white' : 'text-slate-500'}`} />
          <h3 className={`font-semibold ${selectedPreset || isComplete ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
            {isComplete ? 'Time\'s Up!' : selectedPreset ? selectedPreset.label : 'Timer'}
          </h3>
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-1.5 rounded-lg transition-colors ${
            selectedPreset || isComplete
              ? 'hover:bg-white/20 text-white'
              : 'hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Timer Display or Preset Selection */}
      {showPresets ? (
        <div className={`flex-1 grid ${compactMode ? 'grid-cols-2 gap-2' : 'grid-cols-2 gap-2'}`}>
          {TIMER_PRESETS.slice(0, presetsToShow).map(preset => {
            const Icon = preset.icon
            return (
              <button
                key={preset.id}
                onClick={() => startTimer(preset)}
                className={`flex ${compactMode ? 'flex-col' : 'flex-row'} items-center ${compactMode ? 'justify-center' : 'gap-2'} p-2 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-all hover:scale-[1.02] active:scale-[0.98]`}
              >
                <span className={`${compactMode ? 'text-xl' : 'text-2xl'}`}>{preset.emoji}</span>
                <div className={`${compactMode ? 'text-center' : ''}`}>
                  <p className={`${compactMode ? 'text-[10px]' : 'text-xs'} font-medium text-slate-700 dark:text-slate-200 truncate`}>
                    {compactMode ? `${preset.minutes}m` : preset.label}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Circular Progress */}
          <div className="relative">
            <svg className={`${compactMode ? 'w-20 h-20' : 'w-32 h-32'} transform -rotate-90`}>
              <circle
                cx="50%"
                cy="50%"
                r={compactMode ? 35 : 58}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={compactMode ? 6 : 8}
                fill="none"
              />
              <circle
                cx="50%"
                cy="50%"
                r={compactMode ? 35 : 58}
                stroke="white"
                strokeWidth={compactMode ? 6 : 8}
                fill="none"
                strokeDasharray={compactMode ? 220 : 364}
                strokeDashoffset={compactMode ? 220 - (220 * (100 - progress) / 100) : 364 - (364 * (100 - progress) / 100)}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isComplete ? (
                <span className={`${compactMode ? 'text-3xl' : 'text-5xl'}`}>🎉</span>
              ) : (
                <>
                  <span className={`${compactMode ? 'text-lg' : 'text-3xl'} font-bold text-white`}>
                    {formatTime(timeLeft)}
                  </span>
                  <span className={`${compactMode ? 'text-xl' : 'text-2xl'} mt-1`}>{selectedPreset?.emoji}</span>
                </>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 mt-4">
            {!isComplete && (
              <button
                onClick={togglePause}
                className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                {isRunning ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white" />
                )}
              </button>
            )}
            <button
              onClick={resetTimer}
              className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <RotateCcw className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
