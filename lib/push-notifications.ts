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
  console.log('[Push] initPushNotifications called');
  console.log('[Push] isNativeApp:', isNativeApp());
  console.log('[Push] Capacitor platform:', Capacitor.getPlatform());

  if (!isNativeApp()) {
    console.log('[Push] Not native app, skipping');
    return false;
  }

  try {
    // Request permission
    console.log('[Push] Requesting permissions...');
    const permStatus = await PushNotifications.requestPermissions();
    console.log('[Push] Permission status:', permStatus.receive);

    if (permStatus.receive !== 'granted') {
      console.log('[Push] Permission denied');
      return false;
    }

    // Remove existing listeners first to avoid duplicates
    console.log('[Push] Removing existing listeners...');
    await PushNotifications.removeAllListeners();

    // IMPORTANT: Add listeners BEFORE calling register() to avoid race condition
    console.log('[Push] Adding registration listener...');
    await PushNotifications.addListener('registration', (token: Token) => {
      console.log('[Push] REGISTRATION EVENT FIRED! Token:', token.value?.substring(0, 20) + '...');
      onToken(token.value);
    });

    // Listen for registration errors
    console.log('[Push] Adding registrationError listener...');
    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[Push] REGISTRATION ERROR:', JSON.stringify(error));
    });

    // Listen for incoming notifications (app in foreground)
    await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[Push] Notification received:', notification);
      onNotification(notification);
    });

    // Listen for notification tap
    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('[Push] Notification action:', action);
      onAction(action);
    });

    // Register for push notifications AFTER listeners are set up
    console.log('[Push] Calling PushNotifications.register()...');
    await PushNotifications.register();
    console.log('[Push] register() completed');

    return true;
  } catch (error) {
    console.error('[Push] Error initializing:', error);
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
