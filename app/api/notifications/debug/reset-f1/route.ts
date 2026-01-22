import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Reset F1 notification state so user can receive missed articles
 * POST /api/notifications/debug/reset-f1
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // Reset to 24 hours ago so recent articles will be picked up
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('f1_notification_state')
      .upsert({
        user_id,
        last_news_check: twentyFourHoursAgo,
        last_news_article_id: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    // Log the reset
    await supabase.from('notification_log').insert({
      user_id,
      category: 'debug',
      notification_type: 'f1_state_reset',
      title: 'F1 State Reset',
      body: `Reset last_news_check to ${twentyFourHoursAgo}`,
      data: { reset_to: twentyFourHoursAgo },
    });

    return NextResponse.json({
      success: true,
      message: 'F1 state reset. Next cron run will check for articles from the last 24 hours.',
      reset_to: twentyFourHoursAgo
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
