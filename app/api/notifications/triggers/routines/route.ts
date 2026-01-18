import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Routine reminder notification trigger
// Cron schedule: "*/5 * * * *" (every 5 minutes)
// Sends reminders when it's time to start a routine

interface Routine {
  id: string;
  user_id: string;
  title: string;
  emoji: string;
  type: 'morning' | 'evening' | 'custom';
  scheduled_time: string; // HH:MM format
  points_reward: number;
  reminder_enabled: boolean;
  last_reminder_sent: string | null;
  schedule_type: 'daily' | 'weekdays' | 'weekends' | 'custom';
  schedule_days: number[] | null;
}

interface RoutineStep {
  id: string;
  routine_id: string;
  title: string;
  emoji: string;
  duration_minutes: number;
  sort_order: number;
}

interface FamilyMember {
  id: string;
  name: string;
  color: string;
}

interface RoutineMember {
  routine_id: string;
  member_id: string;
}

interface NotificationPrefs {
  user_id: string;
  routines_enabled: boolean;
  routine_start_reminder: boolean;
}

// Get day of week (0 = Sunday, 6 = Saturday)
function getDayOfWeek(): number {
  return new Date().getDay();
}

// Check if routine should run today based on schedule
function shouldRunToday(routine: Routine): boolean {
  const today = getDayOfWeek();

  if (routine.schedule_type === 'daily') return true;
  if (routine.schedule_type === 'weekdays') return today >= 1 && today <= 5;
  if (routine.schedule_type === 'weekends') return today === 0 || today === 6;
  if (routine.schedule_type === 'custom' && routine.schedule_days) {
    return routine.schedule_days.includes(today);
  }

  return true; // Default to daily
}

// Get current time in HH:MM format
function getCurrentTime(): string {
  const now = new Date();
  // Use Copenhagen timezone
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Copenhagen'
  };
  return now.toLocaleTimeString('en-GB', options);
}

// Check if time is within window (scheduled_time to scheduled_time + 10 minutes)
function isWithinWindow(scheduledTime: string, currentTime: string): boolean {
  const [schedHour, schedMin] = scheduledTime.split(':').map(Number);
  const [currHour, currMin] = currentTime.split(':').map(Number);

  const schedMinutes = schedHour * 60 + schedMin;
  const currMinutes = currHour * 60 + currMin;

  // Within 10 minute window after scheduled time
  return currMinutes >= schedMinutes && currMinutes <= schedMinutes + 10;
}

// Format routine type for display
function getRoutineTypeInfo(type: string): { emoji: string; greeting: string } {
  switch (type) {
    case 'morning':
      return { emoji: '☀️', greeting: 'Good morning!' };
    case 'evening':
      return { emoji: '🌙', greeting: 'Bedtime!' };
    default:
      return { emoji: '📋', greeting: "It's time!" };
  }
}

// Check if routine was already reminded today
function wasRemindedToday(lastReminder: string | null): boolean {
  if (!lastReminder) return false;

  const lastDate = new Date(lastReminder);
  const today = new Date();

  return lastDate.toDateString() === today.toDateString();
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
    const currentTime = getCurrentTime();

    // Get all routines with reminders enabled
    const { data: routines, error: routinesError } = await supabase
      .from('routines')
      .select('*')
      .eq('reminder_enabled', true)
      .not('scheduled_time', 'is', null);

    if (routinesError || !routines || routines.length === 0) {
      return NextResponse.json({ message: 'No routines with reminders', count: 0 });
    }

    // Filter routines that should run now
    const routinesToRemind = (routines as Routine[]).filter(routine => {
      // Check if should run today
      if (!shouldRunToday(routine)) return false;

      // Check if within time window
      if (!isWithinWindow(routine.scheduled_time, currentTime)) return false;

      // Check if already reminded today
      if (wasRemindedToday(routine.last_reminder_sent)) return false;

      return true;
    });

    if (routinesToRemind.length === 0) {
      return NextResponse.json({ message: 'No routines to remind right now', count: 0 });
    }

    // Get user preferences
    const userIds = [...new Set(routinesToRemind.map(r => r.user_id))];
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id, routines_enabled, routine_start_reminder')
      .in('user_id', userIds)
      .eq('routines_enabled', true)
      .eq('routine_start_reminder', true);

    const prefMap = new Map((prefs || []).map(p => [p.user_id, p]));

    // Get routine steps for context
    const routineIds = routinesToRemind.map(r => r.id);
    const { data: steps } = await supabase
      .from('routine_steps')
      .select('routine_id, title, emoji')
      .in('routine_id', routineIds)
      .order('sort_order');

    const stepsMap = new Map<string, RoutineStep[]>();
    (steps || []).forEach(step => {
      if (!stepsMap.has(step.routine_id)) {
        stepsMap.set(step.routine_id, []);
      }
      stepsMap.get(step.routine_id)!.push(step as RoutineStep);
    });

    // Get routine members for context
    const { data: routineMembers } = await supabase
      .from('routine_members')
      .select('routine_id, member_id')
      .in('routine_id', routineIds);

    const memberIds = (routineMembers || []).map(rm => rm.member_id);
    const { data: members } = memberIds.length > 0
      ? await supabase.from('family_members').select('id, name, color').in('id', memberIds)
      : { data: [] };

    const memberMap = new Map((members || []).map(m => [m.id, m]));

    // Group members by routine
    const routineMembersMap = new Map<string, FamilyMember[]>();
    (routineMembers || []).forEach(rm => {
      if (!routineMembersMap.has(rm.routine_id)) {
        routineMembersMap.set(rm.routine_id, []);
      }
      const member = memberMap.get(rm.member_id);
      if (member) {
        routineMembersMap.get(rm.routine_id)!.push(member);
      }
    });

    let sentCount = 0;
    const results: { routine: string; sent: boolean }[] = [];

    for (const routine of routinesToRemind) {
      // Check user preferences
      const pref = prefMap.get(routine.user_id);
      if (!pref) {
        // Check if user has push tokens (use defaults)
        const { data: tokens } = await supabase
          .from('push_tokens')
          .select('user_id')
          .eq('user_id', routine.user_id)
          .limit(1);

        if (!tokens || tokens.length === 0) continue;
      }

      const typeInfo = getRoutineTypeInfo(routine.type);
      const routineSteps = stepsMap.get(routine.id) || [];
      const routineMembersList = routineMembersMap.get(routine.id) || [];

      // Build rich notification
      let title = `${routine.emoji || typeInfo.emoji} ${typeInfo.greeting} ${routine.title}`;
      let body = '';

      // Add member names
      if (routineMembersList.length > 0) {
        const names = routineMembersList.map(m => m.name).join(' & ');
        body = `👶 Time for ${names}'s routine!`;
      }

      // Add first few steps preview
      if (routineSteps.length > 0) {
        const stepPreviews = routineSteps.slice(0, 3).map(s => `${s.emoji} ${s.title}`);
        body += `\n${stepPreviews.join(' → ')}`;
        if (routineSteps.length > 3) {
          body += ` +${routineSteps.length - 3} more`;
        }
      }

      // Add points reward
      if (routine.points_reward > 0) {
        body += `\n⭐ ${routine.points_reward} stars on completion!`;
      }

      try {
        const response = await fetch(new URL('/api/notifications/send', request.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            user_id: routine.user_id,
            title,
            body,
            data: {
              type: 'routine_reminder',
              routine_id: routine.id,
              routine_title: routine.title,
              routine_type: routine.type,
              deep_link: '/routines',
            },
          }),
        });

        if (response.ok) {
          sentCount++;

          // Update last reminder sent
          await supabase
            .from('routines')
            .update({ last_reminder_sent: new Date().toISOString() })
            .eq('id', routine.id);

          // Log notification
          await supabase
            .from('notification_log')
            .insert({
              user_id: routine.user_id,
              category: 'routines',
              notification_type: 'routine_start',
              title,
              body,
              data: { routine_id: routine.id, routine_title: routine.title },
            });

          results.push({ routine: routine.title, sent: true });
        } else {
          results.push({ routine: routine.title, sent: false });
        }
      } catch (error) {
        console.error('Error sending routine notification:', error);
        results.push({ routine: routine.title, sent: false });
      }
    }

    return NextResponse.json({
      message: `Sent ${sentCount} routine reminders`,
      count: sentCount,
      currentTime,
      results,
    });

  } catch (error) {
    console.error('Error in routine reminder trigger:', error);
    return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
  }
}
