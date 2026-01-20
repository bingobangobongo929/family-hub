/**
 * Route Persistence - Smart navigation behavior
 *
 * Behavior:
 * - Cold start (app killed, >30 min background): Go to Dashboard
 * - Warm resume (app backgrounded <30 min): Restore last page
 * - Widget tap: Go to widget's target page (handled by deep links)
 */

const ROUTE_STORAGE_KEY = 'family-hub-last-route'
const ROUTE_TIMESTAMP_KEY = 'family-hub-last-route-time'
const BACKGROUND_TIMESTAMP_KEY = 'family-hub-background-time'

// Routes that should NOT be restored (login, error pages, etc)
const EXCLUDED_ROUTES = ['/login', '/error', '/404']

// Maximum age for a saved route (24 hours) - don't restore ancient routes
const MAX_ROUTE_AGE_MS = 24 * 60 * 60 * 1000

// Cold start threshold - if backgrounded for more than 30 minutes, treat as cold start
const COLD_START_THRESHOLD_MS = 30 * 60 * 1000

/**
 * Save the current route to localStorage
 */
export function saveCurrentRoute(pathname: string): void {
  // Don't save excluded routes
  if (EXCLUDED_ROUTES.includes(pathname)) {
    return
  }

  try {
    localStorage.setItem(ROUTE_STORAGE_KEY, pathname)
    localStorage.setItem(ROUTE_TIMESTAMP_KEY, Date.now().toString())
  } catch (e) {
    // localStorage might be unavailable (private browsing, etc)
    console.warn('Could not save route:', e)
  }
}

/**
 * Mark app as going to background
 * Call this when app loses focus/goes to background
 */
export function markAppBackgrounded(): void {
  try {
    localStorage.setItem(BACKGROUND_TIMESTAMP_KEY, Date.now().toString())
  } catch (e) {
    // Ignore
  }
}

/**
 * Check if this is a cold start (app was killed or backgrounded for >30 min)
 */
export function isColdStart(): boolean {
  try {
    const backgroundTime = localStorage.getItem(BACKGROUND_TIMESTAMP_KEY)

    // No background time recorded = first launch = cold start
    if (!backgroundTime) {
      return true
    }

    const timeSinceBackground = Date.now() - parseInt(backgroundTime, 10)

    // If backgrounded for more than threshold, it's a cold start
    if (timeSinceBackground > COLD_START_THRESHOLD_MS) {
      return true
    }

    return false
  } catch (e) {
    // If we can't check, assume cold start for safety
    return true
  }
}

/**
 * Get the saved route if it exists and is still valid
 * Returns null for cold starts (app should go to Dashboard)
 */
export function getSavedRoute(): string | null {
  try {
    // Cold start = always go to Dashboard (return null)
    if (isColdStart()) {
      console.log('[Route Restore] Cold start detected, returning to Dashboard')
      clearBackgroundTimestamp()
      return null
    }

    const savedRoute = localStorage.getItem(ROUTE_STORAGE_KEY)
    const savedTime = localStorage.getItem(ROUTE_TIMESTAMP_KEY)

    if (!savedRoute || !savedTime) {
      return null
    }

    // Check if the route is too old
    const routeAge = Date.now() - parseInt(savedTime, 10)
    if (routeAge > MAX_ROUTE_AGE_MS) {
      clearSavedRoute()
      return null
    }

    // Don't return excluded routes
    if (EXCLUDED_ROUTES.includes(savedRoute)) {
      return null
    }

    console.log('[Route Restore] Warm resume, restoring:', savedRoute)
    return savedRoute
  } catch (e) {
    console.warn('Could not get saved route:', e)
    return null
  }
}

/**
 * Clear the saved route
 */
export function clearSavedRoute(): void {
  try {
    localStorage.removeItem(ROUTE_STORAGE_KEY)
    localStorage.removeItem(ROUTE_TIMESTAMP_KEY)
  } catch (e) {
    // Ignore
  }
}

/**
 * Clear the background timestamp
 */
export function clearBackgroundTimestamp(): void {
  try {
    localStorage.removeItem(BACKGROUND_TIMESTAMP_KEY)
  } catch (e) {
    // Ignore
  }
}

/**
 * Check if we should restore a route (only on warm resume)
 */
export function shouldRestoreRoute(currentPathname: string): boolean {
  const savedRoute = getSavedRoute()

  // No saved route (or cold start)
  if (!savedRoute) {
    return false
  }

  // Already on the saved route
  if (currentPathname === savedRoute) {
    return false
  }

  // Currently on homepage and have a different saved route
  if (currentPathname === '/' && savedRoute !== '/') {
    return true
  }

  return false
}
