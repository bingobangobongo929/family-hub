import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Shopping List Change notification trigger with 10-minute debounce
// Cron schedule: "*/10 * * * *" (every 10 minutes)
// Only sends notifications if:
// 1. There are changes in the last 10 minutes
// 2. No changes have occurred in the last 10 minutes (debounce)

interface ShoppingListChange {
  id: string;
  user_id: string;
  item_name: string;
  action: 'added' | 'removed' | 'completed';
  created_at: string;
}

// Format the list of changes for notification
function formatChanges(changes: ShoppingListChange[]): { summary: string; details: string } {
  const added = changes.filter(c => c.action === 'added');
  const removed = changes.filter(c => c.action === 'removed');
  const completed = changes.filter(c => c.action === 'completed');

  const parts: string[] = [];

  if (added.length > 0) {
    if (added.length <= 3) {
      parts.push(`Added: ${added.map(c => c.item_name).join(', ')}`);
    } else {
      parts.push(`Added ${added.length} items`);
    }
  }

  if (completed.length > 0) {
    if (completed.length <= 3) {
      parts.push(`Completed: ${completed.map(c => c.item_name).join(', ')}`);
    } else {
      parts.push(`Completed ${completed.length} items`);
    }
  }

  if (removed.length > 0) {
    if (removed.length <= 3) {
      parts.push(`Removed: ${removed.map(c => c.item_name).join(', ')}`);
    } else {
      parts.push(`Removed ${removed.length} items`);
    }
  }

  const summary = `${changes.length} shopping list change${changes.length > 1 ? 's' : ''}`;
  const details = parts.join('\n');

  return { summary, details };
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify cron request in production
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

    // Get changes from the last 20 minutes grouped by user
    const { data: changes } = await supabase
      .from('shopping_list_changes')
      .select('*')
      .gte('created_at', twentyMinutesAgo.toISOString())
      .order('created_at', { ascending: false });

    if (!changes || changes.length === 0) {
      return NextResponse.json({ message: 'No recent changes', sent: 0 });
    }

    // Group changes by user
    const changesByUser = new Map<string, ShoppingListChange[]>();
    for (const change of changes) {
      const existing = changesByUser.get(change.user_id) || [];
      existing.push(change);
      changesByUser.set(change.user_id, existing);
    }

    let sentCount = 0;
    const results: { user_id: string; sent: boolean; reason?: string }[] = [];

    for (const [userId, userChanges] of changesByUser) {
      // Check debounce: only notify if the most recent change is > 10 minutes old
      // This means the user stopped making changes for at least 10 minutes
      const mostRecentChange = new Date(userChanges[0].created_at);
      const oldestChange = new Date(userChanges[userChanges.length - 1].created_at);

      // If the most recent change is less than 10 minutes old, skip (still editing)
      if (mostRecentChange > tenMinutesAgo) {
        results.push({ user_id: userId, sent: false, reason: 'still_editing' });
        continue;
      }

      // Only include changes that haven't been notified yet (between 10-20 minutes ago)
      const changesToNotify = userChanges.filter(c => {
        const changeTime = new Date(c.created_at);
        return changeTime <= tenMinutesAgo && changeTime > twentyMinutesAgo;
      });

      if (changesToNotify.length === 0) {
        results.push({ user_id: userId, sent: false, reason: 'already_notified' });
        continue;
      }

      // Check user preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('shopping_enabled, shopping_list_changes')
        .eq('user_id', userId)
        .single();

      // Default: shopping notifications OFF unless explicitly enabled
      const shouldNotify = prefs?.shopping_enabled && prefs?.shopping_list_changes;

      if (!shouldNotify) {
        results.push({ user_id: userId, sent: false, reason: 'disabled' });
        continue;
      }

      // Format clean notification
      const { summary, details } = formatChanges(changesToNotify);
      const title = `🛒 Shopping List`;
      const body = `${details}\n${changesToNotify.length} change${changesToNotify.length > 1 ? 's' : ''}`;

      // Send notification
      try {
        const response = await fetch(new URL('/api/notifications/send', request.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            user_id: userId,
            title,
            body,
            data: {
              type: 'shopping_list_changes',
              change_count: changesToNotify.length,
              deep_link: '/shopping',
            },
          }),
        });

        if (response.ok) {
          sentCount++;

          // Log notification
          await supabase
            .from('notification_log')
            .insert({
              user_id: userId,
              category: 'shopping',
              notification_type: 'shopping_list_changes',
              title,
              body,
              data: { change_count: changesToNotify.length },
            });

          // Clean up old changes for this user (older than 20 minutes)
          await supabase
            .from('shopping_list_changes')
            .delete()
            .eq('user_id', userId)
            .lt('created_at', twentyMinutesAgo.toISOString());

          results.push({ user_id: userId, sent: true });
        } else {
          results.push({ user_id: userId, sent: false, reason: 'send_failed' });
        }
      } catch (error) {
        console.error('Error sending shopping notification:', error);
        results.push({ user_id: userId, sent: false, reason: 'error' });
      }
    }

    return NextResponse.json({
      message: `Sent ${sentCount} shopping list notifications`,
      count: sentCount,
      results,
    });

  } catch (error) {
    console.error('Error in shopping list trigger:', error);
    return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
  }
}

// POST endpoint to record a shopping list change
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { user_id, item_name, action } = await request.json();

    if (!user_id || !item_name || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Record the change
    const { error } = await supabase
      .from('shopping_list_changes')
      .insert({
        user_id,
        item_name,
        action,
      });

    if (error) {
      console.error('Error recording shopping change:', error);
      return NextResponse.json({ error: 'Failed to record change' }, { status: 500 });
    }

    return NextResponse.json({ success: true, recorded: true });

  } catch (error) {
    console.error('Error in shopping list POST:', error);
    return NextResponse.json({ error: 'Failed to record change' }, { status: 500 });
  }
}
