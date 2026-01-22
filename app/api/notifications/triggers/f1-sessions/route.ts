import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// F1 Session notification trigger
// Cron schedule: "*/15 * * * *" (every 15 minutes)

interface OpenF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  meeting_key: number;
  date_start: string;
  date_end: string;
}

interface OpenF1Meeting {
  meeting_key: number;
  meeting_name: string;
  circuit_short_name: string;
  country_name: string;
  country_flag: string;
}

interface NotificationPrefs {
  user_id: string;
  f1_enabled: boolean;
  f1_race_reminder_15m: boolean;
  f1_race_reminder_1h: boolean;
  f1_race_reminder_1d: boolean;
  f1_quali_reminder: boolean;
  f1_sprint_reminder: boolean;
  f1_practice_reminder: boolean;
  f1_favorite_driver: string | null;
  f1_favorite_team: string | null;
}

interface F1NotificationState {
  user_id: string;
  last_session_reminded_key: number | null;
}

// Session type to emoji and display name mapping
const SESSION_INFO: Record<string, { emoji: string; name: string; type: 'race' | 'quali' | 'sprint' | 'practice' }> = {
  'Race': { emoji: '🏁', name: 'RACE', type: 'race' },
  'Qualifying': { emoji: '⏱️', name: 'QUALIFYING', type: 'quali' },
  'Sprint': { emoji: '⚡', name: 'SPRINT RACE', type: 'sprint' },
  'Sprint Qualifying': { emoji: '⚡⏱️', name: 'SPRINT QUALIFYING', type: 'quali' },
  'Sprint Shootout': { emoji: '⚡⏱️', name: 'SPRINT SHOOTOUT', type: 'quali' },
  'Practice 1': { emoji: '🔧', name: 'FP1', type: 'practice' },
  'Practice 2': { emoji: '🔧', name: 'FP2', type: 'practice' },
  'Practice 3': { emoji: '🔧', name: 'FP3', type: 'practice' },
};

// Flag emoji from country code (basic mapping)
const COUNTRY_FLAGS: Record<string, string> = {
  'Bahrain': '🇧🇭', 'Saudi Arabia': '🇸🇦', 'Australia': '🇦🇺', 'Japan': '🇯🇵',
  'China': '🇨🇳', 'United States': '🇺🇸', 'USA': '🇺🇸', 'Monaco': '🇲🇨',
  'Canada': '🇨🇦', 'Spain': '🇪🇸', 'Austria': '🇦🇹', 'United Kingdom': '🇬🇧',
  'UK': '🇬🇧', 'Hungary': '🇭🇺', 'Belgium': '🇧🇪', 'Netherlands': '🇳🇱',
  'Italy': '🇮🇹', 'Singapore': '🇸🇬', 'Mexico': '🇲🇽', 'Brazil': '🇧🇷',
  'Qatar': '🇶🇦', 'UAE': '🇦🇪', 'Abu Dhabi': '🇦🇪', 'Azerbaijan': '🇦🇿',
};

function getCountryFlag(country: string): string {
  return COUNTRY_FLAGS[country] || '🏎️';
}

function formatLocalTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Copenhagen'
  });
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Note: Auth is handled by middleware (CRON_ROUTES)

  try {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Fetch F1 schedule
    const scheduleRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/f1/schedule?year=${currentYear}`
    );

    if (!scheduleRes.ok) {
      console.log('Failed to fetch F1 schedule');
      return NextResponse.json({ error: 'Failed to fetch F1 schedule' }, { status: 500 });
    }

    const scheduleData = await scheduleRes.json();
    const meetings: (OpenF1Meeting & { sessions: OpenF1Session[] })[] = scheduleData.schedule || [];

    // Find all upcoming sessions in the next 24 hours
    const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);
    const in20Minutes = new Date(now.getTime() + 20 * 60 * 1000);
    const in55Minutes = new Date(now.getTime() + 55 * 60 * 1000);
    const in65Minutes = new Date(now.getTime() + 65 * 60 * 1000);
    const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Collect sessions that need reminders
    const sessionsToRemind: {
      session: OpenF1Session;
      meeting: OpenF1Meeting;
      reminderType: '15m' | '1h' | '1d';
      minutesUntil: number;
    }[] = [];

    for (const meeting of meetings) {
      for (const session of meeting.sessions || []) {
        const sessionStart = new Date(session.date_start);

        // 15-minute reminder (14-20 min window)
        if (sessionStart >= in15Minutes && sessionStart <= in20Minutes) {
          sessionsToRemind.push({
            session,
            meeting,
            reminderType: '15m',
            minutesUntil: Math.round((sessionStart.getTime() - now.getTime()) / 60000)
          });
        }
        // 1-hour reminder (55-65 min window)
        else if (sessionStart >= in55Minutes && sessionStart <= in65Minutes) {
          sessionsToRemind.push({
            session,
            meeting,
            reminderType: '1h',
            minutesUntil: Math.round((sessionStart.getTime() - now.getTime()) / 60000)
          });
        }
        // 1-day reminder (23-25 hour window)
        else if (sessionStart >= in23Hours && sessionStart <= in25Hours) {
          sessionsToRemind.push({
            session,
            meeting,
            reminderType: '1d',
            minutesUntil: Math.round((sessionStart.getTime() - now.getTime()) / 60000)
          });
        }
      }
    }

    if (sessionsToRemind.length === 0) {
      return NextResponse.json({ message: 'No F1 sessions to remind about', count: 0 });
    }

    // Get all users with F1 notifications enabled
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, f1_enabled, f1_race_reminder_15m, f1_race_reminder_1h, f1_race_reminder_1d, f1_quali_reminder, f1_sprint_reminder, f1_practice_reminder, f1_favorite_driver, f1_favorite_team')
      .eq('f1_enabled', true);

    if (prefsError || !prefs || prefs.length === 0) {
      // Try to get users from push_tokens if no explicit preferences
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('user_id')
        .not('user_id', 'is', null);

      if (!tokens || tokens.length === 0) {
        return NextResponse.json({ message: 'No users to notify', count: 0 });
      }
    }

    // Get notification states to check if already reminded
    const userIds = (prefs || []).map(p => p.user_id);
    const { data: states } = await supabase
      .from('f1_notification_state')
      .select('user_id, last_session_reminded_key')
      .in('user_id', userIds);

    const stateMap = new Map((states || []).map(s => [s.user_id, s]));

    let sentCount = 0;
    const results: { user_id: string; session: string; sent: boolean }[] = [];

    for (const { session, meeting, reminderType, minutesUntil } of sessionsToRemind) {
      const sessionInfo = SESSION_INFO[session.session_name] || { emoji: '🏎️', name: session.session_name, type: 'race' as const };
      const countryFlag = getCountryFlag(meeting.country_name);
      const localTime = formatLocalTime(session.date_start);

      for (const pref of (prefs || [])) {
        // Check if user wants this reminder type and session type
        const wantsReminder = (
          (reminderType === '15m' && pref.f1_race_reminder_15m) ||
          (reminderType === '1h' && pref.f1_race_reminder_1h) ||
          (reminderType === '1d' && pref.f1_race_reminder_1d)
        );

        const wantsSessionType = (
          (sessionInfo.type === 'race' && (pref.f1_race_reminder_15m || pref.f1_race_reminder_1h || pref.f1_race_reminder_1d)) ||
          (sessionInfo.type === 'quali' && pref.f1_quali_reminder) ||
          (sessionInfo.type === 'sprint' && pref.f1_sprint_reminder) ||
          (sessionInfo.type === 'practice' && pref.f1_practice_reminder)
        );

        if (!wantsReminder || !wantsSessionType) continue;

        // Check if already reminded for this session
        const state = stateMap.get(pref.user_id);
        if (state?.last_session_reminded_key === session.session_key) continue;

        // Build clean notification content
        let title: string;
        let body: string;

        if (reminderType === '15m') {
          // Urgent - race starting soon!
          title = `${sessionInfo.emoji} ${sessionInfo.name} in ${minutesUntil} min`;
          body = `${countryFlag} ${meeting.meeting_name}\n${meeting.circuit_short_name} • ${localTime}`;
        } else if (reminderType === '1h') {
          // 1 hour warning
          title = `${sessionInfo.emoji} ${sessionInfo.name} in 1 hour`;
          body = `${countryFlag} ${meeting.meeting_name}\n${meeting.circuit_short_name} • ${localTime}`;
        } else {
          // 1 day reminder
          title = `${countryFlag} ${sessionInfo.name} Tomorrow`;
          body = `${meeting.meeting_name}\n${meeting.circuit_short_name} • ${localTime}`;
        }

        // Add favorite driver context if set
        if (pref.f1_favorite_driver) {
          const driverName = pref.f1_favorite_driver.charAt(0).toUpperCase() + pref.f1_favorite_driver.slice(1);
          if (sessionInfo.type === 'race') {
            body += `\nWill ${driverName} take the win?`;
          } else if (sessionInfo.type === 'quali') {
            body += `\nCan ${driverName} grab pole?`;
          }
        }

        // Send notification
        try {
          const sendUrl = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/notifications/send`;
          const response = await fetch(sendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({
              user_id: pref.user_id,
              title,
              body,
              data: {
                type: 'f1_session_reminder',
                session_key: session.session_key,
                meeting_key: meeting.meeting_key,
                session_name: session.session_name,
                meeting_name: meeting.meeting_name,
                reminder_type: reminderType,
                deep_link: '/f1',
              },
            }),
          });

          if (response.ok) {
            sentCount++;

            // Update notification state
            await supabase
              .from('f1_notification_state')
              .upsert({
                user_id: pref.user_id,
                last_session_reminded_key: session.session_key,
                last_session_reminded_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });

            // Log notification
            await supabase
              .from('notification_log')
              .insert({
                user_id: pref.user_id,
                category: 'f1',
                notification_type: `session_reminder_${reminderType}`,
                title,
                body,
                data: { session_key: session.session_key, meeting_name: meeting.meeting_name },
              });
          }

          results.push({ user_id: pref.user_id, session: session.session_name, sent: response.ok });
        } catch (error) {
          console.error('Error sending F1 session notification:', error);
          results.push({ user_id: pref.user_id, session: session.session_name, sent: false });
        }
      }
    }

    return NextResponse.json({
      message: `Sent ${sentCount} F1 session reminders`,
      count: sentCount,
      sessions: sessionsToRemind.map(s => ({
        name: s.session.session_name,
        meeting: s.meeting.meeting_name,
        reminderType: s.reminderType,
      })),
    });

  } catch (error) {
    console.error('Error in F1 session reminder trigger:', error);
    return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
  }
}
