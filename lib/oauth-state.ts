import { SignJWT, jwtVerify } from 'jose'
import { randomBytes } from 'crypto'

/**
 * Ensures OAuth redirect URLs use HTTPS in production.
 * Prevents protocol downgrade attacks and ensures secure token exchange.
 */
export function getSecureRedirectUri(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  // In production, enforce HTTPS
  if (process.env.NODE_ENV === 'production') {
    const secureUrl = baseUrl.replace(/^http:\/\//, 'https://')
    return `${secureUrl}${path}`
  }

  // In development, allow HTTP for localhost
  return `${baseUrl}${path}`
}

// Secret for signing OAuth state tokens (use ENCRYPTION_KEY or a dedicated secret)
const STATE_SECRET = new TextEncoder().encode(
  process.env.ENCRYPTION_KEY || process.env.OAUTH_STATE_SECRET || 'fallback-secret-change-me'
)

interface OAuthStatePayload {
  userId: string
  nonce: string
  provider: string
  exp: number
}

/**
 * Generate a secure OAuth state token
 * Contains: user_id, random nonce, provider, expiration (10 minutes)
 * Signed with JWT to prevent tampering
 */
export async function generateOAuthState(userId: string, provider: string): Promise<string> {
  const nonce = randomBytes(16).toString('hex')
  const expiresAt = Math.floor(Date.now() / 1000) + 600 // 10 minutes

  const token = await new SignJWT({
    userId,
    nonce,
    provider,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresAt)
    .setIssuedAt()
    .sign(STATE_SECRET)

  return token
}

/**
 * Verify and decode an OAuth state token
 * Returns the user_id if valid, null if invalid/expired
 */
export async function verifyOAuthState(
  state: string,
  expectedProvider: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(state, STATE_SECRET)

    // Verify provider matches
    if (payload.provider !== expectedProvider) {
      console.error('OAuth state provider mismatch')
      return null
    }

    // Type assertion after validation
    const userId = payload.userId as string
    if (!userId) {
      console.error('OAuth state missing userId')
      return null
    }

    return { userId }
  } catch (error) {
    console.error('OAuth state verification failed:', error)
    return null
  }
}
