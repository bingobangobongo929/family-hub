import { createClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/encryption'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

export type GoogleProvider = 'google_calendar' | 'google_photos'

// Refresh access token if expired
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
} | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

// Get valid access token (refresh if needed)
export async function getValidAccessToken(
  userId: string,
  provider: GoogleProvider
): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get integration
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  if (!integration) return null

  const expiresAt = new Date(integration.token_expires_at)
  const now = new Date()

  // If token is still valid (with 5 minute buffer)
  if (expiresAt.getTime() - 5 * 60 * 1000 > now.getTime()) {
    // Decrypt and return the stored access token
    return decrypt(integration.access_token)
  }

  // Decrypt refresh token to use for refresh
  if (!integration.refresh_token) return null
  const decryptedRefreshToken = decrypt(integration.refresh_token)

  // Refresh the token
  const refreshed = await refreshAccessToken(decryptedRefreshToken)
  if (!refreshed) return null

  // Encrypt the new access token before storing
  const encryptedAccessToken = encrypt(refreshed.access_token)

  // Update the stored token
  await supabase
    .from('user_integrations')
    .update({
      access_token: encryptedAccessToken,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', provider)

  return refreshed.access_token
}

// Check if user has a specific Google integration
export async function hasGoogleIntegration(
  userId: string,
  provider: GoogleProvider
): Promise<boolean> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await supabase
    .from('user_integrations')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  return !!data
}
