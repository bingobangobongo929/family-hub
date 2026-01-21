import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Debug endpoint to track cron job execution history
 * Shows when cron jobs have actually been called
 *
 * GET /api/notifications/debug/cron-history - View execution history
 * POST /api/notifications/debug/cron-history - Log a cron execution (called by triggers)
 */

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check if cron_execution_log table exists
  const { data: logs, error } = await supabase
    .from('cron_execution_log')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(50);

  if (error?.message?.includes('does not exist')) {
    return NextResponse.json({
      table_missing: true,
      message: 'cron_execution_log table does not exist',
      sql_to_create: `
CREATE TABLE IF NOT EXISTS cron_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  result JSONB,
  duration_ms INTEGER
);

CREATE INDEX idx_cron_log_trigger_time ON cron_execution_log(trigger_name, executed_at DESC);
      `.trim(),
    });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by trigger name
  const byTrigger: Record<string, any[]> = {};
  for (const log of logs || []) {
    byTrigger[log.trigger_name] = byTrigger[log.trigger_name] || [];
    byTrigger[log.trigger_name].push({
      executed_at: log.executed_at,
      result: log.result,
      duration_ms: log.duration_ms,
    });
  }

  // Calculate stats
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const stats: Record<string, any> = {};
  for (const [trigger, executions] of Object.entries(byTrigger)) {
    const last = executions[0];
    const lastHour = executions.filter(e => new Date(e.executed_at) > oneHourAgo);
    const lastDay = executions.filter(e => new Date(e.executed_at) > oneDayAgo);

    stats[trigger] = {
      last_execution: last?.executed_at,
      executions_last_hour: lastHour.length,
      executions_last_24h: lastDay.length,
      last_result: last?.result,
    };
  }

  // Check for missing cron jobs (expected vs actual)
  const expectedCrons = [
    'events', 'tasks', 'bins', 'chores', 'shopping-list',
    'f1-news', 'f1-sessions', 'f1-results'
  ];

  const missingCrons = expectedCrons.filter(c => !stats[c] || stats[c].executions_last_24h === 0);

  return NextResponse.json({
    timestamp: now.toISOString(),
    total_executions: logs?.length || 0,
    stats,
    missing_in_last_24h: missingCrons,
    all_logs: logs,
  });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { trigger_name, result, duration_ms } = await request.json();

    const { error } = await supabase
      .from('cron_execution_log')
      .insert({
        trigger_name,
        result,
        duration_ms,
      });

    if (error) {
      // Table might not exist
      return NextResponse.json({ logged: false, error: error.message });
    }

    return NextResponse.json({ logged: true });

  } catch (error: any) {
    return NextResponse.json({ logged: false, error: error.message });
  }
}
