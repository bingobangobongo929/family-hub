import { NextResponse } from 'next/server'
import { getNextSession, getCurrentRaceWeekend, fetchMeetingSessions } from '@/lib/f1-api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '2026')

  try {
    // Check if we're in a race weekend
    const raceWeekend = await getCurrentRaceWeekend(year)

    if (raceWeekend) {
      return NextResponse.json({
        isRaceWeekend: true,
        meeting: raceWeekend.meeting,
        sessions: raceWeekend.sessions,
      })
    }

    // Get next upcoming session
    const next = await getNextSession(year)

    if (!next) {
      return NextResponse.json({
        isRaceWeekend: false,
        meeting: null,
        session: null,
        message: 'No upcoming sessions found',
      })
    }

    // Get all sessions for the next meeting
    const sessions = await fetchMeetingSessions(next.meeting.meeting_key)

    return NextResponse.json({
      isRaceWeekend: false,
      meeting: next.meeting,
      session: next.session,
      sessions,
    })
  } catch (error) {
    console.error('Error fetching next F1 session:', error)
    return NextResponse.json({ error: 'Failed to fetch next session' }, { status: 500 })
  }
}
