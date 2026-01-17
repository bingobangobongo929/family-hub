# Family Hub Notification System Plan

## Overview

A comprehensive, modular notification system that allows users to stay informed about family activities while maintaining full control over what notifications they receive. The system is designed with privacy in mind - all notifications are processed locally or through the family's Supabase instance.

---

## Current Implementation Status

### Already Built ✅
| Component | Location | Status |
|-----------|----------|--------|
| APNs Push Sender | `/api/notifications/send` | Working |
| Push Token Storage | `push_tokens` table | Working |
| Event Reminders (15min) | `/api/notifications/triggers/events` | Working |
| Bin Day Reminders | `/api/notifications/triggers/bins` | Working |
| F1 News AI Filtering | `/api/f1/news` | Working (pull-based) |
| F1 Schedule Data | `/api/f1/schedule` | Working |

### Needs Implementation 🔧
| Component | Difficulty | Notes |
|-----------|------------|-------|
| Notification Preferences Table | Easy | Store user toggles |
| Settings UI | Medium | Toggle all notification types |
| Multiple Event Reminder Times | Easy | Add 30m, 1h, 1d options |
| Routine Reminders | Medium | New cron trigger |
| F1 Session Reminders | Easy | Use existing schedule data |
| F1 Results Notifications | Medium | Cron after sessions |
| F1 News Push | Easy | Cron + existing AI filter |
| Daily Agenda | Medium | Morning summary cron |

### Requires Additional Infrastructure ⚠️
| Component | Requirement | Notes |
|-----------|-------------|-------|
| F1 Live Race Updates | Real-time polling | Need OpenF1 WebSocket/polling during races |
| Real-time Event Changes | Supabase Realtime | Subscribe to calendar_events changes |

---

## Architecture

### Technology Stack

- **Push Notifications**: Capacitor Push Notifications (already installed)
- **Local Notifications**: Capacitor Local Notifications (to be added)
- **Backend**: Vercel Cron Jobs + Next.js API Routes (current)
- **Real-time**: Supabase Realtime for instant updates (planned)

### Current Notification Flow

```
Vercel Cron (every 15 min) → /api/notifications/triggers/* → Check conditions
                                        ↓
                              /api/notifications/send → APNs → Device
                                        ↓
                              Update DB (reminder_sent flag)
```

### F1 News Integration

The F1 news system already has AI filtering that classifies articles:
- `isInteresting: boolean` - AI determines if article is notable
- `isSpoiler: boolean` - AI detects result spoilers
- `category: 'race' | 'driver' | 'technical' | 'calendar' | 'other'`

**For notifications:** Add a cron job that:
1. Fetches `/api/f1/news`
2. Compares against last-notified article ID
3. Sends push for new `isInteresting: true` articles
4. Respects user's spoiler-free preference

---

## Notification Categories

### 1. Calendar & Events (`calendar`)

| Notification | Description | Default |
|-------------|-------------|---------|
| `event_reminder_15m` | 15 minutes before event | ON |
| `event_reminder_30m` | 30 minutes before event | OFF |
| `event_reminder_1h` | 1 hour before event | ON |
| `event_reminder_1d` | 1 day before event | OFF |
| `daily_agenda` | Morning summary of today's events | ON |
| `event_changed` | When an event is modified | ON |
| `event_cancelled` | When an event is cancelled | ON |
| `new_event_added` | When someone adds a family event | OFF |

### 2. Routines (`routines`)

| Notification | Description | Default |
|-------------|-------------|---------|
| `routine_start` | Time to start a routine | ON |
| `routine_complete` | Celebration when routine is done | ON |
| `streak_milestone` | Streak achievements (3, 7, 14, 30 days) | ON |
| `streak_at_risk` | Reminder if routine not started by usual time | OFF |
| `routine_skipped` | Alert if routine was skipped | OFF |

### 3. Chores & Tasks (`tasks`)

| Notification | Description | Default |
|-------------|-------------|---------|
| `task_assigned` | When a task is assigned to you | ON |
| `task_reminder` | Reminder for pending tasks | ON |
| `task_overdue` | Alert for overdue tasks | ON |
| `task_completed` | Congratulations on completion | OFF |
| `weekly_summary` | Weekly task summary | OFF |

### 4. Shopping (`shopping`)

| Notification | Description | Default |
|-------------|-------------|---------|
| `item_added` | When items are added to shopping list | OFF |
| `list_updated` | Shopping list has been updated | OFF |
| `low_stock_alert` | Pantry item running low | OFF |

### 5. Family & Rewards (`family`)

| Notification | Description | Default |
|-------------|-------------|---------|
| `birthday_reminder` | Family member birthday coming up | ON |
| `points_milestone` | Points achievements (10, 25, 50, 100) | ON |
| `reward_redeemed` | When a reward is redeemed | ON |
| `new_family_member` | New member joined the family | ON |

### 6. Bin Collection (`bins`)

| Notification | Description | Default |
|-------------|-------------|---------|
| `bin_reminder_evening` | Evening reminder (day before) | ON |
| `bin_reminder_morning` | Morning reminder (collection day) | OFF |

### 7. Formula 1 (`f1`)

> **Data Source:** Uses existing `/api/f1/schedule`, `/api/f1/standings`, and `/api/f1/news` APIs.
> The news API already has AI filtering (`isInteresting`, `isSpoiler`, `category`).

#### Session Reminders ✅ (Easy to implement)
Uses schedule data from OpenF1 API - session times are known in advance.

| Notification | Description | Default | Implementation |
|-------------|-------------|---------|----------------|
| `race_reminder_15m` | 15 minutes before race start | ON | Cron checks schedule |
| `race_reminder_30m` | 30 minutes before race start | OFF | Cron checks schedule |
| `race_reminder_1h` | 1 hour before race start | ON | Cron checks schedule |
| `race_reminder_1d` | 1 day before race | OFF | Daily cron |
| `quali_reminder` | Qualifying session starting | ON | Cron checks schedule |
| `sprint_reminder` | Sprint race starting | ON | Cron checks schedule |
| `fp1_reminder` | Free Practice 1 starting | OFF | Cron checks schedule |
| `fp2_reminder` | Free Practice 2 starting | OFF | Cron checks schedule |
| `fp3_reminder` | Free Practice 3 starting | OFF | Cron checks schedule |
| `race_week_start` | Race weekend begins (Thursday) | OFF | Daily cron |

#### Live Race Updates ⚠️ (Requires real-time infrastructure)
These require polling OpenF1's live timing API during races. Not currently implemented.

| Notification | Description | Default | Status |
|-------------|-------------|---------|--------|
| `lights_out` | Race has started | ON | **FUTURE** - needs live polling |
| `safety_car` | Safety car deployed | ON | **FUTURE** - needs live polling |
| `red_flag` | Red flag - race stopped | ON | **FUTURE** - needs live polling |
| `vsc_deployed` | Virtual safety car deployed | OFF | **FUTURE** - needs live polling |
| `race_resumed` | Race restarted after stoppage | ON | **FUTURE** - needs live polling |
| `fastest_lap` | New fastest lap set | OFF | **FUTURE** - needs live polling |
| `favorite_position_change` | Your driver gained/lost positions | ON | **FUTURE** - needs live polling |
| `favorite_pit_stop` | Your driver pitting | OFF | **FUTURE** - needs live polling |
| `dnf_alert` | Driver retirement (or favorite only) | OFF | **FUTURE** - needs live polling |
| `penalty_announced` | Penalty given during race | OFF | **FUTURE** - needs live polling |
| `drs_enabled` | DRS enabled | OFF | **FUTURE** - needs live polling |

> **To implement live updates:** Would need a worker process that polls OpenF1 API every 5-10 seconds during race hours. Could use Vercel Edge Functions with streaming, or a dedicated backend service.

#### Results ✅ (Medium - needs cron job)
Trigger cron ~2 hours after scheduled session end to fetch results.

| Notification | Description | Default | Implementation |
|-------------|-------------|---------|----------------|
| `race_result_podium` | Podium finishers (top 3) | ON | Post-race cron |
| `race_result_full` | Full race classification | OFF | Post-race cron |
| `quali_result` | Qualifying results / grid | ON | Post-quali cron |
| `sprint_result` | Sprint race results | ON | Post-sprint cron |
| `fastest_lap_award` | Who got fastest lap point | OFF | Post-race cron |
| `driver_of_the_day` | DOTD voting result | OFF | Manual/scraping needed |

#### Championship Standings ✅ (Included with results)
| Notification | Description | Default | Implementation |
|-------------|-------------|---------|----------------|
| `drivers_standings_update` | Drivers' championship changed | ON | After results cron |
| `constructors_standings_update` | Constructors' changed | OFF | After results cron |
| `championship_lead_change` | New championship leader | ON | Compare with stored data |
| `title_clinched` | Championship mathematically won | ON | Manual calculation |
| `title_fight_update` | Gap to leader changed significantly | OFF | Compare standings |
| `favorite_points_milestone` | Your driver hits points milestone | ON | After results cron |

#### Favorite Driver/Team Alerts
| Notification | Description | Default |
|-------------|-------------|---------|
| `favorite_race_finish` | Your driver's final position | ON |
| `favorite_podium` | Your driver on podium | ON |
| `favorite_win` | Your driver won! | ON |
| `favorite_pole` | Your driver got pole position | ON |
| `favorite_fastest_lap` | Your driver set fastest lap | ON |
| `favorite_dnf` | Your driver retired from race | ON |
| `favorite_penalty` | Your driver received penalty | OFF |
| `team_double_points` | Both team drivers scored | OFF |

#### News & Updates ✅ (Easy - uses existing AI filtering)
The `/api/f1/news` already classifies articles with AI. Add cron to push new interesting articles.

| Notification | Description | Default | AI Category |
|-------------|-------------|---------|-------------|
| `breaking_news` | Major F1 news stories | OFF | `isInteresting: true` |
| `driver_transfer` | Driver signing/leaving team | ON | `category: 'driver'` |
| `team_announcement` | Team personnel/sponsor news | OFF | `category: 'driver'` |
| `regulation_change` | Rule changes announced | OFF | `category: 'technical'` |
| `calendar_change` | Race added/removed/rescheduled | ON | `category: 'calendar'` |
| `contract_extension` | Driver contract renewed | OFF | `category: 'driver'` |

**Implementation:** Cron every 30 minutes:
1. Call `/api/f1/news` to get latest articles
2. Check `f1_news_notifications` table for last notified article ID
3. For each new article where `isInteresting: true`:
   - Check if user has that category enabled
   - Check if user has spoiler-free mode AND article `isSpoiler: true` → skip
   - Send push notification
4. Update last notified article ID

#### Pre-Race Intel
| Notification | Description | Default |
|-------------|-------------|---------|
| `grid_confirmed` | Starting grid after qualifying | OFF |
| `weather_alert` | Rain expected during session | ON |
| `tire_strategy_preview` | Expected strategies | OFF |
| `track_conditions` | Track temperature/grip updates | OFF |

### 8. System (`system`)

| Notification | Description | Default |
|-------------|-------------|---------|
| `daily_digest` | Combined daily summary | OFF |
| `weekly_recap` | Weekly family activity summary | OFF |
| `app_updates` | Important app updates | ON |

---

## Database Schema

### New Tables

```sql
-- User notification preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,  -- e.g., 'calendar', 'routines', 'tasks'
  notification_type TEXT NOT NULL,  -- e.g., 'event_reminder_15m'
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, notification_type)
);

-- Device tokens for push notifications
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Notification history/log
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,  -- Additional payload data
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled notifications (for event reminders, etc.)
CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  reference_id UUID,  -- event_id, routine_id, etc.
  reference_type TEXT,  -- 'event', 'routine', 'chore'
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, reference_id, notification_type, scheduled_for)
);

-- RLS Policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users own preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own tokens" ON device_tokens
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own logs" ON notification_log
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own scheduled" ON scheduled_notifications
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_scheduled_notifications_pending
  ON scheduled_notifications(scheduled_for)
  WHERE status = 'pending';

CREATE INDEX idx_device_tokens_active
  ON device_tokens(user_id)
  WHERE is_active = true;
```

---

## Settings UI Design

### Main Settings Page (`/settings`)

```
Notifications
├── 📅 Calendar & Events
│   ├── [Toggle] Enable calendar notifications
│   └── [→] Customize...
├── 📋 Routines
│   ├── [Toggle] Enable routine notifications
│   └── [→] Customize...
├── ✅ Chores & Tasks
│   ├── [Toggle] Enable task notifications
│   └── [→] Customize...
├── 🛒 Shopping
│   ├── [Toggle] Enable shopping notifications
│   └── [→] Customize...
├── 👨‍👩‍👧‍👦 Family & Rewards
│   ├── [Toggle] Enable family notifications
│   └── [→] Customize...
├── 🗑️ Bin Collection
│   ├── [Toggle] Enable bin reminders
│   └── [→] Customize...
├── 🏎️ Formula 1
│   ├── [Toggle] Enable F1 notifications
│   └── [→] Customize...
└── ⚙️ System
    ├── [Toggle] Daily digest
    └── [Toggle] Weekly recap
```

### F1 Category Detail Page (`/settings/notifications/f1`)

```
Formula 1 Notifications

Master Toggle: [ON/OFF]

Favorite Driver: [Dropdown: Select driver]
Favorite Team: [Dropdown: Select constructor]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Session Reminders
├── Race Start
│   ├── [Toggle] 15 minutes before
│   ├── [Toggle] 30 minutes before
│   ├── [Toggle] 1 hour before
│   └── [Toggle] 1 day before
├── [Toggle] Qualifying reminder
├── [Toggle] Sprint race reminder
├── Practice Sessions
│   ├── [Toggle] FP1
│   ├── [Toggle] FP2
│   └── [Toggle] FP3
└── [Toggle] Race weekend starting

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Live Race Updates
├── [Toggle] Lights out (race started)
├── [Toggle] Safety car deployed
├── [Toggle] Red flag
├── [Toggle] Virtual safety car
├── [Toggle] Race restarted
├── [Toggle] Fastest lap set
├── [Toggle] Your driver position changes
├── [Toggle] Your driver pit stops
├── [Toggle] DNF alerts
├── [Toggle] Penalties announced
└── [Toggle] DRS enabled

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Results
├── [Toggle] Race podium (top 3)
├── [Toggle] Full race classification
├── [Toggle] Qualifying results
├── [Toggle] Sprint results
├── [Toggle] Fastest lap award
└── [Toggle] Driver of the Day

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Championship
├── [Toggle] Drivers' standings update
├── [Toggle] Constructors' standings update
├── [Toggle] Championship lead change
├── [Toggle] Title clinched
├── [Toggle] Title fight updates
└── [Toggle] Your driver points milestone

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your Driver/Team Alerts
├── [Toggle] Race finish position
├── [Toggle] Podium finish
├── [Toggle] Race win
├── [Toggle] Pole position
├── [Toggle] Fastest lap
├── [Toggle] DNF/retirement
├── [Toggle] Penalty received
└── [Toggle] Team double points

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

News & Updates
├── [Toggle] Breaking F1 news
├── [Toggle] Driver transfers
├── [Toggle] Team announcements
├── [Toggle] Regulation changes
├── [Toggle] Calendar changes
└── [Toggle] Contract extensions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pre-Race Intel
├── [Toggle] Starting grid confirmed
├── [Toggle] Weather alerts
├── [Toggle] Tire strategy preview
└── [Toggle] Track conditions
```

### Category Detail Page (e.g., `/settings/notifications/calendar`)

```
Calendar Notifications

Master Toggle: [ON/OFF]

Event Reminders
├── [Toggle] 15 minutes before
├── [Toggle] 30 minutes before
├── [Toggle] 1 hour before
└── [Toggle] 1 day before

Daily Summary
└── [Toggle] Morning agenda (8:00 AM)

Changes
├── [Toggle] Event modified
├── [Toggle] Event cancelled
└── [Toggle] New event added

[Quiet Hours]
├── Start: [22:00]
└── End: [07:00]
```

---

## Implementation Files

### New Files to Create

```
lib/
├── notifications/
│   ├── index.ts              # Main notification service
│   ├── types.ts              # TypeScript types
│   ├── preferences.ts        # Preference management
│   ├── push.ts               # Push notification helpers
│   ├── local.ts              # Local notification helpers
│   └── scheduler.ts          # Scheduling logic

components/
├── notifications/
│   ├── NotificationSettings.tsx    # Main settings UI
│   ├── CategorySettings.tsx        # Per-category settings
│   ├── NotificationToggle.tsx      # Reusable toggle component
│   └── QuietHours.tsx              # Quiet hours selector

app/
├── settings/
│   └── notifications/
│       ├── page.tsx                # Main notifications settings
│       └── [category]/
│           └── page.tsx            # Category-specific settings

supabase/
├── migrations/
│   └── 015_notifications.sql       # Database schema
└── functions/
    ├── send-notification/          # Edge function to send push
    ├── process-scheduled/          # Cron job for scheduled notifications
    └── create-event-reminders/     # Trigger on event creation
```

### Context Provider

```typescript
// lib/notifications/context.tsx
interface NotificationContextValue {
  preferences: NotificationPreferences;
  updatePreference: (category: string, type: string, enabled: boolean) => Promise<void>;
  toggleCategory: (category: string, enabled: boolean) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  hasPermission: boolean;
  deviceToken: string | null;
}
```

---

## Edge Functions

### 1. Send Notification (`send-notification`)

Receives a notification request and sends to appropriate push service.

```typescript
// Input
{
  user_id: string;
  title: string;
  body: string;
  category: string;
  notification_type: string;
  data?: Record<string, any>;
}
```

### 2. Process Scheduled Notifications (`process-scheduled`)

Runs every minute via Supabase Cron to process pending notifications.

```sql
SELECT cron.schedule(
  'process-scheduled-notifications',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://[project-ref].supabase.co/functions/v1/process-scheduled',
    headers := '{"Authorization": "Bearer [service-role-key]"}'
  );
  $$
);
```

### 3. Create Event Reminders (`create-event-reminders`)

Database trigger that creates scheduled notifications when events are created/updated.

```sql
CREATE OR REPLACE FUNCTION create_event_reminders()
RETURNS TRIGGER AS $$
BEGIN
  -- Create reminder notifications based on user preferences
  -- (15min, 30min, 1hr, 1day before event)
  ...
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_event_created
  AFTER INSERT ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION create_event_reminders();
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Add Capacitor Local Notifications package
- [ ] Create database migration (015_notifications.sql)
- [ ] Implement NotificationContext provider
- [ ] Create notification preference service
- [ ] Build main settings UI

### Phase 2: Push Infrastructure (Week 2)
- [ ] Set up APNs certificates in Apple Developer Portal
- [ ] Configure Supabase for push notifications
- [ ] Implement device token registration
- [ ] Create send-notification Edge Function
- [ ] Test basic push delivery

### Phase 3: Scheduled Notifications (Week 3)
- [ ] Implement scheduled_notifications table
- [ ] Create process-scheduled Edge Function
- [ ] Set up Supabase Cron job
- [ ] Add event reminder triggers
- [ ] Add routine reminder triggers

### Phase 4: Category Implementation (Week 4-5)
- [ ] Calendar notifications (event reminders, daily agenda)
- [ ] Routine notifications (start time, completion, streaks)
- [ ] Task notifications (assigned, overdue, completed)
- [ ] Family notifications (birthdays, milestones)
- [ ] F1 notifications (session reminders, results, championship updates)
- [ ] Bin collection reminders

### Phase 5: Polish (Week 5)
- [ ] Quiet hours implementation
- [ ] Notification history/log UI
- [ ] Daily/weekly digest compilation
- [ ] Performance optimization
- [ ] Testing across devices

---

## Capacitor Configuration

### Required Packages

```bash
npm install @capacitor/local-notifications
npx cap sync
```

### iOS Configuration (Info.plist additions)

```xml
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

### Permission Request Flow

1. App opens → Check if permission granted
2. If not granted → Show onboarding modal explaining benefits
3. User taps "Enable" → Request system permission
4. On success → Register device token with Supabase
5. On failure → Show settings link to enable later

---

## Sample Notification Payloads

### Event Reminder
```json
{
  "title": "📅 Event in 15 minutes",
  "body": "Olivia's Playgroup at Community Centre",
  "data": {
    "type": "event_reminder",
    "event_id": "abc123",
    "deep_link": "/calendar?event=abc123"
  }
}
```

### Routine Start
```json
{
  "title": "☀️ Morning Routine Time!",
  "body": "Time to start the morning routine with Olivia & Ellie",
  "data": {
    "type": "routine_start",
    "routine_id": "def456",
    "deep_link": "/routines"
  }
}
```

### Streak Milestone
```json
{
  "title": "🔥 7 Day Streak!",
  "body": "Olivia completed her bedtime routine 7 days in a row!",
  "data": {
    "type": "streak_milestone",
    "member_id": "ghi789",
    "streak": 7,
    "deep_link": "/family/ghi789"
  }
}
```

### Bin Reminder
```json
{
  "title": "🗑️ Bin Day Tomorrow",
  "body": "Put out: General Waste, Recycling",
  "data": {
    "type": "bin_reminder",
    "bins": ["general", "recycling"],
    "deep_link": "/dashboard"
  }
}
```

### F1 Race Reminder
```json
{
  "title": "🏎️ Race in 15 minutes!",
  "body": "Monaco Grand Prix starts at 14:00",
  "data": {
    "type": "race_reminder",
    "race_id": "monaco-2024",
    "session": "race",
    "deep_link": "/f1"
  }
}
```

### F1 Lights Out
```json
{
  "title": "🚦 LIGHTS OUT!",
  "body": "Monaco Grand Prix has started!",
  "data": {
    "type": "lights_out",
    "race_id": "monaco-2024",
    "deep_link": "/f1"
  }
}
```

### F1 Safety Car
```json
{
  "title": "🟡 Safety Car Deployed",
  "body": "Monaco GP - Safety car on track (Lap 23)",
  "data": {
    "type": "safety_car",
    "race_id": "monaco-2024",
    "lap": 23,
    "deep_link": "/f1"
  }
}
```

### F1 Red Flag
```json
{
  "title": "🔴 RED FLAG",
  "body": "Monaco GP stopped - Incident at Turn 1",
  "data": {
    "type": "red_flag",
    "race_id": "monaco-2024",
    "lap": 45,
    "reason": "Incident at Turn 1",
    "deep_link": "/f1"
  }
}
```

### F1 Favorite Driver Position Change
```json
{
  "title": "⬆️ Verstappen P3 → P2!",
  "body": "Max overtook Hamilton for P2 on Lap 34",
  "data": {
    "type": "position_change",
    "driver": "verstappen",
    "from_position": 3,
    "to_position": 2,
    "lap": 34,
    "deep_link": "/f1"
  }
}
```

### F1 Race Result
```json
{
  "title": "🏆 Monaco GP Results",
  "body": "1. Verstappen 2. Leclerc 3. Norris",
  "data": {
    "type": "race_result",
    "race_id": "monaco-2024",
    "podium": ["verstappen", "leclerc", "norris"],
    "deep_link": "/f1"
  }
}
```

### F1 Favorite Driver Win
```json
{
  "title": "🏆🎉 VERSTAPPEN WINS!",
  "body": "Max wins the Monaco Grand Prix! +25 points",
  "data": {
    "type": "favorite_win",
    "driver": "verstappen",
    "race": "Monaco Grand Prix",
    "points": 25,
    "deep_link": "/f1"
  }
}
```

### F1 Championship Update
```json
{
  "title": "📊 Championship Update",
  "body": "Verstappen extends lead to 45 points over Norris",
  "data": {
    "type": "championship_update",
    "leader": "verstappen",
    "gap": 45,
    "second": "norris",
    "deep_link": "/f1"
  }
}
```

### F1 Qualifying Result
```json
{
  "title": "🏁 Monaco GP Qualifying",
  "body": "POLE: Leclerc 1:10.270 | Verstappen P2 | Norris P3",
  "data": {
    "type": "quali_result",
    "race_id": "monaco-2024",
    "pole": "leclerc",
    "pole_time": "1:10.270",
    "grid": ["leclerc", "verstappen", "norris"],
    "deep_link": "/f1"
  }
}
```

### F1 Weather Alert
```json
{
  "title": "🌧️ Rain Expected",
  "body": "Monaco GP: 70% chance of rain during the race",
  "data": {
    "type": "weather_alert",
    "race_id": "monaco-2024",
    "condition": "rain",
    "probability": 70,
    "deep_link": "/f1"
  }
}
```

### F1 Driver Transfer
```json
{
  "title": "📢 Driver Announcement",
  "body": "Hamilton to join Ferrari for 2025 season!",
  "data": {
    "type": "driver_transfer",
    "driver": "hamilton",
    "from_team": "mercedes",
    "to_team": "ferrari",
    "season": 2025,
    "deep_link": "/f1"
  }
}
```

### F1 Title Clinched
```json
{
  "title": "👑 WORLD CHAMPION!",
  "body": "Max Verstappen wins the 2024 Drivers' Championship!",
  "data": {
    "type": "title_clinched",
    "driver": "verstappen",
    "championship": "drivers",
    "year": 2024,
    "deep_link": "/f1"
  }
}
```

---

## Testing Strategy

### Unit Tests
- Preference loading/saving
- Notification scheduling logic
- Payload formatting

### Integration Tests
- Push notification delivery
- Scheduled notification processing
- Database trigger execution

### Manual Testing Checklist
- [ ] Permission request flow (first launch)
- [ ] Permission denied handling
- [ ] Background notification delivery
- [ ] Notification tap → deep link navigation
- [ ] Quiet hours respect
- [ ] Category toggle (disable all in category)
- [ ] Notification history accuracy

---

## Security Considerations

1. **Token Security**: Device tokens stored encrypted, never exposed to clients
2. **Rate Limiting**: Max 50 notifications per user per day
3. **Spam Prevention**: Minimum 5-minute gap between similar notifications
4. **Privacy**: All notification processing happens in user's Supabase instance
5. **Revocation**: Users can revoke all permissions and delete notification history

---

## Future Enhancements

1. **Smart Notifications**: AI-powered notification timing based on user patterns
2. **Location-Based**: "You're near the shops" shopping reminders
3. **Family Coordination**: "Dad already marked this complete"
4. **Watch Support**: Apple Watch companion notifications
5. **Widgets**: iOS widgets showing next notification/event
