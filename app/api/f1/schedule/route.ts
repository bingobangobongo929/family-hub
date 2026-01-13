import { NextResponse } from 'next/server'
import { fetchSeasonSchedule, fetchAllSessions } from '@/lib/f1-api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '2026')

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

    return NextResponse.json({ schedule, year })
  } catch (error) {
    console.error('Error fetching F1 schedule:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}
