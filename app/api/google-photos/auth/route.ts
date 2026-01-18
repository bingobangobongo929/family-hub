import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateOAuthState, getSecureRedirectUri } from '@/lib/oauth-state'

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = getSecureRedirectUri('/api/google-photos/callback')

// Google Photos API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary',
  'openid',
  'email',
]

// Generate OAuth URL for Google Photos
export async function GET(request: NextRequest) {
  // Get authenticated user from middleware
  const authenticatedUserId = request.headers.get('x-authenticated-user-id')
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')
  const userId = authenticatedUserId || searchParams.get('user_id')

  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Google Photos not configured' },
      { status: 500 }
    )
  }

  if (action === 'url') {
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }

    // Generate secure signed state token (prevents CSRF)
    const state = await generateOAuthState(userId, 'google_photos')

    // Generate authorization URL with signed state parameter
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI!,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state, // Signed JWT containing user ID and nonce
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    return NextResponse.json({ url: authUrl })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// Disconnect Google Photos
export async function DELETE(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Get authenticated user from middleware
    const authenticatedUserId = request.headers.get('x-authenticated-user-id')
    const body = await request.json()
    const { user_id: bodyUserId } = body
    const user_id = authenticatedUserId || bodyUserId

    if (!user_id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Remove Google Photos connection
    await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', user_id)
      .eq('provider', 'google_photos')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting Google Photos:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
