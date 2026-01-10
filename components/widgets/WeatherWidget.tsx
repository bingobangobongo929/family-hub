'use client'

import { CloudSun, Sun, Cloud, CloudRain, Snowflake } from 'lucide-react'

// Demo weather data
const DEMO_WEATHER = {
  temp: 8,
  condition: 'partly_cloudy',
  high: 11,
  low: 4,
  location: 'Manchester',
  forecast: [
    { day: 'Tue', temp: 10, icon: 'cloudy' },
    { day: 'Wed', temp: 12, icon: 'sunny' },
    { day: 'Thu', temp: 9, icon: 'rainy' },
    { day: 'Fri', temp: 7, icon: 'cloudy' },
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
  const temp = unit === 'fahrenheit'
    ? Math.round(DEMO_WEATHER.temp * 9/5 + 32)
    : DEMO_WEATHER.temp

  return (
    <div className="h-full flex flex-col p-4 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{DEMO_WEATHER.location}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-light text-slate-800 dark:text-slate-100">
              {temp}°
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {unit === 'fahrenheit' ? 'F' : 'C'}
            </span>
          </div>
        </div>
        {getWeatherIcon(DEMO_WEATHER.condition)}
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 capitalize">
        {DEMO_WEATHER.condition.replace('_', ' ')}
      </p>

      <div className="flex-1 flex items-end">
        <div className="w-full flex justify-between">
          {DEMO_WEATHER.forecast.map((day) => (
            <div key={day.day} className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">{day.day}</p>
              {getWeatherIcon(day.icon, 'w-5 h-5')}
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {unit === 'fahrenheit' ? Math.round(day.temp * 9/5 + 32) : day.temp}°
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
