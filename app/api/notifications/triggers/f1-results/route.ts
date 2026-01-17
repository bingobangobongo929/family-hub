import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// F1 Results notification trigger
// Cron schedule: "0 */2 * * 0" (every 2 hours on Sundays during race season)
// or "15 * * * *" (at :15 every hour) to catch post-session results

interface F1Driver {
  position: number;
  driverId: string;
  driverNumber: string;
  code: string;
  givenName: string;
  familyName: string;
  constructorId: string;
  constructorName: string;
  points: number;
  wins: number;
}

interface NotificationPrefs {
  user_id: string;
  f1_enabled: boolean;
  f1_race_results: boolean;
  f1_quali_results: boolean;
  f1_championship_updates: boolean;
  f1_spoiler_free: boolean;
  f1_favorite_driver: string | null;
  f1_favorite_team: string | null;
  f1_favorite_podium: boolean;
  f1_favorite_win: boolean;
  f1_favorite_pole: boolean;
}

interface F1NotificationState {
  user_id: string;
  last_race_results_meeting_key: number | null;
  last_drivers_leader: string | null;
  last_constructors_leader: string | null;
}

// Team colors for rich notifications
const TEAM_COLORS: Record<string, string> = {
  red_bull: '🔵', ferrari: '🔴', mercedes: '⚫', mclaren: '🟠',
  aston_martin: '🟢', alpine: '🔵', williams: '🔵', haas: '⚪',
  kick_sauber: '🟢', rb: '🔵',
};

function getTeamEmoji(constructorId: string): string {
  return TEAM_COLORS[constructorId.toLowerCase()] || '🏎️';
}

function formatDriverName(driver: F1Driver): string {
  return `${driver.givenName} ${driver.familyName.toUpperCase()}`;
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
    const currentYear = now.getFullYear();

    // Fetch current standings
    const standingsRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/f1/standings?year=${currentYear}`
    );

    if (!standingsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
    }

    const standingsData = await standingsRes.json();
    const drivers: F1Driver[] = standingsData.drivers || [];

    if (drivers.length === 0) {
      return NextResponse.json({ message: 'No standings data yet', count: 0 });
    }

    // Get current leader
    const currentLeader = drivers[0];
    const secondPlace = drivers[1];
    const podium = drivers.slice(0, 3);

    // Get users with F1 results notifications enabled
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, f1_enabled, f1_race_results, f1_championship_updates, f1_spoiler_free, f1_favorite_driver, f1_favorite_team, f1_favorite_podium, f1_favorite_win, f1_favorite_pole')
      .eq('f1_enabled', true);

    if (prefsError || !prefs || prefs.length === 0) {
      return NextResponse.json({ message: 'No users with F1 enabled', count: 0 });
    }

    // Get notification states
    const userIds = prefs.map(p => p.user_id);
    const { data: states } = await supabase
      .from('f1_notification_state')
      .select('user_id, last_drivers_leader, last_constructors_leader, last_standings_check')
      .in('user_id', userIds);

    const stateMap = new Map((states || []).map(s => [s.user_id, s]));

    let sentCount = 0;

    for (const pref of prefs) {
      // Skip if user has spoiler-free mode (results are spoilers!)
      if (pref.f1_spoiler_free) continue;

      const state = stateMap.get(pref.user_id);
      const previousLeader = state?.last_drivers_leader;

      // Check for championship lead change
      if (pref.f1_championship_updates && previousLeader && previousLeader !== currentLeader.driverId) {
        const teamEmoji = getTeamEmoji(currentLeader.constructorId);
        const gap = currentLeader.points - secondPlace.points;

        const title = `👑 NEW CHAMPIONSHIP LEADER`;
        const body = `${teamEmoji} ${formatDriverName(currentLeader)} takes the lead!\n` +
                     `📊 ${currentLeader.points} pts (+${gap} over ${secondPlace.familyName})`;

        try {
          const response = await fetch(new URL('/api/notifications/send', request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: pref.user_id,
              title,
              body,
              data: {
                type: 'f1_championship_change',
                new_leader: currentLeader.driverId,
                previous_leader: previousLeader,
                deep_link: '/f1?tab=drivers',
              },
            }),
          });

          if (response.ok) sentCount++;
        } catch (error) {
          console.error('Error sending championship notification:', error);
        }
      }

      // Check for favorite driver achievements
      if (pref.f1_favorite_driver) {
        const favoriteDriver = drivers.find(d =>
          d.driverId.toLowerCase() === pref.f1_favorite_driver!.toLowerCase() ||
          d.familyName.toLowerCase() === pref.f1_favorite_driver!.toLowerCase()
        );

        if (favoriteDriver) {
          const teamEmoji = getTeamEmoji(favoriteDriver.constructorId);

          // Check if favorite driver is leading
          if (pref.f1_favorite_win && favoriteDriver.position === 1 && previousLeader !== favoriteDriver.driverId) {
            const gap = favoriteDriver.points - secondPlace.points;

            const title = `🏆 ${favoriteDriver.familyName.toUpperCase()} LEADS THE CHAMPIONSHIP!`;
            const body = `${teamEmoji} ${formatDriverName(favoriteDriver)}\n` +
                        `📊 ${favoriteDriver.points} points (+${gap} gap)\n` +
                        `🏆 ${favoriteDriver.wins} wins this season`;

            try {
              const response = await fetch(new URL('/api/notifications/send', request.url), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: pref.user_id,
                  title,
                  body,
                  data: {
                    type: 'f1_favorite_leading',
                    driver_id: favoriteDriver.driverId,
                    deep_link: '/f1?tab=drivers',
                  },
                }),
              });

              if (response.ok) sentCount++;
            } catch (error) {
              console.error('Error sending favorite driver notification:', error);
            }
          }

          // Check if favorite is on podium (top 3)
          if (pref.f1_favorite_podium && favoriteDriver.position <= 3) {
            // Only notify on standings update, not every check
            // This would be triggered after race results are in
          }
        }
      }

      // Update state with current leader
      await supabase
        .from('f1_notification_state')
        .upsert({
          user_id: pref.user_id,
          last_drivers_leader: currentLeader.driverId,
          last_standings_check: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    }

    return NextResponse.json({
      message: `Sent ${sentCount} F1 results notifications`,
      count: sentCount,
      currentLeader: currentLeader.driverId,
      topThree: podium.map(d => d.familyName),
    });

  } catch (error) {
    console.error('Error in F1 results trigger:', error);
    return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
  }
}
