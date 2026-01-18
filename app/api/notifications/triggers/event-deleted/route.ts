import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Calendar Event Deleted notification trigger
// Called when a calendar event is deleted - notifies ALL family members

interface DeletedEventData {
  id: string;
  title: string;
  start_time: string;
  all_day: boolean;
  location?: string | null;
}

// Format time for display
function formatEventTime(dateStr: string, allDay: boolean): string {
  const date = new Date(dateStr);

  if (allDay) {
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Europe/Copenhagen'
    });
  }

  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Copenhagen'
  });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const requestBody = await request.json();
    const {
      event,
      deleted_by
    }: {
      event: DeletedEventData;
      deleted_by: string;
    } = requestBody;

    if (!event || !event.id || !event.title) {
      return NextResponse.json({ error: 'Missing event data' }, { status: 400 });
    }

    // Get ALL users with push tokens
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('user_id')
      .not('user_id', 'is', null);

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ message: 'No users with push tokens', sent: 0 });
    }

    const userIds = [...new Set(tokens.map(t => t.user_id))];

    // Build clean notification
    const title = `Event Cancelled`;

    const bodyParts: string[] = [
      event.title,
      `Was: ${formatEventTime(event.start_time, event.all_day)}`,
    ];

    if (event.location) {
      bodyParts.push(event.location);
    }

    const body = bodyParts.join('\n');

    let sentCount = 0;

    for (const userId of userIds) {
      // Skip the user who deleted the event
      if (userId === deleted_by) continue;

      // Check user's notification preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('calendar_enabled, calendar_event_deleted')
        .eq('user_id', userId)
        .single();

      const shouldNotify = !prefs || (prefs.calendar_enabled !== false && prefs.calendar_event_deleted !== false);

      if (!shouldNotify) continue;

      try {
        const response = await fetch(new URL('/api/notifications/send', request.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            user_id: userId,
            title,
            body,
            data: {
              type: 'event_deleted',
              event_id: event.id,
              event_title: event.title,
              deep_link: '/calendar',
            },
          }),
        });

        if (response.ok) {
          sentCount++;

          await supabase
            .from('notification_log')
            .insert({
              user_id: userId,
              category: 'calendar',
              notification_type: 'event_deleted',
              title,
              body,
              data: { event_id: event.id, event_title: event.title, deleted_by },
            });
        }
      } catch (error) {
        console.error('Error sending to user:', userId, error);
      }
    }

    return NextResponse.json({
      message: `Sent ${sentCount} event deletion notifications`,
      sent: sentCount,
      event_id: event.id,
    });

  } catch (error) {
    console.error('Error in event deleted notification:', error);
    return NextResponse.json({ error: 'Notification failed' }, { status: 500 });
  }
}
