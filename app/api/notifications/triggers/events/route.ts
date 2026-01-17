import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint is called by a cron job to send event reminders
// Set up in vercel.json: "crons": [{ "path": "/api/notifications/triggers/events", "schedule": "*/15 * * * *" }]
export async function GET(request: NextRequest) {
  // Initialize Supabase at runtime (not build time)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  // Verify this is a cron request (Vercel adds this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // In development, allow without auth
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);
    const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);

    // Find events starting in the next 15-30 minutes that haven't been notified
    const { data: events, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, user_id, location')
      .gte('start_time', in15Minutes.toISOString())
      .lte('start_time', in30Minutes.toISOString())
      .is('reminder_sent', null); // Only events that haven't been reminded

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ message: 'No events to remind', count: 0 });
    }

    // Send notifications for each event
    const results = await Promise.all(
      events.map(async (event) => {
        const startTime = new Date(event.start_time);
        const minutesUntil = Math.round((startTime.getTime() - now.getTime()) / 60000);

        // Send notification
        const response = await fetch(new URL('/api/notifications/send', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: event.user_id,
            title: `${event.title} - in ${minutesUntil} min`,
            body: event.location ? `at ${event.location}` : 'Starting soon',
            data: {
              type: 'event_reminder',
              event_id: event.id,
            },
          }),
        });

        // Mark as reminded
        if (response.ok) {
          await supabase
            .from('calendar_events')
            .update({ reminder_sent: now.toISOString() })
            .eq('id', event.id);
        }

        return { event_id: event.id, sent: response.ok };
      })
    );

    const sentCount = results.filter(r => r.sent).length;

    return NextResponse.json({
      message: `Sent ${sentCount}/${events.length} event reminders`,
      count: sentCount,
    });

  } catch (error) {
    console.error('Error in event reminder trigger:', error);
    return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
  }
}
