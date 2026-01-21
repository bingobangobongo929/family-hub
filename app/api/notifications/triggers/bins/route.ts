import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBinsForDate, getBinInfo, BinType } from '@/lib/bin-schedule';

// Enhanced Bin Day notification trigger
// Cron schedule: "0 19 * * *" (7pm daily for evening reminder)
// Alternative: "0 7 * * *" (7am for morning reminder)

interface NotificationPrefs {
  user_id: string;
  bins_enabled: boolean;
  bin_reminder_evening: boolean;
  bin_reminder_morning: boolean;
}

// Check if this is a morning or evening run based on query param or hour
function isEveningRun(typeParam?: string | null): boolean {
  // If explicitly specified via query param, use that
  if (typeParam === 'morning') return false;
  if (typeParam === 'evening') return true;

  // Otherwise detect based on current hour (for manual testing)
  const hour = new Date().getHours();
  return hour >= 17 && hour <= 21; // 5pm - 9pm is evening
}

// Format bins list for notification
function formatBinsList(binTypes: BinType[]): { names: string; emojis: string; details: string } {
  const binInfos = binTypes.map(type => getBinInfo(type));

  const names = binInfos.map(b => b.shortName).join(' & ');
  const emojis = binInfos.map(b => b.emoji).join(' ');

  // Build detailed list
  const details = binInfos.map(b => `${b.emoji} ${b.name} (${b.description})`).join('\n');

  return { names, emojis, details };
}

// Get day name for notification
function getTomorrowDayName(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString('en-GB', { weekday: 'long' });
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
    // Get type from query parameter for explicit control
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const isEvening = isEveningRun(typeParam);

    // Determine which date to check
    let targetDate: Date;
    let reminderContext: string;

    if (isEvening) {
      // Evening reminder: check tomorrow's bins
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
      targetDate.setHours(0, 0, 0, 0);
      reminderContext = 'tomorrow';
    } else {
      // Morning reminder: check today's bins
      targetDate = new Date();
      targetDate.setHours(0, 0, 0, 0);
      reminderContext = 'today';
    }

    const binsDue = getBinsForDate(targetDate);

    if (binsDue.length === 0) {
      return NextResponse.json({
        message: `No bins ${reminderContext}`,
        count: 0,
        date: targetDate.toISOString(),
        isEvening,
      });
    }

    // Get users with bin notifications enabled
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id, bins_enabled, bin_reminder_evening, bin_reminder_morning')
      .eq('bins_enabled', true);

    // Filter by the appropriate reminder type
    const filteredPrefs = (prefs || []).filter(p =>
      isEvening ? p.bin_reminder_evening : p.bin_reminder_morning
    );

    // Also get users who have push tokens but no explicit prefs (use defaults)
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('user_id')
      .not('user_id', 'is', null);

    // Combine and dedupe user IDs (users with prefs enabled, or users with tokens for defaults)
    const userIdsWithPrefs = new Set(filteredPrefs.map(p => p.user_id));
    const allUserIds = tokens?.map(t => t.user_id) || [];

    // For users without explicit prefs, check if they have tokens (use default: evening ON)
    const usersToNotify = new Set<string>();
    for (const userId of allUserIds) {
      if (userIdsWithPrefs.has(userId)) {
        usersToNotify.add(userId); // Has explicit preference enabled
      } else if (isEvening) {
        // Default: evening reminder ON
        usersToNotify.add(userId);
      }
      // Default: morning reminder OFF, so skip
    }

    if (usersToNotify.size === 0) {
      return NextResponse.json({
        message: 'No users to notify',
        count: 0,
        bins: binsDue,
      });
    }

    // Format bin information
    const { names, emojis, details } = formatBinsList(binsDue);
    const dayName = isEvening ? getTomorrowDayName() : 'today';

    // Build clean notification
    let title: string;
    let body: string;

    if (isEvening) {
      // Evening reminder - night before
      if (binsDue.length === 1) {
        const binInfo = getBinInfo(binsDue[0]);
        title = `${binInfo.emoji} ${binInfo.shortName} Bin Tonight`;
        body = `Collection tomorrow (${dayName})\n${binInfo.description}\nPut out before bed`;
      } else {
        title = `${emojis} Bins Tomorrow`;
        body = `${dayName} collection:\n${details}\nPut out before bed`;
      }
    } else {
      // Morning reminder - same day
      if (binsDue.length === 1) {
        const binInfo = getBinInfo(binsDue[0]);
        title = `${binInfo.emoji} ${binInfo.shortName} Bin Today`;
        body = `Collection happening today\n${binInfo.description}\nMake sure it's out!`;
      } else {
        title = `${emojis} Bins Today`;
        body = `Today's collection:\n${details}\nMake sure they're out!`;
      }
    }

    let sentCount = 0;
    const results: { user_id: string; sent: boolean }[] = [];

    for (const userId of usersToNotify) {
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
              type: isEvening ? 'bin_reminder_evening' : 'bin_reminder_morning',
              bins: binsDue,
              collection_date: targetDate.toISOString(),
              deep_link: '/bindicator',
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
              category: 'bins',
              notification_type: isEvening ? 'bin_reminder_evening' : 'bin_reminder_morning',
              title,
              body,
              data: { bins: binsDue, collection_date: targetDate.toISOString() },
            });

          results.push({ user_id: userId, sent: true });
        } else {
          results.push({ user_id: userId, sent: false });
        }
      } catch (error) {
        console.error('Error sending bin notification:', error);
        results.push({ user_id: userId, sent: false });
      }
    }

    return NextResponse.json({
      message: `Sent ${sentCount} bin reminders for ${names}`,
      count: sentCount,
      bins: binsDue,
      reminderType: isEvening ? 'evening' : 'morning',
      collectionDate: targetDate.toISOString(),
    });

  } catch (error) {
    console.error('Error in bin reminder trigger:', error);
    return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
  }
}
