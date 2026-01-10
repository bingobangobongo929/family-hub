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
    small: 'text-3xl',
    medium: 'text-5xl md:text-6xl',
    large: 'text-6xl md:text-7xl',
    xlarge: 'text-7xl md:text-8xl',
  }[size]

  const dateSize = {
    small: 'text-[10px]',
    medium: 'text-sm',
    large: 'text-base',
    xlarge: 'text-lg',
  }[size]

  return (
    <div
      ref={ref}
      className="h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark"
    >
      <div className={`font-display ${timeSize} font-light text-slate-800 dark:text-slate-100 tabular-nums tracking-tight`}>
        {format(time, timeFormat)}
      </div>
      <div className={`${dateSize} text-slate-500 dark:text-slate-400 mt-2 text-center font-medium`}>
        {format(time, 'EEEE, MMMM d')}
        {showYear && <span className="ml-1">{format(time, 'yyyy')}</span>}
      </div>
      {(size === 'large' || size === 'xlarge') && isTall && (
        <div className="mt-4 text-xs text-teal-600 dark:text-teal-400 font-medium bg-teal-50 dark:bg-teal-900/30 px-3 py-1 rounded-full">
          Week {format(time, 'w')}
        </div>
      )}
    </div>
  )
}
