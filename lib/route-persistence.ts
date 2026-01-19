/**
 * Route Persistence - Remember and restore the last visited page
 *
 * This helps when:
 * - iOS kills the webview due to memory pressure
 * - User minimizes and returns to the app
 * - App is restarted
 */

const ROUTE_STORAGE_KEY = 'family-hub-last-route'
const ROUTE_TIMESTAMP_KEY = 'family-hub-last-route-time'

// Routes that should NOT be restored (login, error pages, etc)
const EXCLUDED_ROUTES = ['/login', '/error', '/404']

// Maximum age for a saved route (24 hours) - don't restore ancient routes
const MAX_ROUTE_AGE_MS = 24 * 60 * 60 * 1000

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
 * Get the saved route if it exists and is still valid
 */
export function getSavedRoute(): string | null {
  try {
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
 * Check if we should restore a route (only on initial app load)
 */
export function shouldRestoreRoute(currentPathname: string): boolean {
  const savedRoute = getSavedRoute()

  // No saved route
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
