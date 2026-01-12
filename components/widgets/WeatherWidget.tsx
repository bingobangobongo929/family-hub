'use client'

import { CloudSun, Sun, Cloud, CloudRain, Snowflake, Wind, Droplets, Thermometer, ArrowUp, ArrowDown } from 'lucide-react'
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
    { day: 'Tue', temp: 10, high: 12, low: 6, icon: 'cloudy' },
    { day: 'Wed', temp: 12, high: 14, low: 8, icon: 'sunny' },
    { day: 'Thu', temp: 9, high: 11, low: 5, icon: 'rainy' },
    { day: 'Fri', temp: 7, high: 9, low: 3, icon: 'cloudy' },
    { day: 'Sat', temp: 6, high: 8, low: 2, icon: 'rainy' },
    { day: 'Sun', temp: 8, high: 10, low: 4, icon: 'partly_cloudy' },
    { day: 'Mon', temp: 11, high: 13, low: 7, icon: 'sunny' },
  ]
}

const getWeatherIcon = (condition: string, className: string = 'w-10 h-10') => {
  const icons: Record<string, React.ReactNode> = {
    sunny: <Sun className={`${className} text-amber-500`} />,
    partly_cloudy: <CloudSun className={`${className} text-amber-400`} />,
    cloudy: <Cloud className={`${className} text-slate-400`} />,
    rainy: <CloudRain className={`${className} text-blue-400`} />,
    snowy: <Snowflake className={`${className} text-sky-300`} />,
  }
  return icons[condition] || icons.cloudy
}

export default function WeatherWidget({ unit = 'celsius' }: { unit?: 'celsius' | 'fahrenheit' }) {
  const [ref, { size, isWide, isTall, width, height }] = useWidgetSize()

  const convertTemp = (t: number) => unit === 'fahrenheit' ? Math.round(t * 9/5 + 32) : t
  const temp = convertTemp(DEMO_WEATHER.temp)
  const unitLabel = unit === 'fahrenheit' ? 'F' : 'C'

  // Calculate based on actual dimensions
  const isVeryWide = width > 400
  const isMediumWide = width > 280
  const isVeryTall = height > 350
  const isMediumTall = height > 220

  // Determine layout mode
  type LayoutMode = 'compact' | 'standard' | 'horizontal' | 'detailed' | 'full'

  let layoutMode: LayoutMode = 'standard'
  let forecastDays = 4
  let mainIconSize = 'w-12 h-12'
  let forecastIconSize = 'w-5 h-5'
  let tempSize = 'text-4xl'
  let locationSize = 'text-sm'
  let showHighLow = true
  let showDetails = false
  let showFeelsLike = false
  let showForecastHighLow = false
  let forecastLayout: 'row' | 'column' | 'grid' = 'row'
  let padding = 'p-4'

  if (size === 'small') {
    layoutMode = 'compact'
    forecastDays = isTall ? 3 : 2
    mainIconSize = 'w-8 h-8'
    forecastIconSize = 'w-4 h-4'
    tempSize = 'text-2xl'
    locationSize = 'text-xs'
    showHighLow = height > 120
    padding = 'p-3'
  } else if (size === 'medium') {
    if (isWide && !isTall) {
      // Wide and short - horizontal layout
      layoutMode = 'horizontal'
      forecastDays = 5
      mainIconSize = 'w-10 h-10'
      tempSize = 'text-3xl'
    } else if (isTall && !isWide) {
      // Tall and narrow
      layoutMode = 'standard'
      forecastDays = 5
      mainIconSize = 'w-12 h-12'
      tempSize = 'text-4xl'
      forecastLayout = 'column'
      showDetails = true
    } else {
      layoutMode = 'standard'
      forecastDays = 4
      mainIconSize = 'w-12 h-12'
      tempSize = 'text-4xl'
    }
  } else if (size === 'large') {
    if (isVeryWide) {
      layoutMode = 'detailed'
      forecastDays = 7
      mainIconSize = 'w-16 h-16'
      forecastIconSize = 'w-6 h-6'
      tempSize = 'text-5xl'
      showDetails = true
      showFeelsLike = true
      showForecastHighLow = true
    } else if (isWide) {
      layoutMode = 'horizontal'
      forecastDays = 6
      mainIconSize = 'w-14 h-14'
      forecastIconSize = 'w-5 h-5'
      tempSize = 'text-4xl'
      showDetails = true
    } else if (isVeryTall) {
      layoutMode = 'detailed'
      forecastDays = 7
      mainIconSize = 'w-16 h-16'
      forecastIconSize = 'w-6 h-6'
      tempSize = 'text-5xl'
      forecastLayout = 'column'
      showDetails = true
      showFeelsLike = true
      showForecastHighLow = true
    } else {
      layoutMode = 'standard'
      forecastDays = 5
      mainIconSize = 'w-14 h-14'
      forecastIconSize = 'w-5 h-5'
      tempSize = 'text-5xl'
      showDetails = true
    }
  } else if (size === 'xlarge') {
    layoutMode = 'full'
    forecastDays = 7
    mainIconSize = 'w-20 h-20'
    forecastIconSize = 'w-8 h-8'
    tempSize = 'text-7xl'
    locationSize = 'text-base'
    showDetails = true
    showFeelsLike = true
    showForecastHighLow = true
    forecastLayout = isVeryWide ? 'row' : 'grid'
    padding = 'p-6'
  }

  return (
    <div
      ref={ref}
      className={`h-full flex flex-col ${padding} bg-gradient-to-br from-sky-50 to-teal-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark`}
    >
      {layoutMode === 'horizontal' ? (
        // Horizontal layout for wide widgets
        <div className="flex-1 flex items-center gap-4">
          {/* Left: Current weather */}
          <div className="flex-shrink-0">
            <p className={`${locationSize} text-slate-500 dark:text-slate-400 font-medium mb-1`}>
              {DEMO_WEATHER.location}
            </p>
            <div className="flex items-center gap-3">
              {getWeatherIcon(DEMO_WEATHER.condition, mainIconSize)}
              <div>
                <div className="flex items-baseline gap-1">
                  <span className={`font-display ${tempSize} font-light text-slate-800 dark:text-slate-100`}>
                    {temp}°
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-sm">{unitLabel}</span>
                </div>
                {showHighLow && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    H: {convertTemp(DEMO_WEATHER.high)}° L: {convertTemp(DEMO_WEATHER.low)}°
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-16 bg-slate-200/50 dark:bg-slate-600/50" />

          {/* Right: Forecast */}
          <div className="flex-1 flex items-center justify-around gap-2">
            {DEMO_WEATHER.forecast.slice(0, forecastDays).map((day) => (
              <div key={day.day} className="text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{day.day}</p>
                <div className="my-1 flex justify-center">
                  {getWeatherIcon(day.icon, forecastIconSize)}
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {convertTemp(day.temp)}°
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : layoutMode === 'compact' ? (
        // Compact layout for small widgets
        <>
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className={`${locationSize} text-slate-500 dark:text-slate-400 font-medium`}>
                {DEMO_WEATHER.location}
              </p>
              <div className="flex items-baseline gap-0.5">
                <span className={`font-display ${tempSize} font-light text-slate-800 dark:text-slate-100`}>
                  {temp}°
                </span>
              </div>
              {showHighLow && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {convertTemp(DEMO_WEATHER.high)}° / {convertTemp(DEMO_WEATHER.low)}°
                </p>
              )}
            </div>
            {getWeatherIcon(DEMO_WEATHER.condition, mainIconSize)}
          </div>

          <div className="flex-1 flex items-end">
            <div className="w-full flex justify-around">
              {DEMO_WEATHER.forecast.slice(0, forecastDays).map((day) => (
                <div key={day.day} className="text-center">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{day.day}</p>
                  <div className="my-0.5 flex justify-center">
                    {getWeatherIcon(day.icon, forecastIconSize)}
                  </div>
                  <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                    {convertTemp(day.temp)}°
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        // Standard/Detailed/Full layouts
        <>
          {/* Current weather */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className={`${locationSize} text-slate-500 dark:text-slate-400 font-medium`}>
                {DEMO_WEATHER.location}
              </p>
              <div className="flex items-baseline gap-1">
                <span className={`font-display ${tempSize} font-light text-slate-800 dark:text-slate-100`}>
                  {temp}°
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-sm">{unitLabel}</span>
              </div>
              {showHighLow && (
                <p className={`${size === 'xlarge' ? 'text-sm' : 'text-xs'} text-slate-500 dark:text-slate-400 mt-1 font-medium`}>
                  H: {convertTemp(DEMO_WEATHER.high)}° L: {convertTemp(DEMO_WEATHER.low)}°
                </p>
              )}
              {showFeelsLike && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Feels like {convertTemp(DEMO_WEATHER.feelsLike)}°
                </p>
              )}
            </div>
            <div className="flex flex-col items-center">
              {getWeatherIcon(DEMO_WEATHER.condition, mainIconSize)}
              <p className={`${size === 'xlarge' ? 'text-sm' : 'text-xs'} text-slate-600 dark:text-slate-300 capitalize mt-1 font-medium`}>
                {DEMO_WEATHER.condition.replace('_', ' ')}
              </p>
            </div>
          </div>

          {/* Additional details */}
          {showDetails && (
            <div className={`flex gap-4 mb-3 py-2 border-y border-slate-200/50 dark:border-slate-600/50 ${size === 'xlarge' ? 'text-base' : 'text-sm'}`}>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Droplets className={`${size === 'xlarge' ? 'w-5 h-5' : 'w-4 h-4'} text-teal-500`} />
                <span className="font-medium">{DEMO_WEATHER.humidity}%</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Wind className={`${size === 'xlarge' ? 'w-5 h-5' : 'w-4 h-4'} text-teal-500`} />
                <span className="font-medium">{DEMO_WEATHER.wind} km/h</span>
              </div>
            </div>
          )}

          {/* Forecast */}
          <div className="flex-1 flex items-end">
            {forecastLayout === 'column' ? (
              // Vertical forecast for tall widgets
              <div className="w-full space-y-1">
                {DEMO_WEATHER.forecast.slice(0, forecastDays).map((day) => (
                  <div key={day.day} className="flex items-center gap-3 py-1 px-2 rounded-xl bg-white/50 dark:bg-slate-700/30">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium w-8">{day.day}</p>
                    <div className="flex justify-center w-6">
                      {getWeatherIcon(day.icon, forecastIconSize)}
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex-1">
                      {convertTemp(day.temp)}°
                    </p>
                    {showForecastHighLow && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="flex items-center gap-0.5">
                          <ArrowUp className="w-3 h-3" />
                          {convertTemp(day.high)}°
                        </span>
                        <span className="flex items-center gap-0.5">
                          <ArrowDown className="w-3 h-3" />
                          {convertTemp(day.low)}°
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : forecastLayout === 'grid' ? (
              // Grid layout for xlarge
              <div className="w-full grid grid-cols-4 gap-2">
                {DEMO_WEATHER.forecast.slice(0, forecastDays).map((day) => (
                  <div key={day.day} className="text-center p-3 rounded-2xl bg-white/50 dark:bg-slate-700/30">
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{day.day}</p>
                    <div className="my-2 flex justify-center">
                      {getWeatherIcon(day.icon, forecastIconSize)}
                    </div>
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                      {convertTemp(day.temp)}°
                    </p>
                    {showForecastHighLow && (
                      <p className="text-xs text-slate-400 mt-1">
                        {convertTemp(day.high)}° / {convertTemp(day.low)}°
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // Row layout (default)
              <div className="w-full grid gap-1" style={{ gridTemplateColumns: `repeat(${forecastDays}, 1fr)` }}>
                {DEMO_WEATHER.forecast.slice(0, forecastDays).map((day) => (
                  <div key={day.day} className={`text-center ${size === 'xlarge' ? 'p-3' : 'p-1.5'} rounded-xl bg-white/50 dark:bg-slate-700/30`}>
                    <p className={`${size === 'xlarge' ? 'text-sm' : 'text-xs'} text-slate-500 dark:text-slate-400 font-medium`}>
                      {day.day}
                    </p>
                    <div className={`${size === 'xlarge' ? 'my-2' : 'my-1'} flex justify-center`}>
                      {getWeatherIcon(day.icon, forecastIconSize)}
                    </div>
                    <p className={`${size === 'xlarge' ? 'text-base' : 'text-xs'} font-semibold text-slate-700 dark:text-slate-300`}>
                      {convertTemp(day.temp)}°
                    </p>
                    {showForecastHighLow && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {convertTemp(day.high)}°/{convertTemp(day.low)}°
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
