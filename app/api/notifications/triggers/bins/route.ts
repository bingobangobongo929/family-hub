import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBinsForDate, getBinInfo } from '@/lib/bin-schedule';

// This endpoint is called by a cron job to send bin day reminders
// Should run daily at 7pm: "0 19 * * *"
export async function GET(request: NextRequest) {
  // Initialize Supabase at runtime (not build time)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify this is a cron request
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Check what bins are due tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const binsDueTomorrow = getBinsForDate(tomorrow);

    if (binsDueTomorrow.length === 0) {
      return NextResponse.json({ message: 'No bins tomorrow', count: 0 });
    }

    // Get bin details
    const binDetails = binsDueTomorrow.map(binType => getBinInfo(binType));
    const binNames = binDetails.map(b => b.name).join(' & ');
    const binEmojis = binDetails.map(b => b.emoji).join(' ');

    // Get all users with push tokens (they want notifications)
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('user_id')
      .not('user_id', 'is', null);

    if (error || !tokens || tokens.length === 0) {
      return NextResponse.json({ message: 'No users to notify', count: 0 });
    }

    // Get unique user IDs
    const userIds = [...new Set(tokens.map(t => t.user_id))];

    // Send notification to each user
    const results = await Promise.all(
      userIds.map(async (userId) => {
        const response = await fetch(new URL('/api/notifications/send', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            title: `${binEmojis} Bin Day Tomorrow!`,
            body: `Put out the ${binNames}`,
            data: {
              type: 'bin_reminder',
              bins: binsDueTomorrow,
            },
          }),
        });

        return { user_id: userId, sent: response.ok };
      })
    );

    const sentCount = results.filter(r => r.sent).length;

    return NextResponse.json({
      message: `Sent ${sentCount} bin reminders for ${binNames}`,
      count: sentCount,
      bins: binsDueTomorrow,
    });

  } catch (error) {
    console.error('Error in bin reminder trigger:', error);
    return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
  }
}
