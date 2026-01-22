import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Enhanced Calendar Event notification trigger
// Cron schedule: "*/15 * * * *" (every 15 minutes)
// Supports multiple reminder times: 15m, 30m, 1h, 1d

interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
  color: string;
  member_id: string | null;
  reminder_15m_sent: string | null;
  reminder_30m_sent: string | null;
  reminder_1h_sent: string | null;
  reminder_1d_sent: string | null;
}

interface FamilyMember {
  id: string;
  name: string;
  color: string;
  avatar: string | null;
}

interface NotificationPrefs {
  user_id: string;
  calendar_enabled: boolean;
  calendar_reminder_15m: boolean;
  calendar_reminder_30m: boolean;
  calendar_reminder_1h: boolean;
  calendar_reminder_1d: boolean;
}

// Time remaining formatting
function formatTimeRemaining(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return '1 day';
}

// Format event time for display
function formatEventTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Copenhagen'
  });
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Copenhagen'
  });
}

// Get emoji based on event keywords
function getEventEmoji(title: string, description: string | null): string {
  const text = `${title} ${description || ''}`.toLowerCase();

  // Common event types
  if (text.includes('birthday')) return '🎂';
  if (text.includes('doctor') || text.includes('appointment') || text.includes('dentist')) return '🏥';
  if (text.includes('meeting')) return '📅';
  if (text.includes('school') || text.includes('class')) return '🏫';
  if (text.includes('playdate') || text.includes('play date') || text.includes('playgroup')) return '👶';
  if (text.includes('swimming') || text.includes('pool')) return '🏊';
  if (text.includes('sport') || text.includes('football') || text.includes('soccer')) return '⚽';
  if (text.includes('gym') || text.includes('workout') || text.includes('exercise')) return '💪';
  if (text.includes('dinner') || text.includes('lunch') || text.includes('restaurant')) return '🍽️';
  if (text.includes('party')) return '🎉';
  if (text.includes('holiday') || text.includes('vacation')) return '✈️';
  if (text.includes('work')) return '💼';
  if (text.includes('call') || text.includes('phone')) return '📞';
  if (text.includes('music') || text.includes('concert')) return '🎵';
  if (text.includes('movie') || text.includes('cinema')) return '🎬';
  if (text.includes('shop') || text.includes('store')) return '🛒';
  if (text.includes('wedding')) return '💒';
  if (text.includes('anniversary')) return '💕';

  return '📌';
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Log that this trigger was called (for debugging cron execution)
  try {
    await supabase.from('notification_log').insert({
      user_id: null,
      category: 'cron_execution',
      notification_type: 'events_trigger',
      title: 'Events Trigger Called',
      body: `Triggered at ${new Date().toISOString()}`,
      data: { source: request.headers.get('user-agent') || 'unknown' },
    });
  } catch {} // Ignore errors

  // Note: Auth is handled by middleware (CRON_ROUTES)

  try {
    const now = new Date();

    // Define time windows for each reminder type
    const windows = [
      { type: '15m', min: 14, max: 20, field: 'reminder_15m_sent', prefField: 'calendar_reminder_15m' },
      { type: '30m', min: 28, max: 35, field: 'reminder_30m_sent', prefField: 'calendar_reminder_30m' },
      { type: '1h', min: 55, max: 70, field: 'reminder_1h_sent', prefField: 'calendar_reminder_1h' },
      { type: '1d', min: 23 * 60, max: 25 * 60, field: 'reminder_1d_sent', prefField: 'calendar_reminder_1d' },
    ];

    let totalSent = 0;
    const results: { event: string; type: string; sent: boolean }[] = [];

    for (const window of windows) {
      const windowStart = new Date(now.getTime() + window.min * 60 * 1000);
      const windowEnd = new Date(now.getTime() + window.max * 60 * 1000);

      // Find events in this window that haven't been reminded
      const { data: events, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('start_time', windowStart.toISOString())
        .lte('start_time', windowEnd.toISOString())
        .is(window.field as any, null)
        .eq('all_day', false); // Don't send timed reminders for all-day events

      if (eventsError || !events || events.length === 0) continue;

      // Get user preferences for these events
      const userIds = [...new Set(events.map(e => e.user_id))];
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('user_id, calendar_enabled, calendar_reminder_15m, calendar_reminder_30m, calendar_reminder_1h, calendar_reminder_1d')
        .in('user_id', userIds)
        .eq('calendar_enabled', true);

      // Filter by the appropriate reminder type
      const filteredPrefs = (prefs || []).filter(p => {
        if (window.type === '15m') return p.calendar_reminder_15m;
        if (window.type === '30m') return p.calendar_reminder_30m;
        if (window.type === '1h') return p.calendar_reminder_1h;
        if (window.type === '1d') return p.calendar_reminder_1d;
        return false;
      });

      const prefMap = new Map(filteredPrefs.map(p => [p.user_id, p]));

      // Get family members for context
      const memberIds = events.filter(e => e.member_id).map(e => e.member_id);
      const { data: members } = memberIds.length > 0
        ? await supabase.from('family_members').select('id, name, color, avatar').in('id', memberIds)
        : { data: [] };

      const memberMap = new Map((members || []).map(m => [m.id, m]));

      for (const event of events as CalendarEvent[]) {
        // Check if user wants this reminder type
        const pref = prefMap.get(event.user_id);
        if (!pref) {
          // If no prefs, try to use defaults by checking if push token exists
          const { data: tokens } = await supabase
            .from('push_tokens')
            .select('user_id')
            .eq('user_id', event.user_id)
            .limit(1);

          if (!tokens || tokens.length === 0) continue;
        }

        const startTime = new Date(event.start_time);
        const minutesUntil = Math.round((startTime.getTime() - now.getTime()) / 60000);
        const emoji = getEventEmoji(event.title, event.description);
        const member = event.member_id ? memberMap.get(event.member_id) : null;

        // Build rich notification
        let title: string;
        let body: string;

        if (window.type === '15m') {
          // Urgent reminder
          title = `${emoji} ${event.title} in ${minutesUntil} min!`;
          body = `🕐 ${formatEventTime(event.start_time)}`;
          if (event.location) body += `\n📍 ${event.location}`;
          if (member) body += `\n👤 ${member.name}`;
        } else if (window.type === '30m') {
          title = `${emoji} ${event.title} in 30 min`;
          body = `🕐 Starting at ${formatEventTime(event.start_time)}`;
          if (event.location) body += `\n📍 ${event.location}`;
          if (member) body += `\n👤 ${member.name}`;
        } else if (window.type === '1h') {
          title = `${emoji} ${event.title} in 1 hour`;
          body = `🕐 ${formatEventTime(event.start_time)}`;
          if (event.location) body += ` at ${event.location}`;
          if (member) body += `\n👤 For ${member.name}`;
          if (event.description) body += `\n📝 ${event.description.substring(0, 80)}`;
        } else {
          // 1 day reminder
          title = `${emoji} Tomorrow: ${event.title}`;
          body = `📅 ${formatEventDate(event.start_time)} at ${formatEventTime(event.start_time)}`;
          if (event.location) body += `\n📍 ${event.location}`;
          if (member) body += `\n👤 ${member.name}`;
        }

        try {
          const response = await fetch(new URL('/api/notifications/send', request.url), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({
              user_id: event.user_id,
              title,
              body,
              data: {
                type: 'event_reminder',
                reminder_type: window.type,
                event_id: event.id,
                event_title: event.title,
                start_time: event.start_time,
                deep_link: `/calendar?event=${event.id}`,
              },
            }),
          });

          if (response.ok) {
            totalSent++;

            // Mark this reminder as sent
            await supabase
              .from('calendar_events')
              .update({ [window.field]: now.toISOString() })
              .eq('id', event.id);

            // Log notification
            await supabase
              .from('notification_log')
              .insert({
                user_id: event.user_id,
                category: 'calendar',
                notification_type: `event_reminder_${window.type}`,
                title,
                body,
                data: { event_id: event.id, event_title: event.title },
              });

            results.push({ event: event.title, type: window.type, sent: true });
          } else {
            results.push({ event: event.title, type: window.type, sent: false });
          }
        } catch (error) {
          console.error('Error sending event notification:', error);
          results.push({ event: event.title, type: window.type, sent: false });
        }
      }
    }

    return NextResponse.json({
      message: `Sent ${totalSent} event reminders`,
      count: totalSent,
      results,
    });

  } catch (error) {
    console.error('Error in event reminder trigger:', error);
    return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
  }
}
