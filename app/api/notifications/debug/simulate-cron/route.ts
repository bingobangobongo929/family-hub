import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Simulates EXACTLY what the calendar events cron trigger does
 * Shows every step and why notifications might not be sending
 *
 * GET /api/notifications/debug/simulate-cron
 */

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const debug: any = {
    timestamp: new Date().toISOString(),
    steps: [],
  };

  const log = (step: string, data: any) => {
    debug.steps.push({ step, ...data });
    console.log(`[SimulateCron] ${step}:`, data);
  };

  // Environment check
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      error: 'Missing Supabase config',
      SUPABASE_URL: !!supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: !!supabaseKey,
    }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const now = new Date();

  log('Current time', {
    utc: now.toISOString(),
    local: now.toLocaleString('en-GB', { timeZone: 'Europe/London' }),
  });

  // Define time windows (same as events/route.ts)
  const windows = [
    { type: '15m', min: 14, max: 20, field: 'reminder_15m_sent' },
    { type: '30m', min: 28, max: 35, field: 'reminder_30m_sent' },
    { type: '1h', min: 55, max: 70, field: 'reminder_1h_sent' },
    { type: '1d', min: 23 * 60, max: 25 * 60, field: 'reminder_1d_sent' },
  ];

  for (const window of windows) {
    const windowStart = new Date(now.getTime() + window.min * 60 * 1000);
    const windowEnd = new Date(now.getTime() + window.max * 60 * 1000);

    log(`Checking ${window.type} window`, {
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      looking_for: `Events starting between ${window.min} and ${window.max} minutes from now`,
    });

    // Query exactly like the real trigger does
    const { data: events, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, user_id, title, start_time, all_day, reminder_15m_sent, reminder_30m_sent, reminder_1h_sent, reminder_1d_sent')
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', windowEnd.toISOString())
      .is(window.field as any, null)
      .eq('all_day', false) as { data: any[] | null; error: any };

    if (eventsError) {
      log(`${window.type} query error`, { error: eventsError.message });
      continue;
    }

    log(`${window.type} events found`, {
      count: events?.length || 0,
      events: events?.map(e => ({
        id: e.id,
        title: e.title,
        start_time: e.start_time,
        user_id: e.user_id.substring(0, 8) + '...',
        reminder_already_sent: e[window.field as keyof typeof e] !== null,
      })),
    });

    if (!events || events.length === 0) continue;

    // For each event, check user preferences
    for (const event of events) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('calendar_enabled, calendar_reminder_15m, calendar_reminder_30m, calendar_reminder_1h, calendar_reminder_1d')
        .eq('user_id', event.user_id)
        .single();

      const prefField = `calendar_reminder_${window.type.replace('m', 'm').replace('h', 'h').replace('d', 'd')}`;

      log(`User prefs for ${event.title}`, {
        user_id: event.user_id.substring(0, 8) + '...',
        has_prefs: !!prefs,
        calendar_enabled: prefs?.calendar_enabled,
        [prefField]: prefs?.[prefField as keyof typeof prefs],
        would_send: prefs?.calendar_enabled && prefs?.[prefField as keyof typeof prefs],
      });

      // Check push token
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token, platform')
        .eq('user_id', event.user_id);

      log(`Push tokens for user`, {
        user_id: event.user_id.substring(0, 8) + '...',
        has_tokens: tokens && tokens.length > 0,
        token_count: tokens?.length || 0,
        platforms: tokens?.map(t => t.platform),
      });
    }
  }

  // Also check: Are there ANY events in the next 24 hours?
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data: allEvents } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, user_id, all_day')
    .gte('start_time', now.toISOString())
    .lte('start_time', tomorrow.toISOString())
    .limit(20);

  log('All events in next 24 hours', {
    count: allEvents?.length || 0,
    events: allEvents?.map(e => ({
      title: e.title,
      start_time: e.start_time,
      all_day: e.all_day,
      minutes_from_now: Math.round((new Date(e.start_time).getTime() - now.getTime()) / 60000),
    })),
  });

  // Check notification_log for recent attempts
  const { data: recentLogs } = await supabase
    .from('notification_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  log('Recent notification_log entries', {
    count: recentLogs?.length || 0,
    entries: recentLogs?.map(l => ({
      category: l.category,
      type: l.notification_type,
      title: l.title,
      created_at: l.created_at,
    })),
  });

  debug.duration_ms = Date.now() - startTime;
  debug.summary = {
    total_steps: debug.steps.length,
    recommendation: debug.steps.some((s: any) => s.count > 0 && s.would_send)
      ? 'Events found that should trigger notifications'
      : 'No events in reminder windows OR user preferences disabled OR no push tokens',
  };

  return NextResponse.json(debug);
}
