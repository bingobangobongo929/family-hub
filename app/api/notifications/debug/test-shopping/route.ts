import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Debug endpoint to test shopping notifications end-to-end
 *
 * GET /api/notifications/debug/test-shopping - Check status
 * POST /api/notifications/debug/test-shopping - Add test change and trigger notification
 */

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const debug: any = { steps: [] };

  // Check if table exists
  const { data: tableCheck, error: tableError } = await supabase
    .from('shopping_list_changes')
    .select('id')
    .limit(1);

  debug.steps.push({
    step: 'Check shopping_list_changes table',
    exists: !tableError,
    error: tableError?.message,
  });

  if (tableError) {
    debug.table_missing = true;
    debug.sql_to_create = `
CREATE TABLE IF NOT EXISTS shopping_list_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('added', 'removed', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_changes_user_created
  ON shopping_list_changes(user_id, created_at DESC);

ALTER TABLE shopping_list_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage shopping list changes"
  ON shopping_list_changes FOR ALL
  USING (true)
  WITH CHECK (true);
    `.trim();
    return NextResponse.json(debug);
  }

  // Get recent changes
  const now = new Date();
  const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

  const { data: recentChanges, error: changesError } = await supabase
    .from('shopping_list_changes')
    .select('*')
    .gte('created_at', twentyMinutesAgo.toISOString())
    .order('created_at', { ascending: false });

  debug.steps.push({
    step: 'Check recent changes (last 20 min)',
    count: recentChanges?.length || 0,
    changes: recentChanges?.map(c => ({
      item: c.item_name,
      action: c.action,
      created_at: c.created_at,
      user_id: c.user_id?.substring(0, 8) + '...',
    })),
    error: changesError?.message,
  });

  // Get user with push token
  const { data: tokenUser } = await supabase
    .from('push_tokens')
    .select('user_id')
    .limit(1)
    .single();

  debug.steps.push({
    step: 'Find user with push token',
    found: !!tokenUser,
    user_id: tokenUser?.user_id?.substring(0, 8) + '...',
  });

  // Check user preferences
  if (tokenUser) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('shopping_enabled, shopping_list_changes, shopping_notify_own_changes')
      .eq('user_id', tokenUser.user_id)
      .single();

    debug.steps.push({
      step: 'Check shopping notification preferences',
      prefs: prefs || 'No preferences found (will use defaults: enabled)',
    });
  }

  debug.instructions = 'Use POST to add a test change and immediately send notification';

  return NextResponse.json(debug);
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const debug: any = { steps: [] };

  // Get user with push token
  const { data: tokenUser } = await supabase
    .from('push_tokens')
    .select('user_id')
    .limit(1)
    .single();

  if (!tokenUser) {
    return NextResponse.json({ error: 'No user with push token found' }, { status: 404 });
  }

  debug.user_id = tokenUser.user_id.substring(0, 8) + '...';

  // Insert a test change (dated 15 minutes ago so it's in the notification window)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const { error: insertError } = await supabase
    .from('shopping_list_changes')
    .insert({
      user_id: tokenUser.user_id,
      item_name: 'TEST: Debug Item ' + Date.now(),
      action: 'added',
      created_at: fifteenMinutesAgo.toISOString(),
    });

  debug.steps.push({
    step: 'Insert test change (15 min ago)',
    success: !insertError,
    error: insertError?.message,
  });

  if (insertError) {
    return NextResponse.json(debug);
  }

  // Now trigger the shopping notification
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  try {
    const triggerResponse = await fetch(`${baseUrl}/api/notifications/triggers/shopping-list`, {
      method: 'GET',
    });

    const triggerResult = await triggerResponse.json();

    debug.steps.push({
      step: 'Trigger shopping notification',
      status: triggerResponse.status,
      result: triggerResult,
    });

    debug.notification_sent = triggerResult.count > 0;

  } catch (error: any) {
    debug.steps.push({
      step: 'Trigger shopping notification',
      error: error.message,
    });
  }

  // Clean up test item
  await supabase
    .from('shopping_list_changes')
    .delete()
    .like('item_name', 'TEST: Debug Item%');

  debug.steps.push({
    step: 'Cleanup test data',
    success: true,
  });

  return NextResponse.json(debug);
}
