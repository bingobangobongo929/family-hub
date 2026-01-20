import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/tasks/[id] - Get single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Authenticate
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignee:family_members!tasks_assignee_id_fkey(id, name, color, avatar),
        creator:family_members!tasks_creator_id_fkey(id, name, color),
        category:task_categories(id, name, emoji, color),
        reminders:task_reminders(*)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Task GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/tasks/[id] - Update task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Authenticate
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Verify task belongs to user
    const { data: existing } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      description,
      assignee_id,
      category_id,
      due_date,
      due_time,
      due_context,
      urgency,
      status,
      snoozed_until,
      is_recurring,
      recurrence_rule,
      calendar_event_id,
    } = body

    // Build update object
    const updates: Record<string, any> = {}

    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (assignee_id !== undefined) updates.assignee_id = assignee_id
    if (category_id !== undefined) updates.category_id = category_id
    if (due_date !== undefined) updates.due_date = due_date
    if (due_time !== undefined) updates.due_time = due_time
    if (due_context !== undefined) updates.due_context = due_context
    if (urgency !== undefined) updates.urgency = urgency
    if (is_recurring !== undefined) updates.is_recurring = is_recurring
    if (recurrence_rule !== undefined) updates.recurrence_rule = recurrence_rule
    if (calendar_event_id !== undefined) updates.calendar_event_id = calendar_event_id

    // Handle status changes
    if (status !== undefined) {
      updates.status = status

      if (status === 'completed' && existing.status !== 'completed') {
        updates.completed_at = new Date().toISOString()
        // Cancel pending reminders
        await supabase
          .from('task_reminders')
          .update({ status: 'skipped' })
          .eq('task_id', id)
          .eq('status', 'pending')
      }

      if (status === 'archived' && existing.status !== 'archived') {
        updates.archived_at = new Date().toISOString()
        // Cancel pending reminders
        await supabase
          .from('task_reminders')
          .update({ status: 'skipped' })
          .eq('task_id', id)
          .eq('status', 'pending')
      }

      if (status === 'in_progress') {
        // Mark current pending reminders as acknowledged (user is working on it)
        await supabase
          .from('task_reminders')
          .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
          .eq('task_id', id)
          .eq('status', 'pending')
      }

      if (status === 'snoozed' && snoozed_until) {
        updates.snoozed_until = snoozed_until
        // Cancel current reminders and schedule new one
        await supabase
          .from('task_reminders')
          .update({ status: 'skipped' })
          .eq('task_id', id)
          .eq('status', 'pending')

        // Schedule snooze reminder
        await supabase
          .from('task_reminders')
          .insert({
            task_id: id,
            user_id: user.id,
            scheduled_for: snoozed_until,
            context_reason: 'Snoozed reminder',
            attempt_number: 1,
          })
      }
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        assignee:family_members!tasks_assignee_id_fkey(id, name, color, avatar),
        creator:family_members!tasks_creator_id_fkey(id, name, color),
        category:task_categories(id, name, emoji, color)
      `)
      .single()

    if (error) {
      console.error('Error updating task:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Task PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tasks/[id] - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Authenticate
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Delete task (cascade will handle reminders)
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting task:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Task DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
