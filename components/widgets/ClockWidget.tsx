'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useWidgetSize } from '@/lib/useWidgetSize'

export default function ClockWidget() {
  const [time, setTime] = useState(new Date())
  const [ref, { size, isWide, isTall }] = useWidgetSize()

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Adapt display based on size
  const showSeconds = size === 'large' || size === 'xlarge'
  const showYear = size === 'xlarge' || (size === 'large' && isTall)
  const timeFormat = showSeconds ? 'HH:mm:ss' : 'HH:mm'

  // Dynamic text sizes
  const timeSize = {
    small: 'text-4xl',
    medium: 'text-5xl md:text-6xl',
    large: 'text-6xl md:text-7xl',
    xlarge: 'text-7xl md:text-8xl',
  }[size]

  const dateSize = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
    xlarge: 'text-lg',
  }[size]

  return (
    <div
      ref={ref}
      className="h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-sage-50 to-sage-100 dark:from-slate-800 dark:to-slate-700 rounded-2xl"
    >
      <div className={`${timeSize} font-light text-slate-800 dark:text-slate-100 tabular-nums tracking-tight`}>
        {format(time, timeFormat)}
      </div>
      <div className={`${dateSize} text-slate-500 dark:text-slate-400 mt-2 text-center`}>
        {format(time, 'EEEE, MMMM d')}
        {showYear && <span className="ml-1">{format(time, 'yyyy')}</span>}
      </div>
      {(size === 'large' || size === 'xlarge') && isTall && (
        <div className="mt-4 text-xs text-slate-400 dark:text-slate-500">
          Week {format(time, 'w')}
        </div>
      )}
    </div>
  )
}
