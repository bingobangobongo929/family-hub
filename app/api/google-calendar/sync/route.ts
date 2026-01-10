import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

// Refresh access token if expired
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
} | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

// Get valid access token (refresh if needed)
async function getValidAccessToken(
  supabase: any,
  userId: string,
  integration: any
): Promise<string | null> {
  const expiresAt = new Date(integration.token_expires_at)
  const now = new Date()

  // If token is still valid (with 5 minute buffer)
  if (expiresAt.getTime() - 5 * 60 * 1000 > now.getTime()) {
    return integration.access_token
  }

  // Refresh the token
  const refreshed = await refreshAccessToken(integration.refresh_token)
  if (!refreshed) return null

  // Update the stored token
  await supabase
    .from('user_integrations')
    .update({
      access_token: refreshed.access_token,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'google_calendar')

  return refreshed.access_token
}

// Sync events from Google Calendar
export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get('user_id')

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  }

  try {
    // Get Google Calendar integration
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google_calendar')
      .single()

    if (!integration) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 404 })
    }

    const accessToken = await getValidAccessToken(supabase, userId, integration)
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 })
    }

    // Fetch events from Google Calendar (next 30 days)
    const timeMin = new Date().toISOString()
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '100',
      }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!eventsResponse.ok) {
      const error = await eventsResponse.text()
      console.error('Google Calendar API error:', error)
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }

    const data = await eventsResponse.json()
    const googleEvents = data.items || []

    // Sync events to our database
    for (const event of googleEvents) {
      const startTime = event.start?.dateTime || event.start?.date
      const endTime = event.end?.dateTime || event.end?.date
      const isAllDay = !event.start?.dateTime

      // Check if event already exists
      const { data: existing } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('source', 'google')
        .eq('source_id', event.id)
        .eq('user_id', userId)
        .single()

      const eventData = {
        user_id: userId,
        title: event.summary || 'Untitled',
        description: event.description || null,
        start_time: new Date(startTime).toISOString(),
        end_time: endTime ? new Date(endTime).toISOString() : null,
        all_day: isAllDay,
        color: '#4285f4', // Google blue
        location: event.location || null,
        source: 'google',
        source_id: event.id,
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        await supabase
          .from('calendar_events')
          .update(eventData)
          .eq('id', existing.id)
      } else {
        await supabase.from('calendar_events').insert(eventData)
      }
    }

    return NextResponse.json({
      success: true,
      synced: googleEvents.length,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

// Push event to Google Calendar
export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const body = await request.json()
    const { user_id, event } = body

    if (!user_id || !event) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get Google Calendar integration
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user_id)
      .eq('provider', 'google_calendar')
      .single()

    if (!integration) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 404 })
    }

    const accessToken = await getValidAccessToken(supabase, user_id, integration)
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 })
    }

    // Create Google Calendar event
    const googleEvent = {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: event.all_day
        ? { date: event.start_time.split('T')[0] }
        : { dateTime: event.start_time },
      end: event.all_day
        ? { date: event.end_time?.split('T')[0] || event.start_time.split('T')[0] }
        : { dateTime: event.end_time || event.start_time },
    }

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Google Calendar API error:', error)
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
    }

    const createdEvent = await response.json()

    // Update our event with Google's source_id
    if (event.id) {
      await supabase
        .from('calendar_events')
        .update({
          source: 'google',
          source_id: createdEvent.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id)
    }

    return NextResponse.json({ success: true, google_event_id: createdEvent.id })
  } catch (error) {
    console.error('Push error:', error)
    return NextResponse.json({ error: 'Failed to push event' }, { status: 500 })
  }
}
