'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'

export default function ClockWidget() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-sage-50 to-sage-100 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
      <div className="text-5xl md:text-6xl font-light text-slate-800 dark:text-slate-100 tabular-nums">
        {format(time, 'HH:mm')}
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">
        {format(time, 'EEEE, MMMM d')}
      </div>
    </div>
  )
}
