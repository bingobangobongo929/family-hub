import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Calendar Event Created notification trigger
// Called when a new calendar event is created

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
  member_ids?: string[];
  source?: 'manual' | 'ai' | 'google';
}

interface FamilyMember {
  id: string;
  name: string;
  color: string;
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

// Get emoji based on event keywords
function getEventEmoji(title: string, description: string | null): string {
  const text = `${title} ${description || ''}`.toLowerCase();

  if (text.includes('birthday')) return '🎂';
  if (text.includes('doctor') || text.includes('appointment') || text.includes('dentist') || text.includes('læge')) return '🏥';
  if (text.includes('meeting') || text.includes('møde')) return '📅';
  if (text.includes('school') || text.includes('class') || text.includes('skole')) return '🏫';
  if (text.includes('playdate') || text.includes('play date') || text.includes('playgroup') || text.includes('legeaftale')) return '👶';
  if (text.includes('swimming') || text.includes('pool') || text.includes('svømme')) return '🏊';
  if (text.includes('sport') || text.includes('football') || text.includes('soccer') || text.includes('fodbold')) return '⚽';
  if (text.includes('gym') || text.includes('workout') || text.includes('exercise') || text.includes('fitness')) return '💪';
  if (text.includes('dinner') || text.includes('lunch') || text.includes('restaurant') || text.includes('middag') || text.includes('frokost')) return '🍽️';
  if (text.includes('party') || text.includes('fest')) return '🎉';
  if (text.includes('holiday') || text.includes('vacation') || text.includes('ferie')) return '✈️';
  if (text.includes('work') || text.includes('arbejde')) return '💼';
  if (text.includes('call') || text.includes('phone') || text.includes('ring') || text.includes('opkald')) return '📞';
  if (text.includes('music') || text.includes('concert') || text.includes('musik') || text.includes('koncert')) return '🎵';
  if (text.includes('movie') || text.includes('cinema') || text.includes('film') || text.includes('biograf')) return '🎬';
  if (text.includes('shop') || text.includes('store') || text.includes('købe') || text.includes('indkøb')) return '🛒';
  if (text.includes('wedding') || text.includes('bryllup')) return '💒';
  if (text.includes('anniversary') || text.includes('årsdag')) return '💕';

  return '📌';
}

// Get source description
function getSourceDescription(source?: string): string {
  switch (source) {
    case 'ai':
      return '✨ Added by AI';
    case 'google':
      return '🔄 Synced from Google';
    default:
      return '✅ Event added';
  }
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
    const { event, member_ids }: { event: EventData; member_ids?: string[] } = requestBody;

    if (!event || !event.user_id || !event.title) {
      return NextResponse.json({ error: 'Missing event data' }, { status: 400 });
    }

    // Check if user wants calendar creation notifications
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('calendar_enabled, calendar_event_created')
      .eq('user_id', event.user_id)
      .single();

    // Default: send notification unless explicitly disabled
    const shouldNotify = !prefs || (prefs.calendar_enabled !== false && prefs.calendar_event_created !== false);

    if (!shouldNotify) {
      return NextResponse.json({ message: 'Notifications disabled', sent: false });
    }

    // Get member names if provided
    let memberNames = '';
    if (member_ids && member_ids.length > 0) {
      const { data: members } = await supabase
        .from('family_members')
        .select('name')
        .in('id', member_ids);

      if (members && members.length > 0) {
        memberNames = members.map(m => m.name).join(' & ');
      }
    }

    const emoji = getEventEmoji(event.title, event.description);
    const sourceDesc = getSourceDescription(event.source);

    // Build rich notification
    let title = `${emoji} ${event.title}`;
    let body = `${sourceDesc}\n📅 ${formatEventTime(event.start_time, event.all_day)}`;

    if (event.location) {
      body += `\n📍 ${event.location}`;
    }

    if (memberNames) {
      body += `\n👤 ${memberNames}`;
    }

    if (event.description && event.description.length > 0) {
      body += `\n📝 ${event.description.substring(0, 60)}${event.description.length > 60 ? '...' : ''}`;
    }

    // Send notification
    const response = await fetch(new URL('/api/notifications/send', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: event.user_id,
        title,
        body,
        data: {
          type: 'event_created',
          event_id: event.id,
          event_title: event.title,
          start_time: event.start_time,
          deep_link: `/calendar?event=${event.id}`,
        },
      }),
    });

    if (response.ok) {
      // Log notification
      await supabase
        .from('notification_log')
        .insert({
          user_id: event.user_id,
          category: 'calendar',
          notification_type: 'event_created',
          title,
          body,
          data: { event_id: event.id, event_title: event.title },
        });

      return NextResponse.json({
        message: 'Event creation notification sent',
        sent: true,
        event_id: event.id,
      });
    } else {
      return NextResponse.json({
        message: 'Failed to send notification',
        sent: false,
      });
    }

  } catch (error) {
    console.error('Error in event created notification:', error);
    return NextResponse.json({ error: 'Notification failed' }, { status: 500 });
  }
}
