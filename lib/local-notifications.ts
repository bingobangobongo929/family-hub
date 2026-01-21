/**
 * Local Notifications Utility
 *
 * Provides local notification functionality for iOS native app.
 * Used for showing instant feedback notifications (e.g., AI processing complete).
 * Falls back to push notifications if local notifications are unavailable.
 */

import { isNativeIOS, FamilyHubNative } from './native-plugin'
import { supabase } from './supabase'

// Re-export for convenience
export { isNativeIOS }

// Local notification options
interface LocalNotificationOptions {
  id?: string
  title: string
  body?: string
  sound?: boolean
  category?: string
  data?: Record<string, unknown>
}

interface LocalNotificationResult {
  success: boolean
  id?: string
}

/**
 * Send a push notification via the server API
 * Used as fallback when local notifications aren't available
 */
async function sendPushNotificationFallback(options: LocalNotificationOptions): Promise<LocalNotificationResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token || !session?.user?.id) {
      console.log('[LocalNotifications] No session for push fallback')
      return { success: false }
    }

    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        user_id: session.user.id,
        title: options.title,
        body: options.body || '',
        data: {
          type: options.category?.toLowerCase() || 'share_extension',
          ...options.data,
        },
      }),
    })

    const result = await response.json()
    console.log('[LocalNotifications] Push fallback result:', result)
    return { success: result.sent > 0, id: options.id }
  } catch (error) {
    console.error('[LocalNotifications] Push fallback failed:', error)
    return { success: false }
  }
}

/**
 * Send a local notification immediately
 * Falls back to push notification if local notifications unavailable
 */
export async function sendLocalNotification(options: LocalNotificationOptions): Promise<LocalNotificationResult> {
  if (!isNativeIOS()) {
    console.log('[LocalNotifications] Not on native iOS, trying push fallback')
    return sendPushNotificationFallback(options)
  }

  try {
    const result = await FamilyHubNative.sendLocalNotification({
      id: options.id || `notification-${Date.now()}`,
      title: options.title,
      body: options.body || '',
      sound: options.sound ?? true,
      category: options.category,
      data: options.data || {},
    })
    console.log('[LocalNotifications] Notification sent:', result)
    return result
  } catch (error: any) {
    console.error('[LocalNotifications] Failed to send notification:', error)

    // If UNIMPLEMENTED, fall back to push notification
    if (error?.code === 'UNIMPLEMENTED') {
      console.log('[LocalNotifications] Local not available, trying push fallback')
      return sendPushNotificationFallback(options)
    }

    return { success: false }
  }
}

/**
 * Pre-defined notification templates for common use cases
 */
export const NotificationTemplates = {
  /**
   * Task created successfully from shared content
   */
  taskCreated: (taskTitle: string) => sendLocalNotification({
    id: 'task-created',
    title: 'Task Added',
    body: taskTitle.length > 50 ? taskTitle.substring(0, 47) + '...' : taskTitle,
    sound: true,
    category: 'TASK_CREATED',
  }),

  /**
   * Multiple tasks created from shared content
   */
  tasksCreated: (count: number) => sendLocalNotification({
    id: 'tasks-created',
    title: 'Tasks Added',
    body: `${count} tasks created from your shared content`,
    sound: true,
    category: 'TASKS_CREATED',
  }),

  /**
   * Calendar event created from shared image
   */
  eventCreated: (eventTitle: string) => sendLocalNotification({
    id: 'event-created',
    title: 'Event Added',
    body: eventTitle.length > 50 ? eventTitle.substring(0, 47) + '...' : eventTitle,
    sound: true,
    category: 'EVENT_CREATED',
  }),

  /**
   * Multiple events created from shared image
   */
  eventsCreated: (count: number) => sendLocalNotification({
    id: 'events-created',
    title: 'Events Added',
    body: `${count} events found and added to your calendar`,
    sound: true,
    category: 'EVENTS_CREATED',
  }),

  /**
   * Failed to parse shared content
   */
  parseFailed: (type: 'task' | 'event') => sendLocalNotification({
    id: 'parse-failed',
    title: type === 'task' ? 'Task Not Added' : 'No Events Found',
    body: type === 'task'
      ? "Couldn't understand that - tap to add manually"
      : "Couldn't find any events in that image",
    sound: true,
    category: 'PARSE_FAILED',
  }),

  /**
   * Generic processing error
   */
  processingError: () => sendLocalNotification({
    id: 'processing-error',
    title: 'Processing Failed',
    body: 'Something went wrong - tap to try again',
    sound: true,
    category: 'ERROR',
  }),
}
