import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Debug endpoint to fix missing database columns for notifications
 *
 * POST /api/notifications/debug/fix-schema
 */

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const results: { action: string; status: string; error?: string }[] = [];

  // Add missing reminder columns to calendar_events
  const columns = ['reminder_15m_sent', 'reminder_30m_sent', 'reminder_1h_sent', 'reminder_1d_sent'];

  for (const column of columns) {
    try {
      // Check if column exists
      const { data: existing } = await supabase
        .from('calendar_events')
        .select(column)
        .limit(1);

      results.push({
        action: `Check column ${column}`,
        status: 'exists',
      });
    } catch (error: any) {
      // Column doesn't exist, try to add it
      if (error.message?.includes('does not exist')) {
        try {
          // Use raw SQL via RPC if available, otherwise report the issue
          const { error: alterError } = await supabase.rpc('exec_sql', {
            sql: `ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS ${column} TIMESTAMPTZ;`
          });

          if (alterError) {
            results.push({
              action: `Add column ${column}`,
              status: 'failed',
              error: alterError.message,
            });
          } else {
            results.push({
              action: `Add column ${column}`,
              status: 'added',
            });
          }
        } catch (rpcError: any) {
          results.push({
            action: `Add column ${column}`,
            status: 'manual_required',
            error: `Column missing. Run: ALTER TABLE calendar_events ADD COLUMN ${column} TIMESTAMPTZ;`,
          });
        }
      } else {
        results.push({
          action: `Check column ${column}`,
          status: 'error',
          error: error.message,
        });
      }
    }
  }

  // Check notification_log table
  try {
    const { data, error } = await supabase
      .from('notification_log')
      .select('id')
      .limit(1);

    results.push({
      action: 'Check notification_log table',
      status: error ? 'missing' : 'exists',
      error: error?.message,
    });
  } catch (e: any) {
    results.push({
      action: 'Check notification_log table',
      status: 'error',
      error: e.message,
    });
  }

  // Check f1_notification_state table
  try {
    const { data, error } = await supabase
      .from('f1_notification_state')
      .select('user_id')
      .limit(1);

    results.push({
      action: 'Check f1_notification_state table',
      status: error ? 'missing' : 'exists',
      error: error?.message,
    });
  } catch (e: any) {
    results.push({
      action: 'Check f1_notification_state table',
      status: 'error',
      error: e.message,
    });
  }

  const hasFailures = results.some(r => r.status === 'failed' || r.status === 'manual_required');

  return NextResponse.json({
    success: !hasFailures,
    results,
    sql_to_run_manually: hasFailures ? `
-- Run this in Supabase SQL Editor:
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminder_15m_sent TIMESTAMPTZ;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminder_30m_sent TIMESTAMPTZ;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminder_1h_sent TIMESTAMPTZ;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminder_1d_sent TIMESTAMPTZ;
    `.trim() : null,
  });
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to run schema fixes',
    description: 'This will check and attempt to fix missing database columns for notifications',
  });
}
