import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Debug endpoint to view notification_log directly
 *
 * GET /api/notifications/debug/logs
 */

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get all logs
  const { data: logs, error } = await supabase
    .from('notification_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({
      error: error.message,
      hint: 'Table might not exist or RLS blocking'
    }, { status: 500 });
  }

  // Try inserting a test log
  const { error: insertError } = await supabase
    .from('notification_log')
    .insert({
      user_id: null,
      category: 'debug',
      notification_type: 'test_insert',
      title: 'Test Log Entry',
      body: `Inserted at ${new Date().toISOString()}`,
      data: { test: true },
    });

  return NextResponse.json({
    log_count: logs?.length || 0,
    logs: logs?.map(l => ({
      id: l.id,
      category: l.category,
      type: l.notification_type,
      title: l.title,
      created_at: l.created_at || l.sent_at,
    })),
    test_insert: insertError ? { error: insertError.message } : { success: true },
  });
}
