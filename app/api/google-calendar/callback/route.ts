import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL + '/api/google-calendar/callback'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?google_error=${error}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings?google_error=no_code', request.url)
    )
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('Token exchange error:', error)
      return NextResponse.redirect(
        new URL('/settings?google_error=token_exchange_failed', request.url)
      )
    }

    const tokens = await tokenResponse.json()

    // Get user info from token
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    )

    const googleUser = await userInfoResponse.json()

    // Get the current user from Supabase cookie
    const cookieStore = await cookies()
    const supabaseAuthToken = cookieStore.get('sb-access-token')?.value

    if (!supabaseAuthToken) {
      return NextResponse.redirect(
        new URL('/settings?google_error=not_authenticated', request.url)
      )
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user from session
    const { data: { user } } = await supabase.auth.getUser(supabaseAuthToken)

    if (!user) {
      return NextResponse.redirect(
        new URL('/settings?google_error=no_user', request.url)
      )
    }

    // Store the integration
    const { error: dbError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: user.id,
        provider: 'google_calendar',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        provider_user_id: googleUser.id,
        provider_email: googleUser.email,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(
        new URL('/settings?google_error=db_error', request.url)
      )
    }

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/settings?google_connected=true', request.url)
    )
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/settings?google_error=unknown', request.url)
    )
  }
}
