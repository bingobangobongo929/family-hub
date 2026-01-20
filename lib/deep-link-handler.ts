/**
 * Deep Link Handler
 *
 * Handles deep links from iOS widgets and other sources.
 * URL scheme: familyhub://
 *
 * Supported paths:
 * - familyhub:// -> Dashboard
 * - familyhub://shopping -> Shopping list
 * - familyhub://shopping/add -> Shopping list with add modal open
 * - familyhub://calendar -> Calendar
 * - familyhub://calendar/scan -> Calendar with AI scan modal open
 * - familyhub://routines -> Routines
 * - familyhub://routines?start=morning -> Start a specific routine
 * - familyhub://f1 -> F1 page
 * - familyhub://f1?tab=news -> F1 page news tab
 * - familyhub://bindicator -> Bindicator
 * - familyhub://tasks -> Tasks page
 * - familyhub://tasks/add -> Tasks page with shared content to process
 */

import { Capacitor } from '@capacitor/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';

export interface DeepLinkResult {
  path: string;
  params: Record<string, string>;
}

/**
 * Parse a deep link URL into path and params
 */
export function parseDeepLink(url: string): DeepLinkResult | null {
  try {
    // Handle familyhub:// URLs
    if (url.startsWith('familyhub://')) {
      const withoutScheme = url.replace('familyhub://', '');
      const [pathPart, queryPart] = withoutScheme.split('?');

      const path = '/' + (pathPart || '');
      const params: Record<string, string> = {};

      if (queryPart) {
        const searchParams = new URLSearchParams(queryPart);
        searchParams.forEach((value, key) => {
          params[key] = value;
        });
      }

      return { path, params };
    }

    // Handle https:// URLs (universal links)
    if (url.startsWith('https://')) {
      const urlObj = new URL(url);
      const params: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      return { path: urlObj.pathname, params };
    }

    return null;
  } catch (error) {
    console.error('[DeepLink] Failed to parse URL:', url, error);
    return null;
  }
}

/**
 * Get the route path from a deep link
 */
export function getRouteFromDeepLink(link: DeepLinkResult): string {
  // Map deep link paths to app routes
  const pathMappings: Record<string, string> = {
    '/': '/',
    '/shopping': '/shopping',
    '/shopping/add': '/shopping?add=true',
    '/calendar': '/calendar',
    '/calendar/scan': '/calendar?scan=true',
    '/routines': '/routines',
    '/f1': '/f1',
    '/bindicator': '/bindicator',
    '/tasks': '/tasks',
    '/tasks/add': '/tasks?shared=true',
    '/rewards': '/rewards',
    '/notes': '/notes',
    '/gallery': '/gallery',
    '/contacts': '/contacts',
    '/settings': '/settings',
    '/history': '/history',
  };

  const basePath = pathMappings[link.path] || link.path;

  // Add query params if any
  if (Object.keys(link.params).length > 0) {
    const searchParams = new URLSearchParams(link.params);
    // Check if basePath already has query params
    if (basePath.includes('?')) {
      return `${basePath}&${searchParams.toString()}`;
    }
    return `${basePath}?${searchParams.toString()}`;
  }

  return basePath;
}

// Type for the callback
type DeepLinkCallback = (route: string) => void;

// Store the callback
let deepLinkCallback: DeepLinkCallback | null = null;
let cleanupFn: (() => void) | null = null;

/**
 * Initialize deep link handling
 * Call this in your app's root component
 */
export async function initDeepLinkHandler(
  onDeepLink: DeepLinkCallback
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[DeepLink] Not on native platform, skipping init');
    return;
  }

  deepLinkCallback = onDeepLink;

  // Handle app opened via URL
  const listener = await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    console.log('[DeepLink] App opened with URL:', event.url);
    handleDeepLink(event.url);
  });

  cleanupFn = () => {
    listener.remove();
    deepLinkCallback = null;
  };

  // Check if app was launched with a URL
  try {
    const launchUrl = await App.getLaunchUrl();
    if (launchUrl?.url) {
      console.log('[DeepLink] App launched with URL:', launchUrl.url);
      handleDeepLink(launchUrl.url);
    }
  } catch (error) {
    // getLaunchUrl may not be available
    console.log('[DeepLink] getLaunchUrl not available');
  }
}

/**
 * Handle an incoming deep link
 */
function handleDeepLink(url: string): void {
  const link = parseDeepLink(url);
  if (!link) {
    console.log('[DeepLink] Could not parse URL:', url);
    return;
  }

  const route = getRouteFromDeepLink(link);
  console.log('[DeepLink] Navigating to:', route);

  if (deepLinkCallback) {
    deepLinkCallback(route);
  }
}

/**
 * Clean up deep link listener
 */
export function cleanupDeepLinkHandler(): void {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}
