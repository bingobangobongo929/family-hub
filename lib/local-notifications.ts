/**
 * Local Notifications Utility
 *
 * Provides local notification functionality for iOS native app.
 * Used for showing instant feedback notifications (e.g., AI processing complete).
 */

import { isNativeIOS, FamilyHubNative } from './native-plugin'

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
 * Send a local notification immediately
 * Only works on native iOS, no-ops on web
 */
export async function sendLocalNotification(options: LocalNotificationOptions): Promise<LocalNotificationResult> {
  if (!isNativeIOS()) {
    console.log('[LocalNotifications] Not on native iOS, skipping notification')
    return { success: false }
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
  } catch (error) {
    console.error('[LocalNotifications] Failed to send notification:', error)
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
