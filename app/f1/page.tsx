'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { Wrench, Clock, Zap, Flag, Newspaper, ExternalLink, Star, Loader2, RefreshCw, Filter, EyeOff, Eye, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import {
  OpenF1Meeting,
  OpenF1Session,
  F1Driver,
  F1Constructor,
  SESSION_NAMES,
  getCountdown,
  toDanishTime,
  formatDanishTime,
  formatDanishDate,
  getTeamColor,
  getCurrentRaceWeekend,
} from '@/lib/f1-api'
import { useTranslation } from '@/lib/i18n-context'
import { getDateLocale } from '@/lib/date-locale'
import { useSettings } from '@/lib/settings-context'

// Session icon component
function SessionIcon({ sessionName, className = "w-5 h-5" }: { sessionName: string; className?: string }) {
  if (sessionName.includes('Practice')) {
    return <Wrench className={className} />
  }
  if (sessionName.includes('Qualifying') || sessionName.includes('Sprint Shootout')) {
    return <Clock className={className} />
  }
  if (sessionName.includes('Sprint') && !sessionName.includes('Qualifying') && !sessionName.includes('Shootout')) {
    return <Zap className={className} />
  }
  return <Flag className={className} />
}

// Flag image component using API-provided URL
function CountryFlag({ flagUrl, size = 'md' }: { flagUrl: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: { w: 32, h: 18 }, md: { w: 48, h: 27 }, lg: { w: 64, h: 36 } }
  const { w, h } = sizes[size]

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl}
      alt=""
      width={w}
      height={h}
      className="rounded shadow-sm object-cover"
    />
  )
}

interface ScheduleData {
  schedule: (OpenF1Meeting & { sessions: OpenF1Session[] })[]
  year: number
}

interface StandingsData {
  drivers: F1Driver[]
  constructors: F1Constructor[]
  year: number
}

interface F1NewsItem {
  id: string
  title: string
  description: string
  link: string
  pubDate: string
  imageUrl?: string
  isInteresting: boolean
  isSpoiler: boolean
  category?: 'race' | 'driver' | 'technical' | 'calendar' | 'other'
}

interface NewsData {
  items: F1NewsItem[]
  cached: boolean
  timestamp: number
}

type TabType = 'calendar' | 'drivers' | 'constructors' | 'news'

// Wrapper component with Suspense for useSearchParams
export default function F1Page() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-slate-100 dark:bg-slate-900">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        </main>
      </div>
    }>
      <F1PageContent />
    </Suspense>
  )
}

function F1PageContent() {
  const { t, locale } = useTranslation()
  const dateLocale = getDateLocale(locale)
  const { aiModel, f1SpoilerFreeAutoWeekend, f1SpoilerFreeManualOverride, updateSetting } = useSettings()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Get initial tab from URL or default to 'calendar'
  const tabFromUrl = searchParams.get('tab') as TabType | null
  const validTabs: TabType[] = ['calendar', 'drivers', 'constructors', 'news']
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'calendar'

  const [activeTab, setActiveTab] = useState<TabType>(initialTab)

  // Update URL when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`/f1?${params.toString()}`, { scroll: false })
  }
  const [schedule, setSchedule] = useState<ScheduleData | null>(null)
  const [standings, setStandings] = useState<StandingsData | null>(null)
  const [news, setNews] = useState<NewsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [newsLoading, setNewsLoading] = useState(false)
  const [showAllNews, setShowAllNews] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['race', 'driver', 'technical', 'calendar', 'other'])
  const [selectedYear] = useState(2026)
  const [isRaceWeekend, setIsRaceWeekend] = useState(false)
  const [currentRace, setCurrentRace] = useState<string | null>(null)

  // Spoiler-free mode: manual override takes priority, otherwise auto-detect on race weekends
  const spoilerFreeActive = f1SpoilerFreeManualOverride !== null
    ? f1SpoilerFreeManualOverride
    : (f1SpoilerFreeAutoWeekend && isRaceWeekend)

  // Toggle spoiler-free mode (sets manual override)
  const toggleSpoilerFree = () => {
    updateSetting('f1_spoiler_free_manual_override', spoilerFreeActive ? false : true)
  }

  // Clear manual override (return to auto mode)
  const clearSpoilerFreeOverride = () => {
    updateSetting('f1_spoiler_free_manual_override', null)
  }

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [scheduleRes, standingsRes] = await Promise.all([
          fetch(`/api/f1/schedule?year=${selectedYear}`),
          fetch(`/api/f1/standings?year=${selectedYear}`),
        ])

        if (scheduleRes.ok) {
          setSchedule(await scheduleRes.json())
        }
        if (standingsRes.ok) {
          setStandings(await standingsRes.json())
        }
      } catch (error) {
        console.error('Error fetching F1 data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedYear])

  // Check if it's a race weekend for auto spoiler-free mode
  useEffect(() => {
    async function checkRaceWeekend() {
      try {
        const weekend = await getCurrentRaceWeekend(selectedYear)
        if (weekend?.isRaceWeekend) {
          setIsRaceWeekend(true)
          setCurrentRace(weekend.meeting.meeting_name)
        } else {
          setIsRaceWeekend(false)
          setCurrentRace(null)
        }
      } catch (error) {
        console.error('Error checking race weekend:', error)
        setIsRaceWeekend(false)
      }
    }
    checkRaceWeekend()
  }, [selectedYear])

  // Fetch news function
  const fetchNews = async (forceRefresh = false, reclassify = false) => {
    setNewsLoading(true)
    try {
      let url = `/api/f1/news?model=${aiModel}`
      if (reclassify) url += '&reclassify=true'
      else if (forceRefresh) url += '&refresh=true'
      const response = await fetch(url)
      if (response.ok) {
        setNews(await response.json())
      }
    } catch (error) {
      console.error('Error fetching F1 news:', error)
    } finally {
      setNewsLoading(false)
    }
  }

  // Fetch news when tab changes to news
  useEffect(() => {
    if (activeTab === 'news' && !news) {
      fetchNews()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Find next race
  const nextRace = useMemo(() => {
    if (!schedule?.schedule) return null
    const now = new Date()
    return schedule.schedule.find(m => new Date(m.date_start) > now)
  }, [schedule])

  // Past races
  const pastRaces = useMemo(() => {
    if (!schedule?.schedule) return []
    const now = new Date()
    return schedule.schedule.filter(m => {
      const raceEnd = new Date(m.date_start)
      raceEnd.setDate(raceEnd.getDate() + 3)
      return raceEnd < now
    })
  }, [schedule])

  // Upcoming races
  const upcomingRaces = useMemo(() => {
    if (!schedule?.schedule) return []
    const now = new Date()
    return schedule.schedule.filter(m => new Date(m.date_start) >= now)
  }, [schedule])

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🏎️</span>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
                  Formula 1 {selectedYear}
                </h1>
              </div>

              {/* Spoiler-Free Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSpoilerFree}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                    spoilerFreeActive
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-2 border-amber-300 dark:border-amber-700'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent'
                  }`}
                  title={spoilerFreeActive ? t('f1.spoilerFreeOn') : t('f1.spoilerFreeOff')}
                >
                  {spoilerFreeActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span className="hidden sm:inline">
                    {spoilerFreeActive ? t('f1.spoilerFree') : t('f1.showSpoilers')}
                  </span>
                </button>

                {/* Show override status */}
                {f1SpoilerFreeManualOverride !== null && (
                  <button
                    onClick={clearSpoilerFreeOverride}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
                    title={t('f1.returnToAuto')}
                  >
                    {isRaceWeekend ? t('f1.autoMode') : t('f1.reset')}
                  </button>
                )}
              </div>
            </div>

            {/* Race weekend alert */}
            {isRaceWeekend && currentRace && (
              <div className={`mb-3 px-4 py-2 rounded-lg text-sm ${
                spoilerFreeActive
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                <span className="font-medium">{t('f1.raceWeekend')}:</span> {currentRace}
                {spoilerFreeActive && f1SpoilerFreeManualOverride === null && (
                  <span className="ml-2 text-xs opacity-75">({t('f1.spoilerFreeAutoEnabled')})</span>
                )}
              </div>
            )}

            {/* Next race countdown */}
            {nextRace && (
              <NextRaceCountdown meeting={nextRace} spoilerFree={spoilerFreeActive} />
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
            {[
              { id: 'calendar', label: t('f1.calendar'), icon: '📅' },
              { id: 'news', label: t('f1.news'), icon: '📰' },
              { id: 'drivers', label: t('f1.drivers'), icon: '👤' },
              { id: 'constructors', label: t('f1.teams'), icon: '🏢' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-red-600 border-b-2 border-red-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'calendar' && schedule && (
                <CalendarView
                  races={schedule.schedule}
                  upcomingRaces={upcomingRaces}
                  pastRaces={pastRaces}
                  t={t}
                  locale={locale}
                />
              )}
              {activeTab === 'news' && (
                <NewsView
                  news={news}
                  loading={newsLoading}
                  showAll={showAllNews}
                  onToggleShowAll={() => setShowAllNews(!showAllNews)}
                  selectedCategories={selectedCategories}
                  onCategoryChange={setSelectedCategories}
                  onRefresh={() => fetchNews(true)}
                  onReclassify={() => fetchNews(false, true)}
                  spoilerFree={spoilerFreeActive}
                  t={t}
                  locale={locale}
                />
              )}
              {activeTab === 'drivers' && standings && (
                <DriversStandings drivers={standings.drivers} t={t} />
              )}
              {activeTab === 'constructors' && standings && (
                <ConstructorsStandings constructors={standings.constructors} t={t} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// Next race countdown component
function NextRaceCountdown({ meeting, spoilerFree = false }: { meeting: OpenF1Meeting & { sessions?: OpenF1Session[] }, spoilerFree?: boolean }) {
  const { t, locale } = useTranslation()
  const dateLocale = getDateLocale(locale)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, text: '' })

  // Find next session
  const nextSession = useMemo(() => {
    if (!meeting.sessions?.length) return null
    const now = new Date()
    return meeting.sessions.find(s => new Date(s.date_start) > now)
  }, [meeting.sessions])

  useEffect(() => {
    function update() {
      const targetDate = nextSession
        ? new Date(nextSession.date_start)
        : new Date(meeting.date_start)
      setCountdown(getCountdown(targetDate))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [meeting, nextSession])

  const danishDate = toDanishTime(new Date(meeting.date_start))

  return (
    <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-4 text-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <CountryFlag flagUrl={meeting.country_flag} size="lg" />
          <div>
            <p className="text-sm text-white/80 uppercase tracking-wide">{t('f1.nextRace')}</p>
            <p className="text-xl md:text-2xl font-bold">{meeting.meeting_name}</p>
            <p className="text-sm text-white/80">
              {meeting.circuit_short_name} • {meeting.country_name}
            </p>
            <p className="text-sm text-white/70 mt-1">
              {formatDanishDate(danishDate)}
            </p>
          </div>
        </div>
        <div className="text-center md:text-right">
          <p className="text-sm text-white/80 mb-1">
            {nextSession ? t('f1.untilSession', { session: SESSION_NAMES[nextSession.session_name] || nextSession.session_name }) : t('f1.countdown')}
          </p>
          <div className="flex gap-3 justify-center md:justify-end">
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold font-mono">{countdown.days}</p>
              <p className="text-xs text-white/70">{t('f1.days')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold font-mono">{countdown.hours}</p>
              <p className="text-xs text-white/70">{t('f1.hours')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold font-mono">{countdown.minutes}</p>
              <p className="text-xs text-white/70">{t('f1.mins')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions preview with icons */}
      {meeting.sessions && meeting.sessions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="text-xs text-white/70 mb-2">{t('f1.sessionsLocalTime')}</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {meeting.sessions.map(session => {
              const sessionDate = toDanishTime(new Date(session.date_start))
              const isPast = new Date(session.date_start) < new Date()

              return (
                <div
                  key={session.session_key}
                  className={`bg-white/10 rounded-lg p-2 text-center ${isPast ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <SessionIcon sessionName={session.session_name} className="w-4 h-4" />
                    <p className="text-xs font-medium">
                      {SESSION_NAMES[session.session_name] || session.session_name}
                    </p>
                  </div>
                  <p className="text-xs text-white/70">
                    {sessionDate.toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB', { weekday: 'short' })} {formatDanishTime(sessionDate)}
                  </p>
                  {isPast && <span className="text-xs text-white/50">{t('f1.done')}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Calendar view component
function CalendarView({
  races,
  upcomingRaces,
  pastRaces,
  t,
  locale,
}: {
  races: (OpenF1Meeting & { sessions: OpenF1Session[] })[]
  upcomingRaces: OpenF1Meeting[]
  pastRaces: OpenF1Meeting[]
  t: (key: string, params?: Record<string, any>) => string
  locale: string
}) {
  return (
    <div className="space-y-6">
      {/* Upcoming races */}
      {upcomingRaces.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
            {t('f1.upcomingRaces', { count: upcomingRaces.length })}
          </h2>
          <div className="grid gap-3">
            {upcomingRaces.map((race, index) => (
              <RaceCard
                key={race.meeting_key}
                race={race as OpenF1Meeting & { sessions: OpenF1Session[] }}
                isNext={index === 0}
                t={t}
                locale={locale}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past races */}
      {pastRaces.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
            {t('f1.completedRaces', { count: pastRaces.length })}
          </h2>
          <div className="grid gap-3">
            {pastRaces.map(race => (
              <RaceCard
                key={race.meeting_key}
                race={race as OpenF1Meeting & { sessions: OpenF1Session[] }}
                isPast
                t={t}
                locale={locale}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Individual race card with flag
function RaceCard({
  race,
  isNext = false,
  isPast = false,
  t,
  locale,
}: {
  race: OpenF1Meeting & { sessions: OpenF1Session[] }
  isNext?: boolean
  isPast?: boolean
  t: (key: string, params?: Record<string, any>) => string
  locale: string
}) {
  const [expanded, setExpanded] = useState(false)
  const raceDate = toDanishTime(new Date(race.date_start))

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border-2 transition-all ${
        isNext
          ? 'border-red-500'
          : isPast
          ? 'border-slate-200 dark:border-slate-700 opacity-70'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <CountryFlag flagUrl={race.country_flag} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {race.meeting_name}
              </p>
              {isNext && (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full font-medium">
                  {t('f1.next')}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {race.circuit_short_name} • {raceDate.toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl">
          {expanded ? '−' : '+'}
        </button>
      </div>

      {/* Expanded session details with icons */}
      {expanded && race.sessions && race.sessions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {race.sessions.map(session => {
              const sessionDate = toDanishTime(new Date(session.date_start))
              const isSessionPast = new Date(session.date_start) < new Date()

              return (
                <div
                  key={session.session_key}
                  className={`p-3 rounded-lg ${
                    isSessionPast
                      ? 'bg-slate-100 dark:bg-slate-700/50'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SessionIcon sessionName={session.session_name} className={`w-5 h-5 ${isSessionPast ? 'text-slate-400' : 'text-red-500'}`} />
                    <p className={`font-medium ${isSessionPast ? 'text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                      {SESSION_NAMES[session.session_name] || session.session_name}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {sessionDate.toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {formatDanishTime(sessionDate)}
                  </p>
                  {isSessionPast && (
                    <span className="text-xs text-slate-400">{t('f1.completed')}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Drivers standings component
function DriversStandings({ drivers, t }: { drivers: F1Driver[]; t: (key: string, params?: Record<string, any>) => string }) {
  if (!drivers.length) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>{t('f1.noDriverStandings')}</p>
        <p className="text-sm mt-2">{t('f1.standingsWillAppear')}</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-700/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('f1.pos')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('f1.driver')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">{t('f1.team')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('f1.points')}</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver, index) => (
            <tr
              key={driver.driverId}
              className={`border-t border-slate-100 dark:border-slate-700 ${
                index < 3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
              }`}
            >
              <td className="px-4 py-3">
                <span className={`font-bold ${
                  index === 0 ? 'text-yellow-500' :
                  index === 1 ? 'text-slate-400' :
                  index === 2 ? 'text-amber-600' :
                  'text-slate-600 dark:text-slate-400'
                }`}>
                  {driver.position}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-1 h-8 rounded-full"
                    style={{ backgroundColor: getTeamColor(driver.constructorId) }}
                  />
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {driver.givenName} <span className="uppercase">{driver.familyName}</span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 sm:hidden">
                      {driver.constructorName}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                {driver.constructorName}
              </td>
              <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                {driver.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Constructors standings component
function ConstructorsStandings({ constructors, t }: { constructors: F1Constructor[]; t: (key: string, params?: Record<string, any>) => string }) {
  if (!constructors.length) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>{t('f1.noConstructorStandings')}</p>
        <p className="text-sm mt-2">{t('f1.standingsWillAppear')}</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-700/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('f1.pos')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('f1.team')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('f1.points')}</th>
          </tr>
        </thead>
        <tbody>
          {constructors.map((team, index) => (
            <tr
              key={team.constructorId}
              className={`border-t border-slate-100 dark:border-slate-700 ${
                index < 3 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
              }`}
            >
              <td className="px-4 py-3">
                <span className={`font-bold ${
                  index === 0 ? 'text-yellow-500' :
                  index === 1 ? 'text-slate-400' :
                  index === 2 ? 'text-amber-600' :
                  'text-slate-600 dark:text-slate-400'
                }`}>
                  {team.position}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-1 h-8 rounded-full"
                    style={{ backgroundColor: getTeamColor(team.constructorId) }}
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {team.name}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                {team.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Category config
const CATEGORIES = [
  { id: 'race', label: 'Race', icon: '🏁', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { id: 'driver', label: 'Driver', icon: '👤', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { id: 'technical', label: 'Technical', icon: '🔧', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { id: 'calendar', label: 'Calendar', icon: '📅', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { id: 'other', label: 'Other', icon: '📰', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400' },
]

// News view component
function NewsView({
  news,
  loading,
  showAll,
  onToggleShowAll,
  selectedCategories,
  onCategoryChange,
  onRefresh,
  onReclassify,
  spoilerFree,
  t,
  locale,
}: {
  news: NewsData | null
  loading: boolean
  showAll: boolean
  onToggleShowAll: () => void
  selectedCategories: string[]
  onCategoryChange: (categories: string[]) => void
  onRefresh: () => void
  onReclassify: () => void
  spoilerFree: boolean
  t: (key: string, params?: Record<string, any>) => string
  locale: string
}) {
  const toggleCategory = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      if (selectedCategories.length > 1) {
        onCategoryChange(selectedCategories.filter(c => c !== categoryId))
      }
    } else {
      onCategoryChange([...selectedCategories, categoryId])
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-2" />
          <p className="text-slate-500 dark:text-slate-400">{t('f1.filteringNews')}</p>
        </div>
      </div>
    )
  }

  if (!news || news.items.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Newspaper className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p>{t('f1.noNews')}</p>
      </div>
    )
  }

  // Filter by interesting, categories, and spoiler-free mode
  const interestingNews = news.items.filter(item => item.isInteresting)
  const spoilerFilteredNews = spoilerFree
    ? news.items.filter(item => !item.isSpoiler)
    : news.items
  const baseNews = showAll ? spoilerFilteredNews : spoilerFilteredNews.filter(item => item.isInteresting)
  const displayNews = baseNews.filter(item =>
    selectedCategories.includes(item.category || 'other')
  )
  const hiddenSpoilerCount = spoilerFree ? news.items.filter(item => item.isSpoiler).length : 0

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return ''

      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffHours / 24)

      if (diffHours < 1) return locale === 'da' ? 'Lige nu' : 'Just now'
      if (diffHours < 24) return locale === 'da' ? `${diffHours}t siden` : `${diffHours}h ago`
      if (diffDays < 7) return locale === 'da' ? `${diffDays}d siden` : `${diffDays}d ago`

      return date.toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB', {
        day: 'numeric',
        month: 'short',
      })
    } catch {
      return ''
    }
  }

  const getCategoryConfig = (category: string) =>
    CATEGORIES.find(c => c.id === category) || CATEGORIES[4]

  // Count articles per category (from filtered news)
  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = baseNews.filter(item => (item.category || 'other') === cat.id).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      {/* Spoiler-free banner */}
      {spoilerFree && (
        <div className="flex items-center gap-2 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-800 dark:text-amber-300">
          <EyeOff className="w-5 h-5 flex-shrink-0" />
          <div>
            <span className="font-medium">{t('f1.spoilerFreeActive')}</span>
            {hiddenSpoilerCount > 0 && (
              <span className="ml-2 text-sm opacity-80">
                ({t('f1.spoilersHidden', { count: hiddenSpoilerCount })})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Category filters */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl">
        <Filter className="w-4 h-4 text-slate-400" />
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => toggleCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedCategories.includes(cat.id)
                ? cat.color
                : 'bg-slate-50 text-slate-400 dark:bg-slate-700/50'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
            <span className="text-xs opacity-70">({categoryCounts[cat.id]})</span>
          </button>
        ))}
      </div>

      {/* Header with toggles and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {t('f1.aiFiltered', { count: interestingNews.length, total: news.items.length })}
            </span>
          </div>
          {news.cached && (
            <span className="text-xs text-slate-400">
              (cached)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReclassify}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-500 transition-colors"
            title="Re-classify all articles with AI"
          >
            <Sparkles className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            title="Refresh news"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onToggleShowAll}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showAll
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            {showAll ? t('f1.showFiltered') : t('f1.showAll')}
          </button>
        </div>
      </div>

      {/* News list */}
      <div className="space-y-3">
        {displayNews.length === 0 ? (
          <p className="text-center py-8 text-slate-500">
            No articles match the selected filters
          </p>
        ) : (
          displayNews.map(item => {
            const catConfig = getCategoryConfig(item.category || 'other')
            return (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`block bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border-2 transition-all hover:shadow-md ${
                  item.isInteresting
                    ? 'border-red-200 dark:border-red-900/50'
                    : 'border-slate-200 dark:border-slate-700 opacity-70'
                }`}
              >
                <div className="flex">
                  {/* Image */}
                  {item.imageUrl && (
                    <div className="w-32 sm:w-40 flex-shrink-0 bg-slate-100 dark:bg-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ minHeight: '100px' }}
                      />
                    </div>
                  )}
                  {/* Content */}
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${catConfig.color}`}>
                          {catConfig.icon} {catConfig.label}
                        </span>
                        {item.isInteresting && (
                          <Star className="w-3.5 h-3.5 text-yellow-500" />
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                      {item.description}
                    </p>
                    {item.pubDate && (
                      <span className="text-xs text-slate-400">
                        {formatDate(item.pubDate)}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            )
          })
        )}
      </div>

      {/* Hidden articles toggle */}
      {news.items.filter(i => !i.isInteresting).length > 0 && (
        <button
          onClick={onToggleShowAll}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4" />
              <span>{t('f1.hideUninteresting')}</span>
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              <span>{t('f1.hiddenNews', { count: news.items.filter(i => !i.isInteresting).length })}</span>
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  )
}
