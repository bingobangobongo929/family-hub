/**
 * Live Activity Bridge
 *
 * Manages Live Activities for timer widgets on Dynamic Island and Lock Screen.
 * Only available on iOS 16.1+
 */

import { Capacitor, registerPlugin } from '@capacitor/core'

interface LiveActivityPlugin {
  startTimerActivity(options: {
    name: string
    emoji: string
    duration: number
  }): Promise<{ activityId: string }>

  updateTimerActivity(options: {
    timeRemaining: number
    isPaused: boolean
  }): Promise<void>

  endTimerActivity(options: { completed: boolean }): Promise<void>

  isAvailable(): Promise<{ available: boolean }>
}

const LiveActivity = registerPlugin<LiveActivityPlugin>('LiveActivity')

// Check if we're on native iOS
const isNativeIOS = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

/**
 * Check if Live Activities are available
 */
export async function isLiveActivityAvailable(): Promise<boolean> {
  if (!isNativeIOS()) return false

  try {
    const result = await LiveActivity.isAvailable()
    return result.available
  } catch {
    return false
  }
}

/**
 * Start a timer Live Activity
 * Shows the timer on Dynamic Island and Lock Screen
 */
export async function startTimerActivity(
  name: string,
  emoji: string,
  durationSeconds: number
): Promise<string | null> {
  if (!isNativeIOS()) {
    console.log('[LiveActivity] Not on iOS, skipping')
    return null
  }

  try {
    const result = await LiveActivity.startTimerActivity({
      name,
      emoji,
      duration: durationSeconds,
    })
    console.log('[LiveActivity] Started timer activity:', result.activityId)
    return result.activityId
  } catch (error) {
    console.error('[LiveActivity] Failed to start:', error)
    return null
  }
}

/**
 * Update a running timer Live Activity
 */
export async function updateTimerActivity(
  timeRemaining: number,
  isPaused = false
): Promise<void> {
  if (!isNativeIOS()) return

  try {
    await LiveActivity.updateTimerActivity({
      timeRemaining,
      isPaused,
    })
  } catch (error) {
    console.error('[LiveActivity] Failed to update:', error)
  }
}

/**
 * End the timer Live Activity
 */
export async function endTimerActivity(completed = true): Promise<void> {
  if (!isNativeIOS()) return

  try {
    await LiveActivity.endTimerActivity({ completed })
    console.log('[LiveActivity] Ended timer activity')
  } catch (error) {
    console.error('[LiveActivity] Failed to end:', error)
  }
}
