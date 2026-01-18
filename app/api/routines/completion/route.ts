import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side API for routine completions
// Uses service role key to bypass RLS (family sharing model)

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  // Use service role key to bypass RLS
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { searchParams } = new URL(request.url)
    const completed_date = searchParams.get('completed_date')

    if (!completed_date) {
      return NextResponse.json({ error: 'Missing completed_date parameter' }, { status: 400 })
    }

    // Get all completions for the date
    const { data, error } = await supabase
      .from('routine_completions')
      .select('step_id, member_id')
      .eq('completed_date', completed_date)

    if (error) {
      console.error('[COMPLETION API] GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch completions', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })

  } catch (error) {
    console.error('[COMPLETION API] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  // Use service role key to bypass RLS
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { routine_id, step_id, member_id, completed_date } = await request.json()

    if (!routine_id || !step_id || !member_id || !completed_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Upsert the completion
    const { data, error } = await supabase
      .from('routine_completions')
      .upsert({
        routine_id,
        step_id,
        member_id,
        completed_date
      }, { onConflict: 'routine_id,step_id,member_id,completed_date' })
      .select()

    if (error) {
      console.error('[COMPLETION API] Upsert error:', error)
      return NextResponse.json({ error: 'Failed to save completion', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error('[COMPLETION API] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  // Use service role key to bypass RLS
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { step_id, member_id, completed_date } = await request.json()

    if (!step_id || !member_id || !completed_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Delete the completion
    const { error } = await supabase
      .from('routine_completions')
      .delete()
      .eq('step_id', step_id)
      .eq('member_id', member_id)
      .eq('completed_date', completed_date)

    if (error) {
      console.error('[COMPLETION API] Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete completion', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[COMPLETION API] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
