'use client'

import { CloudSun, Sun, Cloud, CloudRain, Snowflake, Wind, Droplets } from 'lucide-react'
import { useWidgetSize } from '@/lib/useWidgetSize'

// Demo weather data
const DEMO_WEATHER = {
  temp: 8,
  condition: 'partly_cloudy',
  high: 11,
  low: 4,
  location: 'Randers',
  humidity: 72,
  wind: 15,
  forecast: [
    { day: 'Tue', temp: 10, icon: 'cloudy' },
    { day: 'Wed', temp: 12, icon: 'sunny' },
    { day: 'Thu', temp: 9, icon: 'rainy' },
    { day: 'Fri', temp: 7, icon: 'cloudy' },
    { day: 'Sat', temp: 6, icon: 'rainy' },
    { day: 'Sun', temp: 8, icon: 'partly_cloudy' },
    { day: 'Mon', temp: 11, icon: 'sunny' },
  ]
}

const getWeatherIcon = (condition: string, size: string = 'w-10 h-10') => {
  const icons: Record<string, React.ReactNode> = {
    sunny: <Sun className={`${size} text-amber-500`} />,
    partly_cloudy: <CloudSun className={`${size} text-amber-400`} />,
    cloudy: <Cloud className={`${size} text-slate-400`} />,
    rainy: <CloudRain className={`${size} text-blue-400`} />,
    snowy: <Snowflake className={`${size} text-sky-300`} />,
  }
  return icons[condition] || icons.cloudy
}

export default function WeatherWidget({ unit = 'celsius' }: { unit?: 'celsius' | 'fahrenheit' }) {
  const [ref, { size, isWide, isTall }] = useWidgetSize()

  const temp = unit === 'fahrenheit'
    ? Math.round(DEMO_WEATHER.temp * 9/5 + 32)
    : DEMO_WEATHER.temp

  const convertTemp = (t: number) => unit === 'fahrenheit' ? Math.round(t * 9/5 + 32) : t

  // Number of forecast days based on size
  const forecastDays = {
    small: 3,
    medium: 4,
    large: 5,
    xlarge: 7,
  }[size]

  // Icon sizes based on widget size
  const mainIconSize = {
    small: 'w-10 h-10',
    medium: 'w-12 h-12',
    large: 'w-16 h-16',
    xlarge: 'w-20 h-20',
  }[size]

  const tempSize = {
    small: 'text-3xl',
    medium: 'text-4xl',
    large: 'text-5xl',
    xlarge: 'text-6xl',
  }[size]

  const showDetails = size === 'large' || size === 'xlarge'
  const showHighLow = size !== 'small'

  return (
    <div
      ref={ref}
      className="h-full flex flex-col p-4 bg-gradient-to-br from-sky-50 to-teal-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark"
    >
      {/* Current weather */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{DEMO_WEATHER.location}</p>
          <div className="flex items-baseline gap-1">
            <span className={`font-display ${tempSize} font-light text-slate-800 dark:text-slate-100`}>
              {temp}°
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-sm">
              {unit === 'fahrenheit' ? 'F' : 'C'}
            </span>
          </div>
          {showHighLow && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              H: {convertTemp(DEMO_WEATHER.high)}° L: {convertTemp(DEMO_WEATHER.low)}°
            </p>
          )}
        </div>
        <div className="flex flex-col items-center">
          {getWeatherIcon(DEMO_WEATHER.condition, mainIconSize)}
          <p className="text-xs text-slate-600 dark:text-slate-300 capitalize mt-1 font-medium">
            {DEMO_WEATHER.condition.replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Additional details for larger sizes */}
      {showDetails && (
        <div className="flex gap-4 mb-3 py-2 border-y border-slate-200/50 dark:border-slate-600/50">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Droplets className="w-4 h-4 text-teal-500" />
            <span className="font-medium">{DEMO_WEATHER.humidity}%</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Wind className="w-4 h-4 text-teal-500" />
            <span className="font-medium">{DEMO_WEATHER.wind} km/h</span>
          </div>
        </div>
      )}

      {/* Forecast */}
      <div className="flex-1 flex items-end">
        <div className="w-full grid gap-1" style={{ gridTemplateColumns: `repeat(${forecastDays}, 1fr)` }}>
          {DEMO_WEATHER.forecast.slice(0, forecastDays).map((day) => (
            <div key={day.day} className="text-center p-1.5 rounded-xl bg-white/50 dark:bg-slate-700/30">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{day.day}</p>
              <div className="my-1 flex justify-center">
                {getWeatherIcon(day.icon, size === 'xlarge' ? 'w-6 h-6' : 'w-5 h-5')}
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {convertTemp(day.temp)}°
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
