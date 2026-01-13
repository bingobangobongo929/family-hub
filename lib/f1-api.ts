// F1 API utilities using Jolpica (Ergast-compatible) and OpenF1 APIs

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1'
const OPENF1_BASE = 'https://api.openf1.org/v1'

// Types
export interface F1Race {
  round: number
  raceName: string
  circuitName: string
  circuitId: string
  country: string
  locality: string
  date: string // ISO date
  time?: string // ISO time
  sessions: F1Session[]
}

export interface F1Session {
  type: 'FP1' | 'FP2' | 'FP3' | 'Qualifying' | 'Sprint' | 'Race' | 'SprintQualifying'
  date: string
  time: string // UTC time
  dateTimeUTC: Date
  dateTimeDanish: Date
}

export interface F1Driver {
  position: number
  driverId: string
  driverNumber: string
  code: string
  givenName: string
  familyName: string
  nationality: string
  constructorId: string
  constructorName: string
  points: number
  wins: number
}

export interface F1Constructor {
  position: number
  constructorId: string
  name: string
  nationality: string
  points: number
  wins: number
}

export interface F1SessionResult {
  position: number
  driverId: string
  driverCode: string
  driverName: string
  constructorName: string
  time?: string
  gap?: string
  laps?: number
  status: string
  points: number
}

export interface OpenF1Meeting {
  meeting_key: number
  meeting_name: string
  meeting_official_name: string
  circuit_key: number
  circuit_short_name: string
  country_name: string
  country_code: string
  country_key: number
  date_start: string
  year: number
}

export interface OpenF1Session {
  session_key: number
  session_name: string
  session_type: string
  meeting_key: number
  date_start: string
  date_end: string
  gmt_offset: string
}

// Convert UTC to Danish time (Europe/Copenhagen)
export function toDanishTime(utcDate: Date): Date {
  return new Date(utcDate.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }))
}

// Format date for display in Danish
export function formatDanishDateTime(date: Date): string {
  return date.toLocaleString('da-DK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDanishDate(date: Date): string {
  return date.toLocaleDateString('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function formatDanishTime(date: Date): string {
  return date.toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Get countdown string
export function getCountdown(targetDate: Date): { days: number; hours: number; minutes: number; text: string } {
  const now = new Date()
  const diff = targetDate.getTime() - now.getTime()

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, text: 'Now!' }
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  let text = ''
  if (days > 0) text += `${days}d `
  if (hours > 0 || days > 0) text += `${hours}h `
  text += `${minutes}m`

  return { days, hours, minutes, text: text.trim() }
}

// Session type display names
export const SESSION_NAMES: Record<string, string> = {
  'Practice 1': 'FP1',
  'Practice 2': 'FP2',
  'Practice 3': 'FP3',
  'Qualifying': 'Quali',
  'Sprint Qualifying': 'Sprint Quali',
  'Sprint': 'Sprint',
  'Race': 'Race',
}

// Session type colors
export const SESSION_COLORS: Record<string, string> = {
  'FP1': 'bg-slate-500',
  'FP2': 'bg-slate-500',
  'FP3': 'bg-slate-500',
  'Quali': 'bg-yellow-500',
  'Sprint Quali': 'bg-orange-500',
  'Sprint': 'bg-orange-500',
  'Race': 'bg-red-500',
}

// Fetch season schedule from OpenF1
export async function fetchSeasonSchedule(year: number = 2026): Promise<OpenF1Meeting[]> {
  try {
    const response = await fetch(`${OPENF1_BASE}/meetings?year=${year}`)
    if (!response.ok) throw new Error('Failed to fetch schedule')
    const meetings: OpenF1Meeting[] = await response.json()
    return meetings.sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return []
  }
}

// Fetch sessions for a specific meeting
export async function fetchMeetingSessions(meetingKey: number): Promise<OpenF1Session[]> {
  try {
    const response = await fetch(`${OPENF1_BASE}/sessions?meeting_key=${meetingKey}`)
    if (!response.ok) throw new Error('Failed to fetch sessions')
    const sessions: OpenF1Session[] = await response.json()
    return sessions.sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return []
  }
}

// Fetch all sessions for a year
export async function fetchAllSessions(year: number = 2026): Promise<OpenF1Session[]> {
  try {
    const response = await fetch(`${OPENF1_BASE}/sessions?year=${year}`)
    if (!response.ok) throw new Error('Failed to fetch sessions')
    const sessions: OpenF1Session[] = await response.json()
    return sessions.sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return []
  }
}

// Get next upcoming session
export async function getNextSession(year: number = 2026): Promise<{ meeting: OpenF1Meeting; session: OpenF1Session } | null> {
  try {
    const now = new Date()
    const sessions = await fetchAllSessions(year)
    const meetings = await fetchSeasonSchedule(year)

    // Find next session that hasn't started yet
    const nextSession = sessions.find(s => new Date(s.date_start) > now)
    if (!nextSession) return null

    const meeting = meetings.find(m => m.meeting_key === nextSession.meeting_key)
    if (!meeting) return null

    return { meeting, session: nextSession }
  } catch (error) {
    console.error('Error getting next session:', error)
    return null
  }
}

// Get current race weekend (if we're in one)
export async function getCurrentRaceWeekend(year: number = 2026): Promise<{
  meeting: OpenF1Meeting
  sessions: OpenF1Session[]
  isRaceWeekend: boolean
} | null> {
  try {
    const now = new Date()
    const meetings = await fetchSeasonSchedule(year)

    // Find meeting where we're within the weekend (3 days before race to race day)
    for (const meeting of meetings) {
      const meetingStart = new Date(meeting.date_start)
      const meetingEnd = new Date(meetingStart)
      meetingEnd.setDate(meetingEnd.getDate() + 4) // Race weekends span ~4 days

      // Check if we're 3 days before or during the weekend
      const preWeekendStart = new Date(meetingStart)
      preWeekendStart.setDate(preWeekendStart.getDate() - 1)

      if (now >= preWeekendStart && now <= meetingEnd) {
        const sessions = await fetchMeetingSessions(meeting.meeting_key)
        return { meeting, sessions, isRaceWeekend: true }
      }
    }

    return null
  } catch (error) {
    console.error('Error getting current race weekend:', error)
    return null
  }
}

// Fetch driver standings from Jolpica (Ergast-compatible)
export async function fetchDriverStandings(year: number = 2026): Promise<F1Driver[]> {
  try {
    const response = await fetch(`${JOLPICA_BASE}/${year}/driverStandings.json`)
    if (!response.ok) throw new Error('Failed to fetch driver standings')
    const data = await response.json()

    const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []

    return standings.map((s: any) => ({
      position: parseInt(s.position),
      driverId: s.Driver.driverId,
      driverNumber: s.Driver.permanentNumber,
      code: s.Driver.code,
      givenName: s.Driver.givenName,
      familyName: s.Driver.familyName,
      nationality: s.Driver.nationality,
      constructorId: s.Constructors?.[0]?.constructorId || '',
      constructorName: s.Constructors?.[0]?.name || '',
      points: parseFloat(s.points),
      wins: parseInt(s.wins),
    }))
  } catch (error) {
    console.error('Error fetching driver standings:', error)
    return []
  }
}

// Fetch constructor standings from Jolpica
export async function fetchConstructorStandings(year: number = 2026): Promise<F1Constructor[]> {
  try {
    const response = await fetch(`${JOLPICA_BASE}/${year}/constructorStandings.json`)
    if (!response.ok) throw new Error('Failed to fetch constructor standings')
    const data = await response.json()

    const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || []

    return standings.map((s: any) => ({
      position: parseInt(s.position),
      constructorId: s.Constructor.constructorId,
      name: s.Constructor.name,
      nationality: s.Constructor.nationality,
      points: parseFloat(s.points),
      wins: parseInt(s.wins),
    }))
  } catch (error) {
    console.error('Error fetching constructor standings:', error)
    return []
  }
}

// Fetch race results from Jolpica
export async function fetchRaceResults(year: number, round: number): Promise<F1SessionResult[]> {
  try {
    const response = await fetch(`${JOLPICA_BASE}/${year}/${round}/results.json`)
    if (!response.ok) throw new Error('Failed to fetch race results')
    const data = await response.json()

    const results = data.MRData?.RaceTable?.Races?.[0]?.Results || []

    return results.map((r: any) => ({
      position: parseInt(r.position),
      driverId: r.Driver.driverId,
      driverCode: r.Driver.code,
      driverName: `${r.Driver.givenName} ${r.Driver.familyName}`,
      constructorName: r.Constructor.name,
      time: r.Time?.time,
      gap: r.position === '1' ? '' : (r.Time?.time || r.status),
      laps: parseInt(r.laps),
      status: r.status,
      points: parseFloat(r.points),
    }))
  } catch (error) {
    console.error('Error fetching race results:', error)
    return []
  }
}

// Fetch qualifying results from Jolpica
export async function fetchQualifyingResults(year: number, round: number): Promise<F1SessionResult[]> {
  try {
    const response = await fetch(`${JOLPICA_BASE}/${year}/${round}/qualifying.json`)
    if (!response.ok) throw new Error('Failed to fetch qualifying results')
    const data = await response.json()

    const results = data.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || []

    return results.map((r: any) => ({
      position: parseInt(r.position),
      driverId: r.Driver.driverId,
      driverCode: r.Driver.code,
      driverName: `${r.Driver.givenName} ${r.Driver.familyName}`,
      constructorName: r.Constructor.name,
      time: r.Q3 || r.Q2 || r.Q1,
      gap: '',
      status: 'Finished',
      points: 0,
    }))
  } catch (error) {
    console.error('Error fetching qualifying results:', error)
    return []
  }
}

// Fetch sprint results from Jolpica
export async function fetchSprintResults(year: number, round: number): Promise<F1SessionResult[]> {
  try {
    const response = await fetch(`${JOLPICA_BASE}/${year}/${round}/sprint.json`)
    if (!response.ok) throw new Error('Failed to fetch sprint results')
    const data = await response.json()

    const results = data.MRData?.RaceTable?.Races?.[0]?.SprintResults || []

    return results.map((r: any) => ({
      position: parseInt(r.position),
      driverId: r.Driver.driverId,
      driverCode: r.Driver.code,
      driverName: `${r.Driver.givenName} ${r.Driver.familyName}`,
      constructorName: r.Constructor.name,
      time: r.Time?.time,
      gap: r.position === '1' ? '' : (r.Time?.time || r.status),
      laps: parseInt(r.laps),
      status: r.status,
      points: parseFloat(r.points),
    }))
  } catch (error) {
    console.error('Error fetching sprint results:', error)
    return []
  }
}

// Country to ISO code mapping for flag images
export const COUNTRY_CODES: Record<string, string> = {
  'Bahrain': 'bh',
  'Saudi Arabia': 'sa',
  'Australia': 'au',
  'Japan': 'jp',
  'China': 'cn',
  'United States': 'us',
  'USA': 'us',
  'Italy': 'it',
  'Monaco': 'mc',
  'Canada': 'ca',
  'Spain': 'es',
  'Austria': 'at',
  'United Kingdom': 'gb',
  'Great Britain': 'gb',
  'Hungary': 'hu',
  'Belgium': 'be',
  'Netherlands': 'nl',
  'Singapore': 'sg',
  'Azerbaijan': 'az',
  'Mexico': 'mx',
  'Brazil': 'br',
  'Qatar': 'qa',
  'Abu Dhabi': 'ae',
  'UAE': 'ae',
  'Las Vegas': 'us',
  'Miami': 'us',
  'Portugal': 'pt',
  'France': 'fr',
  'Germany': 'de',
  'Russia': 'ru',
  'Turkey': 'tr',
  'Emilia Romagna': 'it',
  'Styria': 'at',
}

export function getCountryCode(country: string): string {
  return COUNTRY_CODES[country] || 'un'
}

export function getCountryFlag(country: string): string {
  const code = getCountryCode(country)
  return `https://flagcdn.com/w80/${code}.png`
}

// Session icons for visual identification
export const SESSION_ICONS: Record<string, string> = {
  'Practice 1': '🔧',
  'Practice 2': '🔧',
  'Practice 3': '🔧',
  'Qualifying': '⏱️',
  'Sprint Qualifying': '🏃',
  'Sprint Shootout': '🏃',
  'Sprint': '🏃',
  'Race': '🏁',
  'Testing': '🧪',
  'Pre-Season Testing': '🧪',
}

export function getSessionIcon(sessionName: string): string {
  return SESSION_ICONS[sessionName] || '🏎️'
}

// Get urgency level based on time until session
export function getSessionUrgency(sessionDate: Date): 'now' | 'today' | 'tomorrow' | 'soon' | 'later' {
  const now = new Date()
  const diff = sessionDate.getTime() - now.getTime()
  const hours = diff / (1000 * 60 * 60)

  if (diff <= 0) return 'now'
  if (hours < 24) return 'today'
  if (hours < 48) return 'tomorrow'
  if (hours < 72) return 'soon'
  return 'later'
}

// Get urgency styling for sessions
export function getSessionUrgencyStyles(urgency: string): { bg: string; border: string; text: string } {
  switch (urgency) {
    case 'now':
      return { bg: 'bg-red-100 dark:bg-red-900/40', border: 'border-red-300 dark:border-red-700', text: 'text-red-600 dark:text-red-400' }
    case 'today':
      return { bg: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-600 dark:text-orange-400' }
    case 'tomorrow':
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/40', border: 'border-yellow-300 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-400' }
    case 'soon':
      return { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400' }
    default:
      return { bg: 'bg-slate-50 dark:bg-slate-800/50', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-400' }
  }
}

// Team colors for styling
export const TEAM_COLORS: Record<string, string> = {
  'red_bull': '#3671C6',
  'ferrari': '#E8002D',
  'mercedes': '#27F4D2',
  'mclaren': '#FF8000',
  'aston_martin': '#229971',
  'alpine': '#FF87BC',
  'williams': '#64C4FF',
  'haas': '#B6BABD',
  'rb': '#6692FF',
  'sauber': '#52E252',
  'kick_sauber': '#52E252',
}

export function getTeamColor(constructorId: string): string {
  return TEAM_COLORS[constructorId.toLowerCase()] || '#666666'
}
