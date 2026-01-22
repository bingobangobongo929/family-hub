import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Calendar Event Changed notification trigger
// Called when an existing calendar event is updated - notifies ALL family members

interface EventData {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
  color: string;
}

interface ChangeSummary {
  field: string;
  oldValue?: string;
  newValue?: string;
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

// Format changes for notification body (clean, minimal emojis)
function formatChanges(changes: ChangeSummary[]): string {
  const changeLines: string[] = [];

  for (const change of changes.slice(0, 3)) { // Max 3 changes shown
    switch (change.field) {
      case 'title':
        changeLines.push(`New title: ${change.newValue}`);
        break;
      case 'start_time':
        changeLines.push(`New time: ${change.newValue}`);
        break;
      case 'location':
        if (change.newValue) {
          changeLines.push(`Location: ${change.newValue}`);
        } else {
          changeLines.push(`Location removed`);
        }
        break;
      case 'description':
        changeLines.push(`Description updated`);
        break;
      default:
        changeLines.push(`${change.field} updated`);
    }
  }

  if (changes.length > 3) {
    changeLines.push(`+${changes.length - 3} more`);
  }

  return changeLines.join('\n');
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
      changes,
      updated_by
    }: {
      event: EventData;
      changes: ChangeSummary[];
      updated_by: string;
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
    const title = `✏️ ${event.title}`;

    const bodyParts: string[] = [formatChanges(changes)];
    bodyParts.push(formatEventTime(event.start_time, event.all_day));

    if (event.location) {
      bodyParts.push(event.location);
    }

    const body = bodyParts.join('\n');

    let sentCount = 0;

    for (const userId of userIds) {
      // Check user's notification preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('calendar_enabled, calendar_event_changed, calendar_notify_own_changes')
        .eq('user_id', userId)
        .single();

      // Check if this is the user who made the change
      const isEditor = userId === updated_by;

      // Skip editor unless they want to be notified of their own changes
      if (isEditor) {
        const notifyOwnChanges = !prefs || prefs.calendar_notify_own_changes !== false;
        if (!notifyOwnChanges) continue;
      }

      const shouldNotify = !prefs || (prefs.calendar_enabled !== false && prefs.calendar_event_changed !== false);

      if (!shouldNotify) continue;

      try {
        const sendUrl = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/notifications/send`;
        const response = await fetch(sendUrl, {
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
              type: 'event_changed',
              event_id: event.id,
              event_title: event.title,
              deep_link: `/calendar?event=${event.id}`,
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
              notification_type: 'event_changed',
              title,
              body,
              data: { event_id: event.id, updated_by },
            });
        }
      } catch (error) {
        console.error('Error sending to user:', userId, error);
      }
    }

    return NextResponse.json({
      message: `Sent ${sentCount} event update notifications`,
      sent: sentCount,
      event_id: event.id,
    });

  } catch (error) {
    console.error('Error in event changed notification:', error);
    return NextResponse.json({ error: 'Notification failed' }, { status: 500 });
  }
}
