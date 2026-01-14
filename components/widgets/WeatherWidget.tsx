'use client'

import { CloudSun, Sun, Cloud, CloudRain, Snowflake, Wind, Droplets, Sunrise, Sunset, Thermometer, CloudDrizzle } from 'lucide-react'
import { useWidgetSize } from '@/lib/useWidgetSize'
import { useTranslation } from '@/lib/i18n-context'

// Demo weather data with more detail
const DEMO_WEATHER = {
  temp: 8,
  condition: 'partly_cloudy',
  high: 11,
  low: 4,
  location: 'Randers',
  humidity: 72,
  wind: 15,
  windDirection: 'SW',
  feelsLike: 5,
  uvIndex: 2,
  precipitation: 20,
  sunrise: '08:15',
  sunset: '16:45',
  hourly: [
    { time: 'Now', temp: 8, icon: 'partly_cloudy', precipitation: 0 },
    { time: '14', temp: 9, icon: 'partly_cloudy', precipitation: 0 },
    { time: '15', temp: 10, icon: 'cloudy', precipitation: 10 },
    { time: '16', temp: 10, icon: 'cloudy', precipitation: 15 },
    { time: '17', temp: 9, icon: 'drizzle', precipitation: 30 },
    { time: '18', temp: 8, icon: 'drizzle', precipitation: 40 },
    { time: '19', temp: 7, icon: 'cloudy', precipitation: 20 },
    { time: '20', temp: 6, icon: 'cloudy', precipitation: 10 },
    { time: '21', temp: 5, icon: 'partly_cloudy', precipitation: 0 },
    { time: '22', temp: 5, icon: 'cloudy', precipitation: 0 },
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
    drizzle: <CloudDrizzle className={`${className} text-blue-300 flex-shrink-0`} />,
    snowy: <Snowflake className={`${className} text-sky-300 flex-shrink-0`} />,
  }
  return icons[condition] || icons.cloudy
}

// Visual temperature bar component
function TempBar({ temp, low, high, showTemp = true }: { temp: number; low: number; high: number; showTemp?: boolean }) {
  const range = high - low
  const position = range > 0 ? ((temp - low) / range) * 100 : 50

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="relative flex-1 h-1.5 bg-gradient-to-r from-blue-400 via-green-400 via-yellow-400 to-red-400 rounded-full">
        <div
          className="absolute w-2.5 h-2.5 bg-white border-2 border-slate-700 rounded-full -top-0.5 transform -translate-x-1/2 shadow-sm"
          style={{ left: `${Math.max(5, Math.min(95, position))}%` }}
        />
      </div>
      {showTemp && (
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">{temp}°</span>
      )}
    </div>
  )
}

// Sun position arc showing time of day
function SunArc({ sunrise, sunset, className = '' }: { sunrise: string; sunset: string; className?: string }) {
  // Parse times and calculate current position
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [sunriseH, sunriseM] = sunrise.split(':').map(Number)
  const [sunsetH, sunsetM] = sunset.split(':').map(Number)
  const sunriseMinutes = sunriseH * 60 + sunriseM
  const sunsetMinutes = sunsetH * 60 + sunsetM

  const dayLength = sunsetMinutes - sunriseMinutes
  const progress = dayLength > 0
    ? Math.max(0, Math.min(1, (currentMinutes - sunriseMinutes) / dayLength))
    : 0.5

  // Calculate sun position on arc (0 = left, 1 = right)
  const angle = progress * Math.PI // 0 to PI for semicircle
  const sunX = 50 + 40 * Math.cos(Math.PI - angle) // Flip for left-to-right
  const sunY = 45 - 35 * Math.sin(angle) // Invert Y for SVG

  const isDaytime = currentMinutes >= sunriseMinutes && currentMinutes <= sunsetMinutes

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 100 50" className="w-full h-auto">
        {/* Sky gradient background */}
        <defs>
          <linearGradient id="sky-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={isDaytime ? '#fef3c7' : '#1e3a5f'} />
            <stop offset="100%" stopColor={isDaytime ? '#7dd3fc' : '#0f172a'} />
          </linearGradient>
        </defs>

        {/* Horizon line */}
        <line x1="5" y1="45" x2="95" y2="45" stroke="currentColor" strokeWidth="1" className="text-slate-300 dark:text-slate-600" />

        {/* Sun path arc (dashed) */}
        <path
          d="M 10 45 Q 50 -10 90 45"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3,3"
          className="text-amber-300/50 dark:text-amber-500/30"
        />

        {/* Sun */}
        {isDaytime && (
          <circle cx={sunX} cy={sunY} r="6" fill="#fbbf24" className="drop-shadow-lg">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
          </circle>
        )}

        {/* Sunrise icon position */}
        <circle cx="10" cy="45" r="3" fill="#f97316" className="opacity-60" />
        {/* Sunset icon position */}
        <circle cx="90" cy="45" r="3" fill="#ef4444" className="opacity-60" />
      </svg>

      {/* Time labels */}
      <div className="flex justify-between mt-1 px-1">
        <div className="flex items-center gap-1">
          <Sunrise className="w-3 h-3 text-orange-400" />
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{sunrise}</span>
        </div>
        <div className="flex items-center gap-1">
          <Sunset className="w-3 h-3 text-red-400" />
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{sunset}</span>
        </div>
      </div>
    </div>
  )
}

// Hourly temperature graph
function HourlyGraph({ hourly, convertTemp }: { hourly: typeof DEMO_WEATHER.hourly; convertTemp: (t: number) => number }) {
  const temps = hourly.map(h => convertTemp(h.temp))
  const maxTemp = Math.max(...temps)
  const minTemp = Math.min(...temps)
  const range = maxTemp - minTemp || 1

  return (
    <div className="flex gap-1 items-end h-full">
      {hourly.slice(0, 8).map((hour, i) => {
        const temp = convertTemp(hour.temp)
        const heightPercent = ((temp - minTemp) / range) * 60 + 30 // Min 30%, max 90%

        return (
          <div key={hour.time} className="flex-1 flex flex-col items-center gap-1">
            {/* Temperature */}
            <span className={`text-[10px] font-semibold ${i === 0 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {temp}°
            </span>

            {/* Bar with precipitation indicator */}
            <div className="relative w-full flex-1 flex flex-col justify-end">
              {/* Precipitation overlay */}
              {hour.precipitation > 0 && (
                <div
                  className="absolute bottom-0 left-0 right-0 bg-blue-400/30 dark:bg-blue-500/30 rounded-t"
                  style={{ height: `${hour.precipitation}%` }}
                />
              )}
              {/* Temperature bar */}
              <div
                className={`w-full rounded-t-sm transition-all ${
                  i === 0
                    ? 'bg-gradient-to-t from-teal-500 to-teal-400'
                    : 'bg-gradient-to-t from-slate-300 to-slate-200 dark:from-slate-600 dark:to-slate-500'
                }`}
                style={{ height: `${heightPercent}%` }}
              />
            </div>

            {/* Weather icon */}
            <div className="h-5 flex items-center justify-center">
              {getWeatherIcon(hour.icon, 'w-4 h-4')}
            </div>

            {/* Time */}
            <span className={`text-[10px] ${i === 0 ? 'font-semibold text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {hour.time}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Wind direction indicator
function WindIndicator({ direction, speed }: { direction: string; speed: number }) {
  const directionDegrees: Record<string, number> = {
    'N': 0, 'NE': 45, 'E': 90, 'SE': 135,
    'S': 180, 'SW': 225, 'W': 270, 'NW': 315
  }
  const rotation = directionDegrees[direction] || 0

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8">
        <svg viewBox="0 0 32 32" className="w-full h-full">
          {/* Compass circle */}
          <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-200 dark:text-slate-600" />
          {/* Wind arrow */}
          <path
            d="M16 6 L19 16 L16 14 L13 16 Z"
            fill="currentColor"
            className="text-teal-500"
            transform={`rotate(${rotation}, 16, 16)`}
          />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{speed} km/h</span>
        <span className="text-[10px] text-slate-400">{direction}</span>
      </div>
    </div>
  )
}

export default function WeatherWidget({ unit = 'celsius' }: { unit?: 'celsius' | 'fahrenheit' }) {
  const [ref, { size, isWide, isTall, width, height }] = useWidgetSize()
  const { t } = useTranslation()

  const convertTemp = (temp: number) => unit === 'fahrenheit' ? Math.round(temp * 9/5 + 32) : temp
  const temp = convertTemp(DEMO_WEATHER.temp)
  const unitLabel = unit === 'fahrenheit' ? 'F' : 'C'

  // Determine if we have a tall layout (2x3 or similar)
  const isTallLayout = isTall && height > 280

  let mainIconSize = 'w-10 h-10'
  let tempSize = 'text-3xl'

  if (size === 'small') {
    mainIconSize = 'w-8 h-8'
    tempSize = 'text-2xl'
  } else if (size === 'large' || size === 'xlarge') {
    mainIconSize = 'w-12 h-12'
    tempSize = 'text-4xl'
  }

  // Enhanced 2x3 layout
  if (isTallLayout) {
    return (
      <div
        ref={ref}
        className="h-full flex flex-col p-4 bg-gradient-to-br from-sky-50 via-teal-50 to-cyan-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark overflow-hidden"
      >
        {/* Current weather header */}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {DEMO_WEATHER.location}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-5xl font-light text-slate-800 dark:text-slate-100">
                {temp}°
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                H:{convertTemp(DEMO_WEATHER.high)}° L:{convertTemp(DEMO_WEATHER.low)}°
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            {getWeatherIcon(DEMO_WEATHER.condition, 'w-16 h-16')}
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-1">
              {DEMO_WEATHER.condition.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Temperature range bar */}
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-xs text-blue-500 font-medium">{convertTemp(DEMO_WEATHER.low)}°</span>
          <TempBar temp={DEMO_WEATHER.temp} low={DEMO_WEATHER.low} high={DEMO_WEATHER.high} showTemp={false} />
          <span className="text-xs text-red-500 font-medium">{convertTemp(DEMO_WEATHER.high)}°</span>
        </div>

        {/* Sun arc */}
        <SunArc sunrise={DEMO_WEATHER.sunrise} sunset={DEMO_WEATHER.sunset} className="mb-3" />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="flex flex-col items-center p-2 rounded-xl bg-white/50 dark:bg-slate-800/50">
            <Droplets className="w-4 h-4 text-teal-500 mb-1" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{DEMO_WEATHER.humidity}%</span>
            <span className="text-[10px] text-slate-400">Humidity</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-xl bg-white/50 dark:bg-slate-800/50">
            <Thermometer className="w-4 h-4 text-orange-500 mb-1" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{convertTemp(DEMO_WEATHER.feelsLike)}°</span>
            <span className="text-[10px] text-slate-400">{t('weather.feels')}</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-xl bg-white/50 dark:bg-slate-800/50">
            <CloudRain className="w-4 h-4 text-blue-500 mb-1" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{DEMO_WEATHER.precipitation}%</span>
            <span className="text-[10px] text-slate-400">Rain</span>
          </div>
        </div>

        {/* Hourly forecast graph */}
        <div className="flex-1 min-h-0">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-2">{t('weather.hourly')}</p>
          <div className="h-[calc(100%-1rem)]">
            <HourlyGraph hourly={DEMO_WEATHER.hourly} convertTemp={convertTemp} />
          </div>
        </div>
      </div>
    )
  }

  // Standard layout (existing code with minor refinements)
  const showHourly = isTall && height > 200
  const showDetails = height > 180 || (isWide && width > 300)
  const showForecast = !showHourly && height > 100
  const forecastIconSize = size === 'small' ? 'w-3.5 h-3.5' : size === 'large' || size === 'xlarge' ? 'w-5 h-5' : 'w-4 h-4'
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
