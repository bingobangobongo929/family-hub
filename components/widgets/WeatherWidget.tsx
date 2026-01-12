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
  feelsLike: 5,
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

  const convertTemp = (t: number) => unit === 'fahrenheit' ? Math.round(t * 9/5 + 32) : t
  const temp = convertTemp(DEMO_WEATHER.temp)
  const unitLabel = unit === 'fahrenheit' ? 'F' : 'C'

  // Calculate how many forecast days can fit based on width
  // Each forecast item needs ~50px minimum
  const availableWidth = width - 32 // padding
  const forecastItemWidth = size === 'xlarge' ? 70 : size === 'large' ? 55 : 45
  const maxForecastFromWidth = Math.max(2, Math.min(7, Math.floor(availableWidth / forecastItemWidth)))

  // Determine settings based on size
  let forecastDays = Math.min(maxForecastFromWidth, 4)
  let mainIconSize = 'w-10 h-10'
  let forecastIconSize = 'w-4 h-4'
  let tempSize = 'text-3xl'
  let showHighLow = true
  let showDetails = false
  let showForecast = true
  let useHorizontalLayout = false

  if (size === 'small') {
    mainIconSize = 'w-8 h-8'
    forecastIconSize = 'w-3.5 h-3.5'
    tempSize = 'text-2xl'
    forecastDays = Math.min(maxForecastFromWidth, 3)
    showHighLow = height > 100
    showForecast = height > 80
  } else if (size === 'medium') {
    mainIconSize = 'w-10 h-10'
    forecastIconSize = 'w-4 h-4'
    tempSize = 'text-3xl'
    forecastDays = Math.min(maxForecastFromWidth, 5)
    // Use horizontal layout for wide+short
    useHorizontalLayout = isWide && !isTall && width > 300
  } else if (size === 'large') {
    mainIconSize = 'w-12 h-12'
    forecastIconSize = 'w-5 h-5'
    tempSize = 'text-4xl'
    forecastDays = Math.min(maxForecastFromWidth, 6)
    showDetails = height > 200
    useHorizontalLayout = isWide && !isTall && width > 350
  } else if (size === 'xlarge') {
    mainIconSize = 'w-14 h-14'
    forecastIconSize = 'w-6 h-6'
    tempSize = 'text-5xl'
    forecastDays = Math.min(maxForecastFromWidth, 7)
    showDetails = true
    useHorizontalLayout = isWide && height < 250
  }

  return (
    <div
      ref={ref}
      className="h-full flex flex-col p-4 bg-gradient-to-br from-sky-50 to-teal-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden"
    >
      {useHorizontalLayout ? (
        // Horizontal layout: current weather left, forecast right
        <div className="flex-1 flex items-center gap-4 min-h-0">
          {/* Current weather */}
          <div className="flex-shrink-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
              {DEMO_WEATHER.location}
            </p>
            <div className="flex items-center gap-2">
              {getWeatherIcon(DEMO_WEATHER.condition, mainIconSize)}
              <div>
                <span className={`font-display ${tempSize} font-light text-slate-800 dark:text-slate-100`}>
                  {temp}°
                </span>
                {showHighLow && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {convertTemp(DEMO_WEATHER.high)}°/{convertTemp(DEMO_WEATHER.low)}°
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-slate-200/50 dark:bg-slate-600/50 flex-shrink-0" />

          {/* Forecast */}
          <div className="flex-1 flex items-center justify-around gap-1 min-w-0 overflow-hidden">
            {DEMO_WEATHER.forecast.slice(0, forecastDays).map((day) => (
              <div key={day.day} className="text-center flex-shrink-0">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{day.day}</p>
                <div className="my-0.5 flex justify-center">
                  {getWeatherIcon(day.icon, forecastIconSize)}
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {convertTemp(day.temp)}°
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Vertical layout: current weather top, forecast bottom
        <>
          {/* Current weather */}
          <div className="flex items-start justify-between flex-shrink-0">
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
              {showHighLow && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  H:{convertTemp(DEMO_WEATHER.high)}° L:{convertTemp(DEMO_WEATHER.low)}°
                </p>
              )}
            </div>
            <div className="flex flex-col items-center flex-shrink-0">
              {getWeatherIcon(DEMO_WEATHER.condition, mainIconSize)}
              {size !== 'small' && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize mt-0.5 truncate max-w-[60px]">
                  {DEMO_WEATHER.condition.replace('_', ' ')}
                </p>
              )}
            </div>
          </div>

          {/* Details row */}
          {showDetails && (
            <div className="flex gap-3 py-2 my-2 border-y border-slate-200/30 dark:border-slate-600/30 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <Droplets className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                <span>{DEMO_WEATHER.humidity}%</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <Wind className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                <span>{DEMO_WEATHER.wind}km/h</span>
              </div>
            </div>
          )}

          {/* Forecast */}
          {showForecast && (
            <div className="flex-1 flex items-end min-h-0 overflow-hidden">
              <div className="w-full flex justify-around gap-1">
                {DEMO_WEATHER.forecast.slice(0, forecastDays).map((day) => (
                  <div key={day.day} className="text-center flex-1 min-w-0 p-1 rounded-lg bg-white/40 dark:bg-slate-700/30">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{day.day}</p>
                    <div className="my-0.5 flex justify-center">
                      {getWeatherIcon(day.icon, forecastIconSize)}
                    </div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {convertTemp(day.temp)}°
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
