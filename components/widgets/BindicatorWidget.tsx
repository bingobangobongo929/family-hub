'use client'

import { useMemo } from 'react'
import { useWidgetSize } from '@/lib/useWidgetSize'
import {
  BIN_TYPES,
  BinType,
  getBinInfo,
  getDaysUntilCollection,
  getNextCollection,
  getUpcomingCollections,
  getUrgencyLevel,
  getUrgencyStyles,
  formatCollectionDate,
} from '@/lib/bin-schedule'
import Link from 'next/link'

export default function BindicatorWidget() {
  const [ref, { size, isWide }] = useWidgetSize()

  // Get upcoming collections for next 14 days
  const upcoming = useMemo(() => getUpcomingCollections(14), [])

  // Get status for each bin type
  const binStatuses = useMemo(() => {
    return BIN_TYPES.map(bin => {
      const daysUntil = getDaysUntilCollection(bin.id)
      const nextDate = getNextCollection(bin.id)
      const urgency = getUrgencyLevel(daysUntil)
      return {
        ...bin,
        daysUntil,
        nextDate,
        urgency,
      }
    }).sort((a, b) => a.daysUntil - b.daysUntil)
  }, [])

  // Find today's and tomorrow's bins
  const todayBins = binStatuses.filter(b => b.daysUntil === 0)
  const tomorrowBins = binStatuses.filter(b => b.daysUntil === 1)

  // Size-based styling
  const titleSize = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
    xlarge: 'text-lg',
  }[size]

  const emojiSize = {
    small: 'text-xl',
    medium: 'text-2xl',
    large: 'text-3xl',
    xlarge: 'text-4xl',
  }[size]

  const daysSize = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl',
    xlarge: 'text-3xl',
  }[size]

  // Wide layout for large widgets
  if (isWide && (size === 'large' || size === 'xlarge')) {
    return (
      <Link href="/bindicator" className="block h-full">
        <div ref={ref} className="h-full p-3 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className={`${titleSize} font-semibold text-slate-700 dark:text-slate-200`}>
              Bindicator
            </h3>
            {todayBins.length > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-medium animate-pulse">
                Put out tonight!
              </span>
            )}
          </div>

          {/* Grid of bins */}
          <div className="grid grid-cols-4 gap-2 h-[calc(100%-2.5rem)]">
            {binStatuses.map(bin => {
              const urgencyStyles = getUrgencyStyles(bin.urgency)
              return (
                <div
                  key={bin.id}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 ${urgencyStyles.bg} ${urgencyStyles.border} transition-all`}
                >
                  <span className={emojiSize}>{bin.emoji}</span>
                  <span className={`${titleSize} font-medium text-slate-900 dark:text-slate-200 mt-1`}>
                    {bin.shortName}
                  </span>
                  <span className={`${daysSize} font-bold ${urgencyStyles.text}`}>
                    {bin.daysUntil === 0 ? 'Today!' : bin.daysUntil === 1 ? '1d' : `${bin.daysUntil}d`}
                  </span>
                  {bin.nextDate && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {bin.nextDate.toLocaleDateString('en-GB', { weekday: 'short' })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Link>
    )
  }

  // Standard vertical layout
  return (
    <Link href="/bindicator" className="block h-full">
      <div ref={ref} className="h-full flex flex-col p-3 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl shadow-widget dark:shadow-widget-dark">
        {/* Alert banner for today/tomorrow */}
        {(todayBins.length > 0 || tomorrowBins.length > 0) && (
          <div className={`mb-2 p-2 rounded-xl text-center ${
            todayBins.length > 0
              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
              : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
          }`}>
            <div className="font-semibold text-sm">
              {todayBins.length > 0 ? 'Put out tonight!' : 'Put out tomorrow!'}
            </div>
            <div className="flex justify-center gap-1 mt-1">
              {(todayBins.length > 0 ? todayBins : tomorrowBins).map(bin => (
                <span key={bin.id} className="text-xl">{bin.emoji}</span>
              ))}
            </div>
          </div>
        )}

        {/* Bin list */}
        <div className="flex-1 space-y-1.5 overflow-hidden">
          {binStatuses.slice(0, size === 'small' ? 2 : 4).map(bin => {
            const urgencyStyles = getUrgencyStyles(bin.urgency)
            return (
              <div
                key={bin.id}
                className={`flex items-center gap-2 p-2 rounded-xl border ${urgencyStyles.bg} ${urgencyStyles.border}`}
              >
                <span className={size === 'small' ? 'text-lg' : 'text-xl'}>{bin.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-slate-900 dark:text-slate-200 truncate ${size === 'small' ? 'text-xs' : 'text-sm'}`}>
                    {bin.shortName}
                  </p>
                  {bin.nextDate && size !== 'small' && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {bin.nextDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
                <div className={`font-bold ${urgencyStyles.text} ${size === 'small' ? 'text-sm' : 'text-base'}`}>
                  {bin.daysUntil === 0 ? 'Today' : bin.daysUntil === 1 ? '1d' : `${bin.daysUntil}d`}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer - next collection preview */}
        {upcoming.length > 0 && size !== 'small' && (
          <div className="mt-2 pt-2 border-t border-amber-200 dark:border-slate-600">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Next: {formatCollectionDate(upcoming[0].date)} ({upcoming[0].bins.map(b => getBinInfo(b).emoji).join('')})
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
