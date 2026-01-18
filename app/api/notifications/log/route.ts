import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side API for notification log operations
// Uses service role key to bypass RLS

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const category = searchParams.get('category')

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 })
    }

    let query = supabase
      .from('notification_log')
      .select('*')
      .eq('user_id', user_id)
      .neq('status', 'dismissed')
      .order('sent_at', { ascending: false })
      .limit(50)

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      console.error('[NOTIFICATION API] GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch notifications', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })

  } catch (error) {
    console.error('[NOTIFICATION API] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await request.json()
    const { action, id, user_id } = body

    if (action === 'mark_read' && id) {
      // Mark single notification as read
      const { error } = await supabase
        .from('notification_log')
        .update({ status: 'read' })
        .eq('id', id)

      if (error) {
        console.error('[NOTIFICATION API] Mark read error:', error)
        return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
      }

      return NextResponse.json({ success: true })

    } else if (action === 'mark_all_read' && user_id) {
      // Mark all user's notifications as read
      const { error } = await supabase
        .from('notification_log')
        .update({ status: 'read' })
        .eq('user_id', user_id)
        .eq('status', 'sent')

      if (error) {
        console.error('[NOTIFICATION API] Mark all read error:', error)
        return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 })
      }

      return NextResponse.json({ success: true })

    } else if (action === 'dismiss' && id) {
      // Dismiss a notification
      const { error } = await supabase
        .from('notification_log')
        .update({ status: 'dismissed' })
        .eq('id', id)

      if (error) {
        console.error('[NOTIFICATION API] Dismiss error:', error)
        return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('[NOTIFICATION API] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
