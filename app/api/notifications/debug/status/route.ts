import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Comprehensive notification system status check
 *
 * GET /api/notifications/debug/status
 */

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apnsKeyId = process.env.APNS_KEY_ID;
  const apnsTeamId = process.env.APNS_TEAM_ID;
  const apnsKey = process.env.APNS_PRIVATE_KEY;
  const cronSecret = process.env.CRON_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const status: any = {
    timestamp: new Date().toISOString(),
    environment: {},
    database: {},
    users: {},
    recent_activity: {},
    issues: [],
    recommendations: [],
  };

  // Environment variables
  status.environment = {
    SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !!supabaseKey,
    APNS_KEY_ID: !!apnsKeyId,
    APNS_TEAM_ID: !!apnsTeamId,
    APNS_PRIVATE_KEY: !!apnsKey,
    APNS_PRODUCTION: process.env.APNS_PRODUCTION,
    CRON_SECRET: !!cronSecret,
    NEXT_PUBLIC_APP_URL: appUrl || 'not set',
  };

  if (!apnsKeyId || !apnsTeamId || !apnsKey) {
    status.issues.push('APNs not fully configured - push notifications will fail');
  }

  if (!supabaseUrl || !supabaseKey) {
    status.issues.push('Supabase not configured');
    return NextResponse.json(status);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check database schema
  const schemaChecks = [
    { table: 'push_tokens', columns: ['id', 'user_id', 'token', 'platform'] },
    { table: 'notification_preferences', columns: ['user_id', 'master_enabled', 'calendar_enabled', 'f1_enabled'] },
    { table: 'calendar_events', columns: ['id', 'reminder_15m_sent', 'reminder_30m_sent', 'reminder_1h_sent', 'reminder_1d_sent'] },
    { table: 'notification_log', columns: ['id', 'user_id', 'category'] },
    { table: 'f1_notification_state', columns: ['user_id', 'last_news_check'] },
  ];

  for (const check of schemaChecks) {
    try {
      const { data, error } = await supabase
        .from(check.table)
        .select(check.columns.join(','))
        .limit(1);

      status.database[check.table] = error ? `ERROR: ${error.message}` : 'OK';

      if (error?.message?.includes('does not exist')) {
        status.issues.push(`Missing column or table: ${check.table} - ${error.message}`);
      }
    } catch (e: any) {
      status.database[check.table] = `ERROR: ${e.message}`;
    }
  }

  // User stats
  const { data: tokenStats } = await supabase
    .from('push_tokens')
    .select('user_id, platform')

  const userIds = new Set(tokenStats?.map(t => t.user_id) || []);
  status.users = {
    with_push_tokens: userIds.size,
    total_tokens: tokenStats?.length || 0,
    duplicate_tokens: (tokenStats?.length || 0) - userIds.size,
    platforms: tokenStats?.reduce((acc, t) => {
      acc[t.platform] = (acc[t.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  if (status.users.duplicate_tokens > 0) {
    status.issues.push(`${status.users.duplicate_tokens} duplicate push tokens - run cleanup`);
    status.recommendations.push('POST /api/notifications/debug/cleanup-tokens');
  }

  // Check notification preferences
  const { data: prefsStats } = await supabase
    .from('notification_preferences')
    .select('user_id, master_enabled, calendar_enabled, f1_enabled, shopping_enabled');

  const enabledPrefs = prefsStats?.filter(p => p.master_enabled) || [];
  status.users.with_notifications_enabled = enabledPrefs.length;
  status.users.calendar_enabled = prefsStats?.filter(p => p.calendar_enabled).length || 0;
  status.users.f1_enabled = prefsStats?.filter(p => p.f1_enabled).length || 0;

  // Recent notification log
  const { data: recentLogs } = await supabase
    .from('notification_log')
    .select('category, notification_type, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  status.recent_activity.notification_log = recentLogs?.length || 0;
  status.recent_activity.last_notifications = recentLogs?.slice(0, 5).map(l => ({
    type: l.notification_type,
    category: l.category,
    when: l.created_at,
  }));

  // Upcoming events
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data: upcomingEvents } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, reminder_15m_sent, reminder_1h_sent')
    .gte('start_time', now.toISOString())
    .lte('start_time', tomorrow.toISOString())
    .limit(10);

  status.recent_activity.upcoming_events_24h = upcomingEvents?.length || 0;
  status.recent_activity.events_needing_reminders = upcomingEvents?.filter(
    e => !e.reminder_15m_sent && !e.reminder_1h_sent
  ).length || 0;

  // Summary
  if (status.issues.length === 0) {
    status.summary = 'All systems operational';
  } else {
    status.summary = `${status.issues.length} issue(s) found`;
  }

  return NextResponse.json(status);
}
