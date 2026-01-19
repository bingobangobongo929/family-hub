import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface TestStep {
  step: string;
  status: 'pass' | 'fail' | 'skip';
  detail: string;
}

type NotificationType = 'f1_news' | 'f1_session' | 'shopping' | 'bins' | 'calendar' | 'routines' | 'chores';

const TEST_NOTIFICATIONS: Record<NotificationType, { title: string; body: string; data: Record<string, any> }> = {
  f1_news: {
    title: '🏁 TEST: F1 News',
    body: 'This is a test F1 news notification. If you see this, F1 notifications are working!',
    data: { type: 'f1_news', deep_link: '/f1?tab=news' },
  },
  f1_session: {
    title: '🏎️ TEST: F1 Session Reminder',
    body: 'Race starts in 15 minutes! (This is a test notification)',
    data: { type: 'f1_session_reminder', deep_link: '/f1' },
  },
  shopping: {
    title: '🛒 TEST: Shopping List',
    body: 'Someone added items to the shopping list. (This is a test notification)',
    data: { type: 'shopping_list_changes', deep_link: '/shopping' },
  },
  bins: {
    title: '🗑️ TEST: Bin Reminder',
    body: 'Put the bins out tonight! (This is a test notification)',
    data: { type: 'bin_reminder_evening', deep_link: '/bindicator' },
  },
  calendar: {
    title: '📅 TEST: Calendar Event',
    body: 'A new event was added to the calendar. (This is a test notification)',
    data: { type: 'event_created', deep_link: '/calendar' },
  },
  routines: {
    title: '✨ TEST: Routine Reminder',
    body: 'Time to start the morning routine! (This is a test notification)',
    data: { type: 'routine_reminder', deep_link: '/routines' },
  },
  chores: {
    title: '🧹 TEST: Chore Reminder',
    body: 'You have a chore to complete. (This is a test notification)',
    data: { type: 'chore_reminder', deep_link: '/tasks' },
  },
};

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  // Create authenticated client to get current user
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, dry_run = false } = body as { type: NotificationType; dry_run?: boolean };

  if (!type || !TEST_NOTIFICATIONS[type]) {
    return NextResponse.json({
      error: 'Invalid notification type',
      valid_types: Object.keys(TEST_NOTIFICATIONS),
    }, { status: 400 });
  }

  const steps: TestStep[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Step 1: Check push token
  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('token, platform')
    .eq('user_id', user.id);

  if (tokenError || !tokens || tokens.length === 0) {
    steps.push({
      step: 'check_push_token',
      status: 'fail',
      detail: 'No push token found. Open the app on your device to register.',
    });
    return NextResponse.json({
      success: false,
      steps,
      notification_sent: false,
      error: 'No push token found',
    });
  }

  const token = tokens[0];
  steps.push({
    step: 'check_push_token',
    status: 'pass',
    detail: `Token found (${token.platform}): ${token.token.substring(0, 20)}...`,
  });

  // Step 2: Check notification preferences
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('master_enabled, f1_enabled, f1_news_enabled, shopping_enabled, bins_enabled, calendar_enabled, routines_enabled, chores_enabled')
    .eq('user_id', user.id)
    .single();

  // Check relevant preference for this type
  const prefKey = {
    f1_news: 'f1_news_enabled',
    f1_session: 'f1_enabled',
    shopping: 'shopping_enabled',
    bins: 'bins_enabled',
    calendar: 'calendar_enabled',
    routines: 'routines_enabled',
    chores: 'chores_enabled',
  }[type] as string;

  const masterEnabled = !prefs || prefs.master_enabled !== false;
  const typeEnabled = !prefs || (prefs as any)[prefKey] !== false;

  if (!masterEnabled) {
    steps.push({
      step: 'check_preferences',
      status: 'fail',
      detail: 'Master notifications are disabled',
    });
    return NextResponse.json({
      success: false,
      steps,
      notification_sent: false,
      error: 'Master notifications disabled',
    });
  }

  if (!typeEnabled) {
    steps.push({
      step: 'check_preferences',
      status: 'fail',
      detail: `${type} notifications are disabled in preferences`,
    });
    return NextResponse.json({
      success: false,
      steps,
      notification_sent: false,
      error: `${type} notifications disabled`,
    });
  }

  steps.push({
    step: 'check_preferences',
    status: 'pass',
    detail: `${type} notifications enabled (master: ${masterEnabled}, ${prefKey}: ${typeEnabled})`,
  });

  // Step 3: Check APNs configuration
  const apnsKeyId = process.env.APNS_KEY_ID;
  const apnsTeamId = process.env.APNS_TEAM_ID;
  const apnsKey = process.env.APNS_PRIVATE_KEY;

  if (!apnsKeyId || !apnsTeamId || !apnsKey) {
    const missing = [];
    if (!apnsKeyId) missing.push('APNS_KEY_ID');
    if (!apnsTeamId) missing.push('APNS_TEAM_ID');
    if (!apnsKey) missing.push('APNS_PRIVATE_KEY');
    steps.push({
      step: 'check_apns_config',
      status: 'fail',
      detail: `Missing environment variables: ${missing.join(', ')}`,
    });
    return NextResponse.json({
      success: false,
      steps,
      notification_sent: false,
      error: 'APNs not configured',
    });
  }

  const isProduction = process.env.APNS_PRODUCTION === 'true';
  steps.push({
    step: 'check_apns_config',
    status: 'pass',
    detail: `APNs configured (${isProduction ? 'production' : 'sandbox'} environment)`,
  });

  // Step 4: Send notification (unless dry_run)
  if (dry_run) {
    steps.push({
      step: 'send_notification',
      status: 'skip',
      detail: 'Dry run - notification not sent',
    });
    return NextResponse.json({
      success: true,
      steps,
      notification_sent: false,
      dry_run: true,
    });
  }

  // Actually send the notification
  const testNotif = TEST_NOTIFICATIONS[type];

  try {
    const response = await fetch(new URL('/api/notifications/send', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'test'}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        title: testNotif.title,
        body: testNotif.body,
        data: testNotif.data,
      }),
    });

    const result = await response.json();

    if (response.ok && result.sent > 0) {
      steps.push({
        step: 'send_notification',
        status: 'pass',
        detail: `Notification sent successfully. Check your device!`,
      });

      // Log the test notification
      await supabase
        .from('notification_log')
        .insert({
          user_id: user.id,
          category: type.split('_')[0],
          notification_type: `test_${type}`,
          title: testNotif.title,
          body: testNotif.body,
          data: testNotif.data,
        });

      return NextResponse.json({
        success: true,
        steps,
        notification_sent: true,
        result,
      });
    } else {
      steps.push({
        step: 'send_notification',
        status: 'fail',
        detail: `Send failed: ${JSON.stringify(result)}`,
      });
      return NextResponse.json({
        success: false,
        steps,
        notification_sent: false,
        error: result.error || 'Send failed',
        result,
      });
    }
  } catch (error) {
    steps.push({
      step: 'send_notification',
      status: 'fail',
      detail: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    return NextResponse.json({
      success: false,
      steps,
      notification_sent: false,
      error: String(error),
    });
  }
}
