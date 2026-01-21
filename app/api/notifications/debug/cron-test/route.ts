import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Debug endpoint to test the ENTIRE notification flow manually
 * This bypasses Vercel cron and tests each step
 *
 * GET /api/notifications/debug/cron-test?type=calendar&user_id=xxx
 */

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const steps: { step: string; status: 'pass' | 'fail' | 'skip'; detail: string; data?: any }[] = [];

  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('type') || 'calendar';
  const userId = searchParams.get('user_id');

  // Step 1: Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  steps.push({
    step: 'Check SUPABASE_URL',
    status: supabaseUrl ? 'pass' : 'fail',
    detail: supabaseUrl ? 'Configured' : 'MISSING!',
  });

  steps.push({
    step: 'Check SUPABASE_SERVICE_ROLE_KEY',
    status: supabaseKey ? 'pass' : 'fail',
    detail: supabaseKey ? `Configured (${supabaseKey.substring(0, 20)}...)` : 'MISSING!',
  });

  steps.push({
    step: 'Check NEXT_PUBLIC_APP_URL',
    status: appUrl ? 'pass' : 'skip',
    detail: appUrl || 'Not set (will use request URL)',
  });

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      success: false,
      error: 'Missing Supabase config',
      steps,
      duration_ms: Date.now() - startTime,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Step 2: Find a user to test with
  let targetUserId = userId;

  if (!targetUserId) {
    const { data: users } = await supabase
      .from('push_tokens')
      .select('user_id')
      .limit(1);

    targetUserId = users?.[0]?.user_id;
  }

  steps.push({
    step: 'Find test user',
    status: targetUserId ? 'pass' : 'fail',
    detail: targetUserId ? `User: ${targetUserId.substring(0, 8)}...` : 'No users with push tokens found!',
  });

  if (!targetUserId) {
    return NextResponse.json({
      success: false,
      error: 'No user with push token found',
      steps,
      duration_ms: Date.now() - startTime,
    });
  }

  // Step 3: Check push tokens for user
  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('token, platform, created_at')
    .eq('user_id', targetUserId);

  steps.push({
    step: 'Check push tokens',
    status: tokens && tokens.length > 0 ? 'pass' : 'fail',
    detail: tokens && tokens.length > 0
      ? `Found ${tokens.length} token(s): ${tokens.map(t => t.platform).join(', ')}`
      : `No tokens found. Error: ${tokenError?.message || 'none'}`,
    data: tokens?.map(t => ({
      platform: t.platform,
      token_preview: t.token.substring(0, 15) + '...',
      created: t.created_at,
    })),
  });

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No push tokens for user',
      steps,
      duration_ms: Date.now() - startTime,
    });
  }

  // Step 4: Check notification preferences
  const { data: prefs, error: prefsError } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', targetUserId)
    .single();

  steps.push({
    step: 'Check notification_preferences',
    status: prefs ? 'pass' : 'fail',
    detail: prefs
      ? `Found preferences. master_enabled=${prefs.master_enabled}, calendar_enabled=${prefs.calendar_enabled}, f1_enabled=${prefs.f1_enabled}`
      : `No preferences found. Error: ${prefsError?.message || 'none'}`,
    data: prefs ? {
      master_enabled: prefs.master_enabled,
      calendar_enabled: prefs.calendar_enabled,
      calendar_reminder_15m: prefs.calendar_reminder_15m,
      calendar_reminder_1h: prefs.calendar_reminder_1h,
      f1_enabled: prefs.f1_enabled,
      shopping_enabled: prefs.shopping_enabled,
    } : null,
  });

  // Step 5: Check for upcoming events (if calendar test)
  if (testType === 'calendar') {
    const now = new Date();
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const { data: events, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, reminder_15m_sent, reminder_1h_sent')
      .eq('user_id', targetUserId)
      .gte('start_time', now.toISOString())
      .lte('start_time', in2Hours.toISOString())
      .limit(5);

    steps.push({
      step: 'Check upcoming events (next 2 hours)',
      status: events && events.length > 0 ? 'pass' : 'skip',
      detail: events && events.length > 0
        ? `Found ${events.length} event(s)`
        : `No events in next 2 hours. Error: ${eventsError?.message || 'none'}`,
      data: events?.map(e => ({
        title: e.title,
        start_time: e.start_time,
        reminder_15m_sent: e.reminder_15m_sent,
        reminder_1h_sent: e.reminder_1h_sent,
      })),
    });
  }

  // Step 6: Actually send a test notification
  steps.push({
    step: 'Sending test notification...',
    status: 'pass',
    detail: 'Calling /api/notifications/send',
  });

  const baseUrl = appUrl || request.nextUrl.origin;

  try {
    const sendResponse = await fetch(`${baseUrl}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'test'}`,
      },
      body: JSON.stringify({
        user_id: targetUserId,
        title: '🧪 Cron Debug Test',
        body: `Test notification sent at ${new Date().toLocaleTimeString()}. If you see this, the notification system works!`,
        data: {
          type: 'debug_test',
          timestamp: Date.now(),
        },
      }),
    });

    const sendResult = await sendResponse.json();

    steps.push({
      step: 'Notification send result',
      status: sendResult.sent > 0 ? 'pass' : 'fail',
      detail: `Status ${sendResponse.status}: ${sendResult.message || JSON.stringify(sendResult)}`,
      data: sendResult,
    });

    // Step 7: Log to notification_log
    await supabase.from('notification_log').insert({
      user_id: targetUserId,
      category: 'debug',
      notification_type: 'cron_test',
      title: 'Cron Debug Test',
      body: 'Manual test from debug endpoint',
      data: { test_type: testType, steps_count: steps.length },
    });

    steps.push({
      step: 'Logged to notification_log',
      status: 'pass',
      detail: 'Test logged for history',
    });

    return NextResponse.json({
      success: sendResult.sent > 0,
      message: sendResult.sent > 0
        ? 'Test notification sent! Check your device.'
        : 'Notification failed to send - check the steps for details',
      steps,
      duration_ms: Date.now() - startTime,
    });

  } catch (error) {
    steps.push({
      step: 'Notification send error',
      status: 'fail',
      detail: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to send notification',
      steps,
      duration_ms: Date.now() - startTime,
    });
  }
}
