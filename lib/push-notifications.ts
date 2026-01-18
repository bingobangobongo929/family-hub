import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

// Check if running in native app
export const isNativeApp = () => Capacitor.isNativePlatform();

// Initialize push notifications
export async function initPushNotifications(
  onToken: (token: string) => void,
  onNotification: (notification: PushNotificationSchema) => void,
  onAction: (action: ActionPerformed) => void
): Promise<boolean> {
  if (!isNativeApp()) {
    console.log('Push notifications only available in native app');
    return false;
  }

  try {
    // Request permission
    const permStatus = await PushNotifications.requestPermissions();

    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission denied');
      return false;
    }

    // IMPORTANT: Add listeners BEFORE calling register() to avoid race condition
    // Listen for registration success
    await PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token:', token.value);
      onToken(token.value);
    });

    // Listen for registration errors
    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error:', error);
    });

    // Listen for incoming notifications (app in foreground)
    await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      onNotification(notification);
    });

    // Listen for notification tap
    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push notification action:', action);
      onAction(action);
    });

    // Register for push notifications AFTER listeners are set up
    await PushNotifications.register();

    return true;
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return false;
  }
}

// Remove all listeners (for cleanup)
export async function removePushListeners() {
  if (!isNativeApp()) return;
  await PushNotifications.removeAllListeners();
}

// Get current permission status
export async function getPushPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNativeApp()) return 'denied';

  const status = await PushNotifications.checkPermissions();
  return status.receive as 'granted' | 'denied' | 'prompt';
}

// Force re-registration to get a fresh token
// Call this when token might be missing or stale
export async function refreshPushToken(): Promise<void> {
  if (!isNativeApp()) return;

  console.log('Forcing push token refresh...');
  await PushNotifications.register();
}
