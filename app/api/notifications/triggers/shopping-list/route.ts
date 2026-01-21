import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Shopping List Change notification trigger with 10-minute debounce
// Cron schedule: "*/10 * * * *" (every 10 minutes)
// Notifies ALL family members about shopping list changes
// With option to include/exclude your own changes

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

  // Note: Auth is handled by middleware (CRON_ROUTES)

  try {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

    // Get ALL changes from the last 20 minutes
    const { data: allChanges } = await supabase
      .from('shopping_list_changes')
      .select('*')
      .gte('created_at', twentyMinutesAgo.toISOString())
      .order('created_at', { ascending: false });

    if (!allChanges || allChanges.length === 0) {
      return NextResponse.json({ message: 'No recent changes', sent: 0 });
    }

    // Check debounce: only notify if the most recent change is > 10 minutes old
    const mostRecentChange = new Date(allChanges[0].created_at);
    if (mostRecentChange > tenMinutesAgo) {
      return NextResponse.json({ message: 'Still editing, debouncing', sent: 0 });
    }

    // Get changes to notify about (between 10-20 minutes ago)
    const changesToNotify = allChanges.filter(c => {
      const changeTime = new Date(c.created_at);
      return changeTime <= tenMinutesAgo && changeTime > twentyMinutesAgo;
    });

    if (changesToNotify.length === 0) {
      return NextResponse.json({ message: 'No new changes to notify', sent: 0 });
    }

    // Get unique user IDs who made changes (to check notify_own_changes)
    const changeAuthors = new Set(changesToNotify.map(c => c.user_id));

    // Get ALL users with push tokens
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('user_id')
      .not('user_id', 'is', null);

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ message: 'No users with push tokens', sent: 0 });
    }

    const userIds = [...new Set(tokens.map(t => t.user_id))];

    // Format the notification content
    const { details } = formatChanges(changesToNotify);
    const title = `🛒 Shopping List Updated`;
    const body = details || `${changesToNotify.length} change${changesToNotify.length > 1 ? 's' : ''}`;

    let sentCount = 0;
    const results: { user_id: string; sent: boolean; reason?: string }[] = [];

    // Send to each user
    for (const userId of userIds) {
      // Check user preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('shopping_enabled, shopping_list_changes, shopping_notify_own_changes')
        .eq('user_id', userId)
        .single();

      // Default: shopping notifications ON (changed from previous behavior)
      const shoppingEnabled = !prefs || prefs.shopping_enabled !== false;
      const listChangesEnabled = !prefs || prefs.shopping_list_changes !== false;

      if (!shoppingEnabled || !listChangesEnabled) {
        results.push({ user_id: userId, sent: false, reason: 'disabled' });
        continue;
      }

      // Check if this user made ALL the changes
      const userMadeAllChanges = changesToNotify.every(c => c.user_id === userId);

      if (userMadeAllChanges) {
        // User made all changes - check if they want to be notified about own changes
        const notifyOwnChanges = !prefs || prefs.shopping_notify_own_changes !== false;
        if (!notifyOwnChanges) {
          results.push({ user_id: userId, sent: false, reason: 'own_changes_disabled' });
          continue;
        }
      }

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

          results.push({ user_id: userId, sent: true });
        } else {
          results.push({ user_id: userId, sent: false, reason: 'send_failed' });
        }
      } catch (error) {
        console.error('Error sending shopping notification:', error);
        results.push({ user_id: userId, sent: false, reason: 'error' });
      }
    }

    // Clean up old changes (older than 20 minutes)
    await supabase
      .from('shopping_list_changes')
      .delete()
      .lt('created_at', twentyMinutesAgo.toISOString());

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
