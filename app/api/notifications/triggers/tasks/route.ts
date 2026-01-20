import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Task Reminder Notification Trigger
// Called by Vercel cron to send pending task reminders

interface TaskReminder {
  id: string
  task_id: string
  user_id: string
  scheduled_for: string
  context_reason: string
  attempt_number: number
  task: {
    id: string
    title: string
    description: string | null
    urgency: string
    status: string
    assignee: {
      id: string
      name: string
    } | null
    category: {
      name: string
      emoji: string
    } | null
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find all pending reminders that are due
    const now = new Date().toISOString()

    const { data: reminders, error: remindersError } = await supabase
      .from('task_reminders')
      .select(`
        id,
        task_id,
        user_id,
        scheduled_for,
        context_reason,
        attempt_number,
        task:tasks!inner(
          id,
          title,
          description,
          urgency,
          status,
          assignee:family_members!tasks_assignee_id_fkey(id, name),
          category:task_categories(name, emoji)
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(100) as { data: TaskReminder[] | null; error: any }

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError)
      return NextResponse.json({ error: remindersError.message }, { status: 500 })
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({
        message: 'No pending reminders',
        processed: 0,
        duration_ms: Date.now() - startTime,
      })
    }

    // Filter out reminders for tasks that are already completed/archived/in_progress
    const activeReminders = reminders.filter(r =>
      r.task?.status === 'pending' || r.task?.status === 'snoozed'
    )

    // Skip reminders for non-active tasks
    const skippedIds = reminders
      .filter(r => r.task?.status !== 'pending' && r.task?.status !== 'snoozed')
      .map(r => r.id)

    if (skippedIds.length > 0) {
      await supabase
        .from('task_reminders')
        .update({ status: 'skipped' })
        .in('id', skippedIds)
    }

    // Group reminders by user
    const remindersByUser = new Map<string, TaskReminder[]>()
    for (const reminder of activeReminders) {
      const existing = remindersByUser.get(reminder.user_id) || []
      existing.push(reminder)
      remindersByUser.set(reminder.user_id, existing)
    }

    let sent = 0
    let failed = 0

    // Process each user's reminders
    for (const [userId, userReminders] of remindersByUser) {
      // Check if user has task notifications enabled
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('tasks_enabled')
        .eq('user_id', userId)
        .single()

      if (!prefs?.tasks_enabled) {
        // Mark as skipped
        await supabase
          .from('task_reminders')
          .update({ status: 'skipped' })
          .in('id', userReminders.map(r => r.id))
        continue
      }

      // Get user's push tokens
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token, platform')
        .eq('user_id', userId)

      if (!tokens || tokens.length === 0) {
        // Mark as failed - no push token
        await supabase
          .from('task_reminders')
          .update({
            status: 'failed',
            error_message: 'No push token registered',
          })
          .in('id', userReminders.map(r => r.id))
        continue
      }

      // Send notifications for each reminder
      for (const reminder of userReminders) {
        const task = reminder.task
        const category = task.category
        const assignee = task.assignee

        // Build notification content
        let title = 'Task Reminder'
        let body = task.title

        // Add context based on attempt number
        if (reminder.attempt_number === 1) {
          title = category?.emoji
            ? `${category.emoji} ${reminder.context_reason || 'Task Reminder'}`
            : reminder.context_reason || 'Task Reminder'
        } else if (reminder.attempt_number === 2) {
          title = 'Still pending...'
          body = `Don't forget: ${task.title}`
        } else if (reminder.attempt_number >= 3) {
          title = 'Final reminder!'
          body = `${task.title} - Tap to mark done or snooze`
        }

        // Add assignee context if different from notification recipient
        if (assignee) {
          body = `${assignee.name}: ${body}`
        }

        // Add urgency indicator
        if (task.urgency === 'urgent') {
          title = '🚨 ' + title
        } else if (task.urgency === 'high') {
          title = '⚠️ ' + title
        }

        // Send via notification API
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        try {
          const response = await fetch(`${appUrl}/api/notifications/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-cron-secret': process.env.CRON_SECRET || '',
            },
            body: JSON.stringify({
              user_id: userId,
              title,
              body,
              data: {
                type: 'task_reminder',
                task_id: task.id,
                reminder_id: reminder.id,
                url: `/tasks?highlight=${task.id}`,
              },
            }),
          })

          if (response.ok) {
            // Mark as sent
            await supabase
              .from('task_reminders')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
              })
              .eq('id', reminder.id)

            // Log notification
            await supabase.from('notification_log').insert({
              user_id: userId,
              type: 'task_reminder',
              title,
              body,
              status: 'sent',
              metadata: { task_id: task.id, reminder_id: reminder.id },
            })

            sent++
          } else {
            const errorText = await response.text()
            await supabase
              .from('task_reminders')
              .update({
                status: 'failed',
                error_message: errorText.substring(0, 500),
              })
              .eq('id', reminder.id)
            failed++
          }
        } catch (error) {
          console.error('Error sending task notification:', error)
          await supabase
            .from('task_reminders')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('id', reminder.id)
          failed++
        }
      }
    }

    return NextResponse.json({
      message: 'Task reminders processed',
      total_found: reminders.length,
      active: activeReminders.length,
      skipped: skippedIds.length,
      sent,
      failed,
      duration_ms: Date.now() - startTime,
    })
  } catch (error) {
    console.error('Task reminder trigger error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
