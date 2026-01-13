'use client'

import { useState, useEffect, useMemo } from 'react'
import Sidebar from '@/components/Sidebar'
import { Wrench, Clock, Zap, Flag } from 'lucide-react'
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
} from '@/lib/f1-api'

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

type TabType = 'calendar' | 'drivers' | 'constructors'

export default function F1Page() {
  const [activeTab, setActiveTab] = useState<TabType>('calendar')
  const [schedule, setSchedule] = useState<ScheduleData | null>(null)
  const [standings, setStandings] = useState<StandingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedYear] = useState(2026)

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
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">🏎️</span>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
                Formula 1 {selectedYear}
              </h1>
            </div>

            {/* Next race countdown */}
            {nextRace && (
              <NextRaceCountdown meeting={nextRace} />
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
            {[
              { id: 'calendar', label: 'Calendar', icon: '📅' },
              { id: 'drivers', label: 'Drivers', icon: '👤' },
              { id: 'constructors', label: 'Teams', icon: '🏢' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
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
                />
              )}
              {activeTab === 'drivers' && standings && (
                <DriversStandings drivers={standings.drivers} />
              )}
              {activeTab === 'constructors' && standings && (
                <ConstructorsStandings constructors={standings.constructors} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// Next race countdown component
function NextRaceCountdown({ meeting }: { meeting: OpenF1Meeting & { sessions?: OpenF1Session[] } }) {
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
            <p className="text-sm text-white/80 uppercase tracking-wide">Next Race</p>
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
            {nextSession ? `Until ${SESSION_NAMES[nextSession.session_name] || nextSession.session_name}` : 'Countdown'}
          </p>
          <div className="flex gap-3 justify-center md:justify-end">
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold font-mono">{countdown.days}</p>
              <p className="text-xs text-white/70">days</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold font-mono">{countdown.hours}</p>
              <p className="text-xs text-white/70">hours</p>
            </div>
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-bold font-mono">{countdown.minutes}</p>
              <p className="text-xs text-white/70">mins</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions preview with icons */}
      {meeting.sessions && meeting.sessions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="text-xs text-white/70 mb-2">Sessions (Danish Time)</p>
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
                    {sessionDate.toLocaleDateString('da-DK', { weekday: 'short' })} {formatDanishTime(sessionDate)}
                  </p>
                  {isPast && <span className="text-xs text-white/50">Done</span>}
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
}: {
  races: (OpenF1Meeting & { sessions: OpenF1Session[] })[]
  upcomingRaces: OpenF1Meeting[]
  pastRaces: OpenF1Meeting[]
}) {
  return (
    <div className="space-y-6">
      {/* Upcoming races */}
      {upcomingRaces.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
            Upcoming Races ({upcomingRaces.length})
          </h2>
          <div className="grid gap-3">
            {upcomingRaces.map((race, index) => (
              <RaceCard
                key={race.meeting_key}
                race={race as OpenF1Meeting & { sessions: OpenF1Session[] }}
                isNext={index === 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past races */}
      {pastRaces.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
            Completed Races ({pastRaces.length})
          </h2>
          <div className="grid gap-3">
            {pastRaces.map(race => (
              <RaceCard
                key={race.meeting_key}
                race={race as OpenF1Meeting & { sessions: OpenF1Session[] }}
                isPast
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
}: {
  race: OpenF1Meeting & { sessions: OpenF1Session[] }
  isNext?: boolean
  isPast?: boolean
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
                  Next
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {race.circuit_short_name} • {raceDate.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
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
                    {sessionDate.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {formatDanishTime(sessionDate)}
                  </p>
                  {isSessionPast && (
                    <span className="text-xs text-slate-400">Completed</span>
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
function DriversStandings({ drivers }: { drivers: F1Driver[] }) {
  if (!drivers.length) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No driver standings available yet</p>
        <p className="text-sm mt-2">Standings will appear once the season starts</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-700/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Pos</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Driver</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">Team</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Points</th>
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
function ConstructorsStandings({ constructors }: { constructors: F1Constructor[] }) {
  if (!constructors.length) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No constructor standings available yet</p>
        <p className="text-sm mt-2">Standings will appear once the season starts</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-700/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Pos</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Team</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Points</th>
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
