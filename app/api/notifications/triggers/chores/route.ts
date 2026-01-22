import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint is called by a cron job to send chore reminders
// Should run daily at 9am: "0 9 * * *"
export async function GET(request: NextRequest) {
  // Initialize Supabase at runtime (not build time)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Note: Auth is handled by middleware (CRON_ROUTES)

  try {
    const today = new Date().toISOString().split('T')[0];

    // Get incomplete chores due today
    const { data: chores, error: choresError } = await supabase
      .from('chores')
      .select('id, title, user_id, assigned_to')
      .eq('status', 'pending')
      .or(`due_date.eq.${today},due_date.is.null`);

    if (choresError) {
      console.error('Error fetching chores:', choresError);
      return NextResponse.json({ error: 'Failed to fetch chores' }, { status: 500 });
    }

    if (!chores || chores.length === 0) {
      return NextResponse.json({ message: 'No chores due today', count: 0 });
    }

    // Group chores by user
    const choresByUser = chores.reduce((acc, chore) => {
      const userId = chore.user_id;
      if (!acc[userId]) acc[userId] = [];
      acc[userId].push(chore);
      return acc;
    }, {} as Record<string, typeof chores>);

    // Send notification to each user with their chores
    const results = await Promise.all(
      Object.entries(choresByUser).map(async ([userId, userChores]) => {
        const choreCount = userChores.length;
        const choreList = userChores.slice(0, 3).map(c => c.title).join(', ');
        const moreText = choreCount > 3 ? ` +${choreCount - 3} more` : '';

        const sendUrl = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/notifications/send`;
        const response = await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            user_id: userId,
            title: `${choreCount} chore${choreCount > 1 ? 's' : ''} for today`,
            body: `${choreList}${moreText}`,
            data: {
              type: 'chore_reminder',
              chore_count: choreCount,
            },
          }),
        });

        return { user_id: userId, sent: response.ok, count: choreCount };
      })
    );

    const sentCount = results.filter(r => r.sent).length;
    const totalChores = results.reduce((acc, r) => acc + r.count, 0);

    return NextResponse.json({
      message: `Sent ${sentCount} chore reminders for ${totalChores} total chores`,
      users_notified: sentCount,
      chores_count: totalChores,
    });

  } catch (error) {
    console.error('Error in chore reminder trigger:', error);
    return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
  }
}
