'use client'

import { CloudSun, Sun, Cloud, CloudRain, Snowflake, Wind, Droplets } from 'lucide-react'
import { useWidgetSize } from '@/lib/useWidgetSize'
import { useTranslation } from '@/lib/i18n-context'

// Demo weather data
const DEMO_WEATHER = {
  temp: 8,
  condition: 'partly_cloudy',
  high: 11,
  low: 4,
  location: 'Randers',
  humidity: 72,
  wind: 15,
  feelsLike: 5,
  hourly: [
    { time: 'Now', temp: 8, icon: 'partly_cloudy' },
    { time: '14', temp: 9, icon: 'partly_cloudy' },
    { time: '15', temp: 10, icon: 'cloudy' },
    { time: '16', temp: 10, icon: 'cloudy' },
    { time: '17', temp: 9, icon: 'cloudy' },
    { time: '18', temp: 8, icon: 'partly_cloudy' },
    { time: '19', temp: 7, icon: 'partly_cloudy' },
    { time: '20', temp: 6, icon: 'cloudy' },
  ],
  forecast: [
    { day: 'Tue', high: 11, low: 4, icon: 'cloudy' },
    { day: 'Wed', high: 13, low: 6, icon: 'sunny' },
    { day: 'Thu', high: 10, low: 5, icon: 'rainy' },
    { day: 'Fri', high: 8, low: 3, icon: 'cloudy' },
    { day: 'Sat', high: 7, low: 2, icon: 'rainy' },
    { day: 'Sun', high: 9, low: 4, icon: 'partly_cloudy' },
    { day: 'Mon', high: 12, low: 5, icon: 'sunny' },
  ]
}

const getWeatherIcon = (condition: string, className: string = 'w-10 h-10') => {
  const icons: Record<string, React.ReactNode> = {
    sunny: <Sun className={`${className} text-amber-500 flex-shrink-0`} />,
    partly_cloudy: <CloudSun className={`${className} text-amber-400 flex-shrink-0`} />,
    cloudy: <Cloud className={`${className} text-slate-400 flex-shrink-0`} />,
    rainy: <CloudRain className={`${className} text-blue-400 flex-shrink-0`} />,
    snowy: <Snowflake className={`${className} text-sky-300 flex-shrink-0`} />,
  }
  return icons[condition] || icons.cloudy
}

export default function WeatherWidget({ unit = 'celsius' }: { unit?: 'celsius' | 'fahrenheit' }) {
  const [ref, { size, isWide, isTall, width, height }] = useWidgetSize()
  const { t } = useTranslation()

  const convertTemp = (temp: number) => unit === 'fahrenheit' ? Math.round(temp * 9/5 + 32) : temp
  const temp = convertTemp(DEMO_WEATHER.temp)
  const unitLabel = unit === 'fahrenheit' ? 'F' : 'C'

  // Determine layout and sizing
  const showHourly = isTall && height > 200
  const showDetails = height > 180 || (isWide && width > 300)
  const showForecast = !showHourly && height > 100

  let mainIconSize = 'w-10 h-10'
  let tempSize = 'text-3xl'
  let forecastIconSize = 'w-4 h-4'

  if (size === 'small') {
    mainIconSize = 'w-8 h-8'
    tempSize = 'text-2xl'
    forecastIconSize = 'w-3.5 h-3.5'
  } else if (size === 'large' || size === 'xlarge') {
    mainIconSize = 'w-12 h-12'
    tempSize = 'text-4xl'
    forecastIconSize = 'w-5 h-5'
  }

  // Calculate items that fit
  const hourlyCount = Math.min(8, Math.floor((height - 120) / 36))
  const forecastCount = Math.min(7, Math.floor((width - 32) / 50))

  return (
    <div
      ref={ref}
      className="h-full flex flex-col p-3 bg-gradient-to-br from-sky-50 to-teal-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden"
    >
      {/* Current weather header */}
      <div className="flex items-start justify-between flex-shrink-0 mb-2">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
            {DEMO_WEATHER.location}
          </p>
          <div className="flex items-baseline gap-1">
            <span className={`font-display ${tempSize} font-light text-slate-800 dark:text-slate-100`}>
              {temp}°
            </span>
            <span className="text-xs text-slate-400">{unitLabel}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            H:{convertTemp(DEMO_WEATHER.high)}° L:{convertTemp(DEMO_WEATHER.low)}°
          </p>
        </div>
        <div className="flex flex-col items-center flex-shrink-0">
          {getWeatherIcon(DEMO_WEATHER.condition, mainIconSize)}
          <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
            {DEMO_WEATHER.condition.replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Details row */}
      {showDetails && (
        <div className="flex gap-4 py-1.5 mb-2 border-y border-slate-200/30 dark:border-slate-600/30 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <Droplets className="w-3.5 h-3.5 text-teal-500" />
            <span>{DEMO_WEATHER.humidity}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <Wind className="w-3.5 h-3.5 text-teal-500" />
            <span>{DEMO_WEATHER.wind}km/h</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="text-teal-500 text-[10px]">{t('weather.feels')}</span>
            <span>{convertTemp(DEMO_WEATHER.feelsLike)}°</span>
          </div>
        </div>
      )}

      {/* Hourly forecast (for tall widgets like 2x3) */}
      {showHourly && (
        <div className="flex-1 flex flex-col gap-1 min-h-0 overflow-hidden">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">{t('weather.hourly')}</p>
          {DEMO_WEATHER.hourly.slice(0, hourlyCount).map((hour, i) => (
            <div
              key={hour.time}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
                i === 0 ? 'bg-teal-100/50 dark:bg-teal-900/30' : 'bg-white/40 dark:bg-slate-700/30'
              }`}
            >
              <span className={`text-xs w-8 ${i === 0 ? 'font-semibold text-teal-700 dark:text-teal-300' : 'text-slate-600 dark:text-slate-400'}`}>
                {hour.time}
              </span>
              {getWeatherIcon(hour.icon, 'w-4 h-4')}
              <span className={`text-sm font-semibold flex-1 text-right ${i === 0 ? 'text-teal-700 dark:text-teal-300' : 'text-slate-700 dark:text-slate-300'}`}>
                {convertTemp(hour.temp)}°
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Daily forecast (for wide or standard widgets) */}
      {showForecast && (
        <div className="flex-1 flex items-end min-h-0">
          <div className="w-full flex justify-around gap-1">
            {DEMO_WEATHER.forecast.slice(0, forecastCount).map((day) => (
              <div key={day.day} className="text-center flex-1 min-w-0 p-1 rounded-lg bg-white/40 dark:bg-slate-700/30">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{day.day}</p>
                <div className="my-0.5 flex justify-center">
                  {getWeatherIcon(day.icon, forecastIconSize)}
                </div>
                <p className="text-[10px] text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">{convertTemp(day.high)}°</span>
                  <span className="text-slate-400 mx-0.5">/</span>
                  <span>{convertTemp(day.low)}°</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
