import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface StatusCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  detail: string;
}

export async function GET(request: NextRequest) {
  // Try Bearer token auth first, then fall back to cookie auth
  const authHeader = request.headers.get('authorization');
  let user = null;

  if (authHeader?.startsWith('Bearer ')) {
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user: tokenUser }, error } = await supabaseAuth.auth.getUser(
      authHeader.substring(7)
    );
    if (!error && tokenUser) {
      user = tokenUser;
    }
  }

  if (!user) {
    const cookieStore = await cookies();
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
    const { data: { user: cookieUser }, error } = await supabaseAuth.auth.getUser();
    if (!error && cookieUser) {
      user = cookieUser;
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Create service client for admin queries
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const checks: StatusCheck[] = [];
  const data: Record<string, any> = {};

  // Check 1: Push Token
  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('token, platform, created_at, updated_at')
    .eq('user_id', user.id);

  if (tokenError || !tokens || tokens.length === 0) {
    checks.push({
      name: 'push_token',
      status: 'fail',
      detail: 'No push token found for this user',
    });
    data.push_token = null;
  } else {
    const token = tokens[0];
    checks.push({
      name: 'push_token',
      status: 'pass',
      detail: `Token found (${token.platform}): ${token.token.substring(0, 20)}...`,
    });
    data.push_token = {
      platform: token.platform,
      token_preview: token.token.substring(0, 20) + '...',
      created_at: token.created_at,
      updated_at: token.updated_at,
    };
  }

  // Check 2: Notification Preferences
  const { data: prefs, error: prefsError } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (prefsError || !prefs) {
    checks.push({
      name: 'notification_preferences',
      status: 'warning',
      detail: 'No preferences found - using defaults',
    });
    data.notification_preferences = { exists: false, using_defaults: true };
  } else {
    checks.push({
      name: 'notification_preferences',
      status: 'pass',
      detail: `Preferences found, updated ${new Date(prefs.updated_at).toLocaleString()}`,
    });
    data.notification_preferences = {
      exists: true,
      updated_at: prefs.updated_at,
      master_enabled: prefs.master_enabled,
      f1_enabled: prefs.f1_enabled,
      f1_news_enabled: prefs.f1_news_enabled,
      shopping_enabled: prefs.shopping_enabled,
      shopping_list_changes: prefs.shopping_list_changes,
      bins_enabled: prefs.bins_enabled,
      calendar_enabled: prefs.calendar_enabled,
    };
  }

  // Check 3: F1 Notification State
  const { data: f1State, error: f1StateError } = await supabase
    .from('f1_notification_state')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (f1StateError || !f1State) {
    checks.push({
      name: 'f1_notification_state',
      status: 'warning',
      detail: 'No F1 state found - will notify on first eligible article',
    });
    data.f1_notification_state = { exists: false };
  } else {
    checks.push({
      name: 'f1_notification_state',
      status: 'pass',
      detail: `Last check: ${f1State.last_news_check || 'never'}`,
    });
    data.f1_notification_state = {
      exists: true,
      last_news_check: f1State.last_news_check,
      last_news_article_id: f1State.last_news_article_id,
      last_session_notified: f1State.last_session_notified,
      updated_at: f1State.updated_at,
    };
  }

  // Check 4: APNs Configuration (server-side only)
  const apnsKeyId = process.env.APNS_KEY_ID;
  const apnsTeamId = process.env.APNS_TEAM_ID;
  const apnsKey = process.env.APNS_PRIVATE_KEY;
  const apnsProduction = process.env.APNS_PRODUCTION;

  const apnsConfigured = !!(apnsKeyId && apnsTeamId && apnsKey);

  if (apnsConfigured) {
    checks.push({
      name: 'apns_config',
      status: 'pass',
      detail: `APNs configured (${apnsProduction === 'true' ? 'production' : 'sandbox'})`,
    });
  } else {
    const missing = [];
    if (!apnsKeyId) missing.push('APNS_KEY_ID');
    if (!apnsTeamId) missing.push('APNS_TEAM_ID');
    if (!apnsKey) missing.push('APNS_PRIVATE_KEY');
    checks.push({
      name: 'apns_config',
      status: 'fail',
      detail: `Missing: ${missing.join(', ')}`,
    });
  }

  data.apns_config = {
    key_id_configured: !!apnsKeyId,
    team_id_configured: !!apnsTeamId,
    private_key_configured: !!apnsKey,
    production: apnsProduction === 'true',
  };

  // Check 5: CRON_SECRET (needed for triggers)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    checks.push({
      name: 'cron_secret',
      status: 'pass',
      detail: 'CRON_SECRET configured',
    });
  } else {
    checks.push({
      name: 'cron_secret',
      status: 'fail',
      detail: 'CRON_SECRET not configured - triggers will fail',
    });
  }
  data.cron_secret_configured = !!cronSecret;

  // Check 6: VAPID keys for web push
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidConfigured = !!(vapidPublicKey && vapidPrivateKey);

  if (vapidConfigured) {
    checks.push({
      name: 'web_push_config',
      status: 'pass',
      detail: 'VAPID keys configured for web push',
    });
  } else {
    const missing = [];
    if (!vapidPublicKey) missing.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
    if (!vapidPrivateKey) missing.push('VAPID_PRIVATE_KEY');
    checks.push({
      name: 'web_push_config',
      status: 'warning',
      detail: `Web push not configured (missing: ${missing.join(', ')})`,
    });
  }

  data.web_push_config = {
    public_key_configured: !!vapidPublicKey,
    private_key_configured: !!vapidPrivateKey,
  };

  // Overall status
  const hasFailure = checks.some(c => c.status === 'fail');
  const hasWarning = checks.some(c => c.status === 'warning');
  const overallStatus = hasFailure ? 'fail' : hasWarning ? 'warning' : 'pass';

  return NextResponse.json({
    status: overallStatus,
    checks,
    data,
    user_id: user.id,
    checked_at: new Date().toISOString(),
  });
}

// POST endpoint to reset F1 notification state
export async function POST(request: NextRequest) {
  // Try Bearer token auth first, then fall back to cookie auth
  const authHeader = request.headers.get('authorization');
  let user = null;

  if (authHeader?.startsWith('Bearer ')) {
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user: tokenUser }, error } = await supabaseAuth.auth.getUser(
      authHeader.substring(7)
    );
    if (!error && tokenUser) {
      user = tokenUser;
    }
  }

  if (!user) {
    const cookieStore = await cookies();
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
    const { data: { user: cookieUser }, error } = await supabaseAuth.auth.getUser();
    if (!error && cookieUser) {
      user = cookieUser;
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (action === 'reset_f1_state') {
    // Reset F1 notification state
    const { error } = await supabase
      .from('f1_notification_state')
      .upsert({
        user_id: user.id,
        last_news_check: null,
        last_news_article_id: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      return NextResponse.json({ error: 'Failed to reset F1 state' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'F1 notification state reset' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
