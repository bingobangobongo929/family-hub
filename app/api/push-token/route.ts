import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Register push token via API (uses service role to bypass RLS issues)
export async function POST(request: NextRequest) {
  try {
    const { token, platform = 'ios' } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 })
    }

    // Verify the user token
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(
      authHeader.substring(7)
    )

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid auth' }, { status: 401 })
    }

    // Use service role to insert (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: user.id,
        token,
        platform,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,token',
      })

    if (error) {
      console.error('Push token insert error:', error)
      return NextResponse.json({ error: 'Failed to save token' }, { status: 500 })
    }

    return NextResponse.json({ success: true, user_id: user.id })
  } catch (error) {
    console.error('Push token error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
