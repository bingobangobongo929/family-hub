import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/f1/schedule',
  '/api/f1/next',
  '/api/f1/standings',
  '/api/f1/news',
]

// Routes that use CRON_SECRET instead of user auth
const CRON_ROUTES = [
  '/api/notifications/triggers/',
  '/api/notifications/send',
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

  // Cron routes use Bearer token auth - ALWAYS check, not just in production
  if (CRON_ROUTES.some(route => pathname.startsWith(route))) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return res
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

  const { data: { user } } = await supabase.auth.getUser()

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
