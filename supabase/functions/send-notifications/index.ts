// Supabase Edge Function: send-notifications
// Runs on a schedule to send push notifications for routines, events, tasks, birthdays

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v4.14.4/index.ts'

// APNs configuration from environment
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID')!
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID')!
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY')!
const BUNDLE_ID = 'app.familyhub.home'
const APNS_HOST = 'https://api.push.apple.com' // Production

// Supabase client with service role
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Generate APNs JWT token
async function getApnsToken(): Promise<string> {
  const privateKey = await importPKCS8(APNS_PRIVATE_KEY, 'ES256')

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: APNS_KEY_ID })
    .setIssuer(APNS_TEAM_ID)
    .setIssuedAt()
    .sign(privateKey)

  return token
}

// Send notification via APNs
async function sendApnsNotification(
  token: string,
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<boolean> {
  try {
    const response = await fetch(
      `${APNS_HOST}/3/device/${deviceToken}`,
      {
        method: 'POST',
        headers: {
          'authorization': `bearer ${token}`,
          'apns-topic': BUNDLE_ID,
          'apns-push-type': 'alert',
          'apns-priority': '10',
        },
        body: JSON.stringify({
          aps: {
            alert: { title, body },
            sound: 'default',
            badge: 1,
          },
          ...data,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error(`APNs error for ${deviceToken}:`, error)
      return false
    }

    return true
  } catch (error) {
    console.error(`Failed to send to ${deviceToken}:`, error)
    return false
  }
}

// Log notification to database
async function logNotification(
  userId: string,
  category: string,
  notificationType: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  status: 'sent' | 'failed',
  errorMessage?: string
) {
  await supabase.from('notification_log').insert({
    user_id: userId,
    category,
    notification_type: notificationType,
    title,
    body,
    data,
    status,
    error_message: errorMessage,
  })
}

// Get all push tokens for a user
async function getUserTokens(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)

  return data?.map(t => t.token) || []
}

// Check if notification was already sent (to prevent duplicates)
async function wasNotificationSent(
  userId: string,
  category: string,
  notificationType: string,
  referenceId: string,
  withinHours: number = 24
): Promise<boolean> {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - withinHours)

  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('category', category)
    .eq('notification_type', notificationType)
    .contains('data', { reference_id: referenceId })
    .gte('sent_at', cutoff.toISOString())
    .limit(1)

  return (data?.length || 0) > 0
}

// ============================================
// ROUTINE NOTIFICATIONS
// ============================================
async function checkRoutineNotifications(apnsToken: string) {
  const now = new Date()
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM
  const dayOfWeek = now.getDay() // 0 = Sunday

  // Find routines scheduled within the next 5 minutes
  const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000)
  const laterTime = fiveMinLater.toTimeString().slice(0, 5)

  // Get routines that should trigger now
  const { data: routines } = await supabase
    .from('routines')
    .select(`
      id, title, emoji, type, scheduled_time, schedule_type, schedule_days, user_id,
      reminder_enabled, last_reminder_sent
    `)
    .eq('is_active', true)
    .eq('reminder_enabled', true)
    .gte('scheduled_time', currentTime)
    .lte('scheduled_time', laterTime)

  if (!routines?.length) return

  for (const routine of routines) {
    // Check if routine applies today
    const scheduleType = routine.schedule_type || 'daily'
    let appliesToday = true

    if (scheduleType === 'weekdays') {
      appliesToday = dayOfWeek >= 1 && dayOfWeek <= 5
    } else if (scheduleType === 'weekends') {
      appliesToday = dayOfWeek === 0 || dayOfWeek === 6
    } else if (scheduleType === 'custom' && routine.schedule_days) {
      appliesToday = routine.schedule_days.includes(dayOfWeek)
    }

    if (!appliesToday) continue

    // Check if already sent today
    const today = now.toISOString().split('T')[0]
    if (routine.last_reminder_sent?.startsWith(today)) continue

    // Get user's notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('routines_enabled, routine_start_reminder')
      .eq('user_id', routine.user_id)
      .single()

    if (prefs && (!prefs.routines_enabled || !prefs.routine_start_reminder)) continue

    // Get push tokens
    const tokens = await getUserTokens(routine.user_id)
    if (!tokens.length) continue

    // Send notification
    const title = `${routine.emoji} ${routine.title}`
    const body = routine.type === 'morning'
      ? "Time to start the morning routine!"
      : routine.type === 'evening'
      ? "Time for the bedtime routine!"
      : "Time to start the routine!"

    for (const deviceToken of tokens) {
      const success = await sendApnsNotification(
        apnsToken,
        deviceToken,
        title,
        body,
        { type: 'routine_reminder', routine_id: routine.id, deep_link: '/routines' }
      )

      await logNotification(
        routine.user_id,
        'routine',
        'routine_reminder',
        title,
        body,
        { reference_id: routine.id },
        success ? 'sent' : 'failed'
      )
    }

    // Update last_reminder_sent
    await supabase
      .from('routines')
      .update({ last_reminder_sent: now.toISOString() })
      .eq('id', routine.id)
  }
}

// ============================================
// CALENDAR EVENT NOTIFICATIONS
// ============================================
async function checkCalendarNotifications(apnsToken: string) {
  const now = new Date()

  // Time windows for reminders
  const windows = [
    { minutes: 15, field: 'reminder_15m_sent', prefField: 'calendar_reminder_15m' },
    { minutes: 30, field: 'reminder_30m_sent', prefField: 'calendar_reminder_30m' },
    { minutes: 60, field: 'reminder_1h_sent', prefField: 'calendar_reminder_1h' },
  ]

  for (const window of windows) {
    const targetTime = new Date(now.getTime() + window.minutes * 60 * 1000)
    const windowStart = new Date(targetTime.getTime() - 2.5 * 60 * 1000) // 2.5 min before
    const windowEnd = new Date(targetTime.getTime() + 2.5 * 60 * 1000) // 2.5 min after

    const { data: events } = await supabase
      .from('calendar_events')
      .select('id, title, start_time, user_id, category')
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', windowEnd.toISOString())
      .is(window.field, null)

    if (!events?.length) continue

    for (const event of events) {
      // Check preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select(`calendar_enabled, ${window.prefField}`)
        .eq('user_id', event.user_id)
        .single()

      const prefValue = prefs?.[window.prefField as keyof typeof prefs]
      if (prefs && (!prefs.calendar_enabled || prefValue === false)) continue

      const tokens = await getUserTokens(event.user_id)
      if (!tokens.length) continue

      const title = `📅 ${event.title}`
      const body = window.minutes >= 60
        ? `Starting in ${window.minutes / 60} hour`
        : `Starting in ${window.minutes} minutes`

      for (const deviceToken of tokens) {
        const success = await sendApnsNotification(
          apnsToken,
          deviceToken,
          title,
          body,
          { type: 'event_reminder', event_id: event.id, deep_link: '/calendar' }
        )

        await logNotification(
          event.user_id,
          'calendar',
          'event_reminder',
          title,
          body,
          { reference_id: event.id, minutes_before: window.minutes },
          success ? 'sent' : 'failed'
        )
      }

      // Mark as sent
      await supabase
        .from('calendar_events')
        .update({ [window.field]: now.toISOString() })
        .eq('id', event.id)
    }
  }
}

// ============================================
// TASK DUE DATE NOTIFICATIONS
// ============================================
async function checkTaskNotifications(apnsToken: string) {
  const now = new Date()
  const hour = now.getHours()

  // Only send task reminders at 8 AM
  if (hour !== 8) return

  const today = now.toISOString().split('T')[0]

  // Get tasks due today that haven't been notified
  const { data: tasks } = await supabase
    .from('chores')
    .select('id, title, due_date, user_id, status')
    .eq('due_date', today)
    .eq('status', 'pending')

  if (!tasks?.length) return

  for (const task of tasks) {
    // Check if already notified today
    if (await wasNotificationSent(task.user_id, 'task', 'task_due', task.id, 12)) continue

    // Check preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('tasks_enabled, task_reminder')
      .eq('user_id', task.user_id)
      .single()

    if (prefs && (!prefs.tasks_enabled || !prefs.task_reminder)) continue

    const tokens = await getUserTokens(task.user_id)
    if (!tokens.length) continue

    const title = '📋 Task due today'
    const body = task.title

    for (const deviceToken of tokens) {
      const success = await sendApnsNotification(
        apnsToken,
        deviceToken,
        title,
        body,
        { type: 'task_reminder', task_id: task.id, deep_link: '/tasks' }
      )

      await logNotification(
        task.user_id,
        'task',
        'task_due',
        title,
        body,
        { reference_id: task.id },
        success ? 'sent' : 'failed'
      )
    }
  }
}

// ============================================
// BIRTHDAY NOTIFICATIONS
// ============================================
async function checkBirthdayNotifications(apnsToken: string) {
  const now = new Date()
  const hour = now.getHours()

  // Send birthday reminders at 9 AM
  if (hour !== 9) return

  // Get dates for 3-day and same-day reminders
  const today = now.toISOString().split('T')[0]
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const threeDaysDate = inThreeDays.toISOString().split('T')[0]

  // Get family members with upcoming birthdays
  const { data: members } = await supabase
    .from('family_members')
    .select('id, name, birthday, user_id')
    .not('birthday', 'is', null)

  if (!members?.length) return

  // Get contacts with upcoming birthdays
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, display_name, name, birthday, user_id')
    .not('birthday', 'is', null)

  const allBirthdays = [
    ...(members || []).map(m => ({ ...m, type: 'family' })),
    ...(contacts || []).map(c => ({
      ...c,
      name: c.display_name || c.name,
      type: 'contact'
    })),
  ]

  for (const person of allBirthdays) {
    if (!person.birthday) continue

    // Extract month-day from birthday
    const birthdayMonth = person.birthday.slice(5, 7)
    const birthdayDay = person.birthday.slice(8, 10)
    const todayMonth = today.slice(5, 7)
    const todayDay = today.slice(8, 10)
    const threeDaysMonth = threeDaysDate.slice(5, 7)
    const threeDaysDay = threeDaysDate.slice(8, 10)

    const isBirthdayToday = birthdayMonth === todayMonth && birthdayDay === todayDay
    const isBirthdayIn3Days = birthdayMonth === threeDaysMonth && birthdayDay === threeDaysDay

    if (!isBirthdayToday && !isBirthdayIn3Days) continue

    const notifType = isBirthdayToday ? 'birthday_today' : 'birthday_upcoming'

    // Check if already notified
    if (await wasNotificationSent(person.user_id, 'birthday', notifType, person.id, 24)) continue

    // Check preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('family_enabled, birthday_reminder')
      .eq('user_id', person.user_id)
      .single()

    if (prefs && (!prefs.family_enabled || !prefs.birthday_reminder)) continue

    const tokens = await getUserTokens(person.user_id)
    if (!tokens.length) continue

    const title = isBirthdayToday
      ? `🎂 ${person.name}'s birthday is today!`
      : `🎂 ${person.name}'s birthday in 3 days!`
    const body = isBirthdayToday
      ? "Don't forget to wish them a happy birthday!"
      : "Time to plan something special?"

    for (const deviceToken of tokens) {
      const success = await sendApnsNotification(
        apnsToken,
        deviceToken,
        title,
        body,
        { type: 'birthday_reminder', person_id: person.id, deep_link: '/contacts' }
      )

      await logNotification(
        person.user_id,
        'birthday',
        notifType,
        title,
        body,
        { reference_id: person.id },
        success ? 'sent' : 'failed'
      )
    }
  }
}

// ============================================
// F1 SESSION NOTIFICATIONS
// ============================================
async function checkF1Notifications(apnsToken: string) {
  const now = new Date()

  // Get all users who want F1 notifications
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, f1_enabled, f1_race_reminder_15m, f1_race_reminder_1h, f1_quali_reminder, f1_sprint_reminder')
    .eq('f1_enabled', true)

  if (!prefs?.length) return

  // Fetch upcoming F1 sessions from OpenF1 API
  try {
    const response = await fetch('https://api.openf1.org/v1/sessions?session_key=latest')
    if (!response.ok) return

    const sessions = await response.json()
    if (!sessions?.length) return

    const session = sessions[0]
    const sessionStart = new Date(session.date_start)
    const minutesUntil = (sessionStart.getTime() - now.getTime()) / (1000 * 60)

    // Check if session starts within reminder windows
    let reminderType: string | null = null

    if (minutesUntil > 12 && minutesUntil <= 17) {
      reminderType = '15m'
    } else if (minutesUntil > 55 && minutesUntil <= 65) {
      reminderType = '1h'
    }

    if (!reminderType) return

    for (const pref of prefs) {
      // Check specific preferences
      const sessionType = session.session_type?.toLowerCase() || ''

      if (sessionType.includes('race') && reminderType === '15m' && !pref.f1_race_reminder_15m) continue
      if (sessionType.includes('race') && reminderType === '1h' && !pref.f1_race_reminder_1h) continue
      if (sessionType.includes('quali') && !pref.f1_quali_reminder) continue
      if (sessionType.includes('sprint') && !pref.f1_sprint_reminder) continue

      // Check if already notified
      const notifId = `${session.session_key}-${reminderType}`
      if (await wasNotificationSent(pref.user_id, 'f1', 'session_reminder', notifId, 2)) continue

      const tokens = await getUserTokens(pref.user_id)
      if (!tokens.length) continue

      const emoji = sessionType.includes('race') ? '🏁' : sessionType.includes('quali') ? '🏎️' : '🏎️'
      const title = `${emoji} F1 ${session.session_name || session.session_type}`
      const body = reminderType === '15m'
        ? `Starting in 15 minutes at ${session.circuit_short_name}`
        : `Starting in 1 hour at ${session.circuit_short_name}`

      for (const deviceToken of tokens) {
        const success = await sendApnsNotification(
          apnsToken,
          deviceToken,
          title,
          body,
          { type: 'f1_session_reminder', session_key: session.session_key, deep_link: '/f1' }
        )

        await logNotification(
          pref.user_id,
          'f1',
          'session_reminder',
          title,
          body,
          { reference_id: notifId },
          success ? 'sent' : 'failed'
        )
      }
    }
  } catch (error) {
    console.error('F1 API error:', error)
  }
}

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {
  // Verify request is from Supabase cron or authorized source
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    // Also allow service role key for manual triggers
    if (authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  console.log('Starting notification check at', new Date().toISOString())

  try {
    // Get APNs token
    const apnsToken = await getApnsToken()

    // Run all notification checks in parallel
    await Promise.all([
      checkRoutineNotifications(apnsToken),
      checkCalendarNotifications(apnsToken),
      checkTaskNotifications(apnsToken),
      checkBirthdayNotifications(apnsToken),
      checkF1Notifications(apnsToken),
    ])

    console.log('Notification check completed')

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Notification check failed:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
