import { NextResponse } from 'next/server'
import { fetchSeasonSchedule, fetchAllSessions, OpenF1Meeting, OpenF1Session } from '@/lib/f1-api'

// Cache for schedule data (1 hour)
let scheduleCache: {
  data: { schedule: (OpenF1Meeting & { sessions: OpenF1Session[] })[], year: number }
  timestamp: number
  year: number
} | null = null
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '2026')

  // Check cache
  if (scheduleCache && scheduleCache.year === year && Date.now() - scheduleCache.timestamp < CACHE_DURATION) {
    return NextResponse.json({ ...scheduleCache.data, cached: true })
  }

  try {
    const [meetings, sessions] = await Promise.all([
      fetchSeasonSchedule(year),
      fetchAllSessions(year),
    ])

    // Combine meetings with their sessions
    const schedule = meetings.map(meeting => ({
      ...meeting,
      sessions: sessions.filter(s => s.meeting_key === meeting.meeting_key),
    }))

    // Update cache
    scheduleCache = {
      data: { schedule, year },
      timestamp: Date.now(),
      year,
    }

    return NextResponse.json({ schedule, year, cached: false })
  } catch (error) {
    console.error('Error fetching F1 schedule:', error)

    // Return stale cache if available
    if (scheduleCache && scheduleCache.year === year) {
      return NextResponse.json({ ...scheduleCache.data, cached: true, stale: true })
    }

    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}
