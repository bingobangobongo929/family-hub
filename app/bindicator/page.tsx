'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Trash2, Info, Calendar, List } from 'lucide-react'
import Card from '@/components/Card'
import { useTranslation } from '@/lib/i18n-context'
import { getDateLocale } from '@/lib/date-locale'
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
  getAllCollections,
  isCollectionDay,
  getBinsForDate,
} from '@/lib/bin-schedule'
import { updateBinWidget } from '@/lib/widget-bridge'

type ViewMode = 'upcoming' | 'calendar' | 'by-bin'

export default function BindicatorPage() {
  const { t, locale } = useTranslation()
  const dateLocale = getDateLocale(locale)
  const [viewMode, setViewMode] = useState<ViewMode>('upcoming')
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1)) // Start in Jan 2026
  const [expandedBin, setExpandedBin] = useState<BinType | null>(null)

  // Get upcoming collections for next 60 days
  const upcoming = useMemo(() => getUpcomingCollections(60), [])

  // Get status for each bin type
  const binStatuses = useMemo(() => {
    return BIN_TYPES.map(bin => {
      const daysUntil = getDaysUntilCollection(bin.id)
      const nextDate = getNextCollection(bin.id)
      const urgency = getUrgencyLevel(daysUntil)
      const allDates = getAllCollections(bin.id)
      return {
        ...bin,
        daysUntil,
        nextDate,
        urgency,
        allDates,
      }
    }).sort((a, b) => a.daysUntil - b.daysUntil)
  }, [])

  // Find today's and tomorrow's bins
  const todayBins = binStatuses.filter(b => b.daysUntil === 0)
  const tomorrowBins = binStatuses.filter(b => b.daysUntil === 1)

  // Update iOS widget with bin data
  useEffect(() => {
    updateBinWidget(
      binStatuses.map(bin => ({
        id: bin.id,
        type: bin.id,
        name: bin.name,
        emoji: bin.emoji,
        nextDate: bin.nextDate || new Date(),
        daysUntil: bin.daysUntil,
      }))
    )
  }, [binStatuses])

  // Calendar helpers
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-header flex items-center gap-3">
            <Trash2 className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />
            {t('bindicator.title')}
          </h1>
          <p className="page-subtitle">{t('bindicator.subtitle')}</p>
        </div>

        {/* View mode toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
          <button
            onClick={() => setViewMode('upcoming')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'upcoming'
                ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
            }`}
          >
            <List className="w-4 h-4 inline mr-1.5" />
            {t('bindicator.upcoming')}
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-1.5" />
            {t('bindicator.calendar')}
          </button>
          <button
            onClick={() => setViewMode('by-bin')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'by-bin'
                ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
            }`}
          >
            <Trash2 className="w-4 h-4 inline mr-1.5" />
            {t('bindicator.byBin')}
          </button>
        </div>
      </div>

      {/* Alert banner for today/tomorrow */}
      {(todayBins.length > 0 || tomorrowBins.length > 0) && (
        <Card className={`mb-6 ${
          todayBins.length > 0
            ? 'bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/40 dark:to-red-800/20 border-red-200 dark:border-red-800'
            : 'bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/40 dark:to-orange-800/20 border-orange-200 dark:border-orange-800'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-xl font-bold ${
                todayBins.length > 0 ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300'
              }`}>
                {todayBins.length > 0 ? t('bindicator.putOutTonight') : t('bindicator.putOutTomorrow')}
              </h2>
              <p className={`text-sm ${
                todayBins.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
              }`}>
                {todayBins.length > 0
                  ? `${t('bindicator.collectionToday')} (${format(new Date(), 'EEEE, d MMMM', { locale: dateLocale })})`
                  : `${t('bindicator.collectionTomorrow')} (${format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'EEEE, d MMMM', { locale: dateLocale })})`
                }
              </p>
            </div>
            <div className="flex gap-2">
              {(todayBins.length > 0 ? todayBins : tomorrowBins).map(bin => (
                <div
                  key={bin.id}
                  className={`w-14 h-14 rounded-xl ${bin.bgColor} flex items-center justify-center text-2xl shadow-lg`}
                >
                  {bin.emoji}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Upcoming View */}
      {viewMode === 'upcoming' && (
        <div className="space-y-6">
          {/* Next 4 bins status cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {binStatuses.map(bin => {
              const urgencyStyles = getUrgencyStyles(bin.urgency)
              return (
                <Card
                  key={bin.id}
                  className={`${urgencyStyles.bg} border-2 ${urgencyStyles.border}`}
                >
                  <div className="text-center">
                    <div className={`w-16 h-16 mx-auto mb-2 rounded-xl ${bin.bgColor} flex items-center justify-center text-3xl shadow-lg`}>
                      {bin.emoji}
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{bin.shortName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{bin.description}</p>
                    <p className={`text-2xl font-bold ${urgencyStyles.text}`}>
                      {bin.daysUntil === 0 ? t('bindicator.today') : bin.daysUntil === 1 ? t('common.tomorrow') : t('bindicator.days', { count: bin.daysUntil })}
                    </p>
                    {bin.nextDate && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        {format(bin.nextDate, 'EEE, d MMM')}
                      </p>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Upcoming collections list */}
          <Card>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              {t('bindicator.upcomingCollections')}
            </h2>
            <div className="space-y-2">
              {upcoming.slice(0, 10).map((collection, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    isToday(collection.date)
                      ? 'bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
                      : 'bg-slate-50 dark:bg-slate-700/50'
                  }`}
                >
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {format(collection.date, 'EEEE, d MMMM', { locale: dateLocale })}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {collection.bins.map(b => getBinInfo(b).name).join(', ')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {collection.bins.map(b => (
                      <span key={b} className="text-xl">{getBinInfo(b).emoji}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Card>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
              {format(currentDate, 'MMMM yyyy', { locale: dateLocale })}
            </h2>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              const dayBins = getBinsForDate(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isCurrentDay = isToday(day)

              return (
                <div
                  key={idx}
                  className={`min-h-[80px] p-1 rounded-lg border ${
                    isCurrentDay
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                      : isCurrentMonth
                      ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'
                  }`}
                >
                  <span className={`text-xs font-medium ${
                    isCurrentDay
                      ? 'text-amber-600 dark:text-amber-400'
                      : isCurrentMonth
                      ? 'text-slate-700 dark:text-slate-300'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {dayBins.map(binType => (
                      <span key={binType} className="text-sm" title={getBinInfo(binType).name}>
                        {getBinInfo(binType).emoji}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex flex-wrap gap-4 justify-center">
              {BIN_TYPES.map(bin => (
                <div key={bin.id} className="flex items-center gap-1.5 text-sm">
                  <span>{bin.emoji}</span>
                  <span className="text-slate-600 dark:text-slate-400">{bin.shortName}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* By Bin View */}
      {viewMode === 'by-bin' && (
        <div className="space-y-4">
          {binStatuses.map(bin => (
            <Card key={bin.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedBin(expandedBin === bin.id ? null : bin.id)}
                className="w-full flex items-center gap-4 text-left"
              >
                <div className={`w-14 h-14 rounded-xl ${bin.bgColor} flex items-center justify-center text-2xl shadow-lg flex-shrink-0`}>
                  {bin.emoji}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{bin.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{bin.description}</p>
                  <p className={`text-sm font-medium ${getUrgencyStyles(bin.urgency).text}`}>
                    {t('bindicator.next')}: {bin.nextDate ? format(bin.nextDate, 'EEE, d MMM', { locale: dateLocale }) : t('bindicator.noneScheduled')}
                    {bin.daysUntil >= 0 && ` (${bin.daysUntil === 0 ? t('bindicator.today') : bin.daysUntil === 1 ? t('common.tomorrow') : t('bindicator.days', { count: bin.daysUntil })})`}
                  </p>
                </div>
                <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${expandedBin === bin.id ? 'rotate-90' : ''}`} />
              </button>

              {/* Expanded dates list */}
              {expandedBin === bin.id && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {t('bindicator.allDatesFor2026', { count: bin.allDates.length })}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {bin.allDates.map((date, idx) => {
                      const isPast = date < new Date()
                      const isNext = bin.nextDate && isSameDay(date, bin.nextDate)
                      return (
                        <div
                          key={idx}
                          className={`text-center p-2 rounded-lg text-sm ${
                            isNext
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold'
                              : isPast
                              ? 'text-slate-400 dark:text-slate-600 line-through'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {format(date, 'd MMM')}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Reference Section */}
      <Card className="mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('bindicator.whatGoesIn')}
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🌿</span>
              <h3 className="font-semibold text-green-800 dark:text-green-200">{t('bins.bio.name')}</h3>
            </div>
            <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <li>{t('bins.bio.items.garden')}</li>
              <li>{t('bins.bio.items.food')}</li>
              <li>{t('bins.bio.items.compostable')}</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🗑️</span>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('bins.main.name')}</h3>
            </div>
            <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
              <li>{t('bins.main.items.nonRecyclable')}</li>
              <li>{t('bins.main.items.nappies')}</li>
              <li>{t('bins.main.items.polystyrene')}</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📦</span>
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">{t('bins.paper.name')}</h3>
            </div>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>{t('bins.paper.items.cardboard')}</li>
              <li>{t('bins.paper.items.newspapers')}</li>
              <li>{t('bins.paper.items.paper')}</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">♻️</span>
              <h3 className="font-semibold text-emerald-800 dark:text-emerald-200">{t('bins.pmg.name')}</h3>
            </div>
            <ul className="text-sm text-emerald-700 dark:text-emerald-300 space-y-1">
              <li>{t('bins.pmg.items.plastic')}</li>
              <li>{t('bins.pmg.items.metal')}</li>
              <li>{t('bins.pmg.items.glass')}</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
