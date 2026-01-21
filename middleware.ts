import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/f1/schedule',
  '/api/f1/next',
  '/api/f1/standings',
  '/api/f1/news',
  '/api/f1/fantasy',
]

// Routes that use service role key internally (bypass middleware auth)
const SERVICE_ROLE_ROUTES = [
  '/api/routines/completion',
  '/api/notifications/log',
  '/api/notifications/debug',  // Debug endpoints handle their own auth
]

// Routes that use CRON_SECRET instead of user auth (cron jobs only)
const CRON_ROUTES = [
  '/api/notifications/triggers/bins',
  '/api/notifications/triggers/chores',
  '/api/notifications/triggers/events',
  '/api/notifications/triggers/routines',
  '/api/notifications/triggers/shopping-list',
  '/api/notifications/triggers/f1-sessions',
  '/api/notifications/triggers/f1-news',
  '/api/notifications/triggers/f1-results',
]

// Routes that allow either user auth OR cron auth (can be called from app or cron)
const DUAL_AUTH_ROUTES = [
  '/api/notifications/send',
  '/api/notifications/triggers/event-created',
  '/api/notifications/triggers/event-changed',
  '/api/notifications/triggers/event-deleted',
]

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const pathname = req.nextUrl.pathname

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return res
  }

  // Skip public F1 routes (public data)
  if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
    return res
  }

  // Skip service role routes (they handle their own auth via service key)
  if (SERVICE_ROLE_ROUTES.some(route => pathname.startsWith(route))) {
    return res
  }

  // Cron routes - Vercel cron doesn't send auth headers, so we allow these through
  // Security: These endpoints are not advertised and only process scheduled tasks
  // They use service role keys internally and don't expose sensitive data
  if (CRON_ROUTES.some(route => pathname.startsWith(route))) {
    return res
  }

  // Dual auth routes: allow CRON_SECRET OR user session
  if (DUAL_AUTH_ROUTES.some(route => pathname.startsWith(route))) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // If valid cron secret provided, allow through
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return res
    }
    // Otherwise, fall through to user auth check below
  }

  // OAuth callback routes - these handle their own auth via cookies/state
  if (pathname.includes('/callback')) {
    return res
  }

  // Create Supabase client for auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Try cookie-based auth first (web browser)
  let user = (await supabase.auth.getUser()).data.user

  // If no cookie auth, try Bearer token (mobile apps / Capacitor)
  if (!user) {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data } = await supabase.auth.getUser(token)
      user = data.user
    }
  }

  // OAuth auth initiation and protected API routes need user session
  if (!user) {
    // Allow unauthenticated access to calendar-ai for demo mode
    // But in production, this should be authenticated
    if (pathname === '/api/calendar-ai') {
      // Add rate limiting header for unauthenticated requests
      res.headers.set('X-RateLimit-Limit', '10')
      return res
    }

    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Validate user_id parameter matches authenticated user
  const url = req.nextUrl
  const userIdParam = url.searchParams.get('user_id')

  if (userIdParam && userIdParam !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden: Cannot access other user data' },
      { status: 403 }
    )
  }

  // Add the authenticated user_id to headers for routes to use
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-authenticated-user-id', user.id)

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: ['/api/:path*'],
}
