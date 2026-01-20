import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/tasks - List tasks
export async function GET(request: NextRequest) {
  try {
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // pending, in_progress, completed, archived, snoozed
    const assignee_id = searchParams.get('assignee_id')
    const category_id = searchParams.get('category_id')
    const include_archived = searchParams.get('include_archived') === 'true'

    // Build query
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignee:family_members!tasks_assignee_id_fkey(id, name, color, avatar),
        creator:family_members!tasks_creator_id_fkey(id, name, color),
        category:task_categories(id, name, emoji, color)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    } else if (!include_archived) {
      // By default, exclude archived tasks
      query = query.neq('status', 'archived')
    }

    if (assignee_id) {
      query = query.eq('assignee_id', assignee_id)
    }

    if (category_id) {
      query = query.eq('category_id', category_id)
    }

    const { data: tasks, error } = await query

    if (error) {
      console.error('Error fetching tasks:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Tasks GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tasks - Create task
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const {
      title,
      description,
      raw_input,
      assignee_id,
      creator_id,
      category_id,
      category_name, // For creating new category on the fly
      due_date,
      due_time,
      due_context,
      urgency = 'normal',
      is_recurring = false,
      recurrence_rule,
      calendar_event_id,
      ai_parsed = false,
      ai_confidence,
    } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Handle category creation if category_name is provided but no category_id
    let finalCategoryId = category_id
    if (!finalCategoryId && category_name) {
      // Check if category already exists
      const { data: existingCategory } = await supabase
        .from('task_categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', category_name)
        .single()

      if (existingCategory) {
        finalCategoryId = existingCategory.id
      } else {
        // Create new category
        const { data: newCategory, error: catError } = await supabase
          .from('task_categories')
          .insert({
            user_id: user.id,
            name: category_name,
            emoji: getCategoryEmoji(category_name),
            color: getCategoryColor(category_name),
          })
          .select('id')
          .single()

        if (catError) {
          console.error('Error creating category:', catError)
        } else {
          finalCategoryId = newCategory.id
        }
      }
    }

    // Create task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description,
        raw_input,
        assignee_id,
        creator_id,
        category_id: finalCategoryId,
        due_date,
        due_time,
        due_context,
        urgency,
        is_recurring,
        recurrence_rule,
        calendar_event_id,
        ai_parsed,
        ai_confidence,
        ai_parsed_at: ai_parsed ? new Date().toISOString() : null,
      })
      .select(`
        *,
        assignee:family_members!tasks_assignee_id_fkey(id, name, color, avatar),
        creator:family_members!tasks_creator_id_fkey(id, name, color),
        category:task_categories(id, name, emoji, color)
      `)
      .single()

    if (taskError) {
      console.error('Error creating task:', taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 })
    }

    // Schedule smart reminders if due_date is set
    if (due_date) {
      await scheduleSmartReminders(supabase, task.id, user.id, due_date, due_time, due_context, task.created_at)
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Tasks POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper: Get category emoji based on name
function getCategoryEmoji(name: string): string {
  const emojiMap: Record<string, string> = {
    'Work': '💼',
    'Admin': '📋',
    'Finance': '💰',
    'Health': '🏥',
    'Home': '🏠',
    'Shopping': '🛒',
    'Kids': '👶',
    'Personal': '👤',
    'Errands': '🚗',
    'Other': '📌',
  }
  return emojiMap[name] || '📌'
}

// Helper: Get category color based on name
function getCategoryColor(name: string): string {
  const colorMap: Record<string, string> = {
    'Work': '#3b82f6',
    'Admin': '#6366f1',
    'Finance': '#10b981',
    'Health': '#ef4444',
    'Home': '#f59e0b',
    'Shopping': '#8b5cf6',
    'Kids': '#ec4899',
    'Personal': '#14b8a6',
    'Errands': '#f97316',
    'Other': '#6b7280',
  }
  return colorMap[name] || '#6366f1'
}

// Helper: Schedule smart reminders based on context
async function scheduleSmartReminders(
  supabase: any,
  taskId: string,
  userId: string,
  dueDate: string,
  dueTime: string | null,
  dueContext: string | null,
  createdAt: string
) {
  const created = new Date(createdAt)
  const createdDate = created.toISOString().split('T')[0]
  const dayOfWeek = created.getDay()
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

  const reminders: Array<{
    task_id: string
    user_id: string
    scheduled_for: string
    context_reason: string
    attempt_number: number
  }> = []

  // If task created on weekday (likely at work context), schedule work-aware reminders
  if (isWeekday && (!dueContext || !dueContext.toLowerCase().includes('weekend'))) {
    // Same-day reminders
    reminders.push({
      task_id: taskId,
      user_id: userId,
      scheduled_for: `${createdDate}T16:30:00`,
      context_reason: 'End of work day reminder',
      attempt_number: 1,
    })

    reminders.push({
      task_id: taskId,
      user_id: userId,
      scheduled_for: `${createdDate}T18:30:00`,
      context_reason: 'Evening follow-up',
      attempt_number: 2,
    })

    reminders.push({
      task_id: taskId,
      user_id: userId,
      scheduled_for: `${createdDate}T19:30:00`,
      context_reason: 'Final evening reminder',
      attempt_number: 3,
    })
  } else {
    // Weekend or explicit non-work context
    reminders.push({
      task_id: taskId,
      user_id: userId,
      scheduled_for: `${createdDate}T10:00:00`,
      context_reason: 'Morning reminder',
      attempt_number: 1,
    })

    reminders.push({
      task_id: taskId,
      user_id: userId,
      scheduled_for: `${createdDate}T15:00:00`,
      context_reason: 'Afternoon follow-up',
      attempt_number: 2,
    })
  }

  // If due date is different from created date, add day-before and morning-of reminders
  if (dueDate > createdDate) {
    const dayBefore = new Date(dueDate)
    dayBefore.setDate(dayBefore.getDate() - 1)
    const dayBeforeStr = dayBefore.toISOString().split('T')[0]

    reminders.push({
      task_id: taskId,
      user_id: userId,
      scheduled_for: `${dayBeforeStr}T20:00:00`,
      context_reason: 'Due tomorrow - evening reminder',
      attempt_number: 1,
    })

    reminders.push({
      task_id: taskId,
      user_id: userId,
      scheduled_for: `${dueDate}T09:00:00`,
      context_reason: 'Due today - morning reminder',
      attempt_number: 2,
    })
  }

  // Filter out reminders in the past
  const now = new Date()
  const validReminders = reminders.filter(r => new Date(r.scheduled_for) > now)

  if (validReminders.length > 0) {
    const { error } = await supabase
      .from('task_reminders')
      .insert(validReminders)

    if (error) {
      console.error('Error scheduling reminders:', error)
    }
  }
}
