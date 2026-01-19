'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Preferences } from '@capacitor/preferences';
import { useAuth } from './auth-context';
import { supabase } from './supabase';
import {
  initPushNotifications,
  removePushListeners,
  isNativeApp,
  getPushPermissionStatus,
  refreshPushToken,
  clearBadge as clearPushBadge
} from './push-notifications';
import {
  isWebPushSupported,
  getWebPushPermission,
  subscribeToWebPush,
  subscriptionToJson,
  getWebPushSubscription,
} from './web-push';
import type { PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

const PUSH_TOKEN_KEY = 'push_token';
const WEB_PUSH_KEY = 'web_push_subscription';

// VAPID public key - must match server's VAPID_PUBLIC_KEY
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

interface PushContextType {
  isNative: boolean;
  isWebPushAvailable: boolean;
  isEnabled: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'loading' | 'unsupported';
  token: string | null;
  platform: 'ios' | 'web' | null;
  error: string | null;
  debugLog: string[];
  requestPermission: () => Promise<boolean>;
  refreshToken: () => Promise<void>;
  clearBadge: () => Promise<void>;
}

const PushContext = createContext<PushContextType>({
  isNative: false,
  isWebPushAvailable: false,
  isEnabled: false,
  permissionStatus: 'loading',
  token: null,
  platform: null,
  error: null,
  debugLog: [],
  requestPermission: async () => false,
  refreshToken: async () => {},
  clearBadge: async () => {},
});

export function PushProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [isNative] = useState(() => isNativeApp());
  const [isWebPushAvailable, setIsWebPushAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'loading' | 'unsupported'>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'web' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  // Add to debug log
  const log = useCallback((msg: string) => {
    console.log('[PushContext]', msg);
    setDebugLog(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  // Save token to server
  const saveTokenToServer = useCallback(async (tokenToSave: string, tokenPlatform: 'ios' | 'web', webSubscription?: object) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('No session for push token save');
        return false;
      }

      const body: any = { token: tokenToSave, platform: tokenPlatform };
      if (webSubscription) {
        body.web_subscription = webSubscription;
      }

      const response = await fetch('/api/push-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (result.success) {
        console.log(`Push token saved successfully (${tokenPlatform})`);
        return true;
      } else {
        console.error('Push token save failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error storing push token:', error);
      return false;
    }
  }, []);

  // Handle receiving token from native iOS
  const handleToken = useCallback(async (newToken: string) => {
    log(`handleToken called with: ${newToken?.substring(0, 20)}...`);
    setToken(newToken);
    setPlatform('ios');
    setIsEnabled(true);
    setError(null);

    // Store token locally for persistence
    try {
      await Preferences.set({ key: PUSH_TOKEN_KEY, value: newToken });
      log('Token saved locally');
    } catch (e) {
      log(`Failed to save token locally: ${e}`);
      setError(`Failed to save token: ${e}`);
    }

    // Store token via API
    if (user) {
      log('Saving token to server...');
      const success = await saveTokenToServer(newToken, 'ios');
      log(`Server save result: ${success}`);
    } else {
      log('No user, will save token when user logs in');
    }
  }, [user, saveTokenToServer, log]);

  // Handle web push subscription
  const handleWebPushSubscription = useCallback(async (subscription: PushSubscription) => {
    const subJson = subscriptionToJson(subscription);
    const tokenId = subscription.endpoint.split('/').pop() || subscription.endpoint;

    log(`Web push subscription: ${tokenId.substring(0, 20)}...`);
    setToken(tokenId);
    setPlatform('web');
    setIsEnabled(true);
    setError(null);

    // Store subscription locally
    try {
      localStorage.setItem(WEB_PUSH_KEY, JSON.stringify(subJson));
      log('Web subscription saved locally');
    } catch (e) {
      log(`Failed to save web subscription locally: ${e}`);
    }

    // Store subscription via API
    if (user) {
      log('Saving web subscription to server...');
      const success = await saveTokenToServer(tokenId, 'web', subJson);
      log(`Server save result: ${success}`);
    } else {
      log('No user, will save subscription when user logs in');
    }
  }, [user, saveTokenToServer, log]);

  // When user logs in, save any stored token
  useEffect(() => {
    const saveStoredToken = async () => {
      if (!user) return;

      if (isNative) {
        // Native iOS
        try {
          const { value: storedToken } = await Preferences.get({ key: PUSH_TOKEN_KEY });
          if (storedToken) {
            console.log('Found stored iOS token, saving to server...');
            setToken(storedToken);
            setPlatform('ios');
            setIsEnabled(true);
            await saveTokenToServer(storedToken, 'ios');
          }
        } catch (e) {
          console.error('Failed to get stored token:', e);
        }
      } else if (isWebPushAvailable) {
        // Web push
        try {
          const storedSub = localStorage.getItem(WEB_PUSH_KEY);
          if (storedSub) {
            const subJson = JSON.parse(storedSub);
            const tokenId = subJson.endpoint?.split('/').pop() || 'web-token';
            console.log('Found stored web subscription, saving to server...');
            setToken(tokenId);
            setPlatform('web');
            setIsEnabled(true);
            await saveTokenToServer(tokenId, 'web', subJson);
          }
        } catch (e) {
          console.error('Failed to get stored web subscription:', e);
        }
      }
    };

    saveStoredToken();
  }, [user, isNative, isWebPushAvailable, saveTokenToServer]);

  // Handle incoming notification
  const handleNotification = useCallback((notification: PushNotificationSchema) => {
    // Could show an in-app notification banner here
    console.log('Received notification:', notification.title);
  }, []);

  // Handle notification tap
  const handleAction = useCallback((action: ActionPerformed) => {
    const data = action.notification.data;

    // Use deep_link if provided (preferred method)
    if (data?.deep_link) {
      router.push(data.deep_link);
      return;
    }

    // Fallback: Navigate based on notification type
    if (data?.type === 'event_reminder' || data?.type === 'event_created') {
      router.push('/calendar');
    } else if (data?.type === 'bin_reminder_evening' || data?.type === 'bin_reminder_morning') {
      router.push('/bindicator');
    } else if (data?.type === 'chore_reminder') {
      router.push('/tasks');
    } else if (data?.type === 'routine_reminder') {
      router.push('/routines');
    } else if (data?.type?.startsWith('f1_')) {
      // All F1 notifications go to F1 page
      if (data.type.includes('news')) {
        router.push('/f1?tab=news');
      } else if (data.type.includes('championship') || data.type.includes('drivers')) {
        router.push('/f1?tab=drivers');
      } else {
        router.push('/f1');
      }
    }
  }, [router]);

  // Check permission status on mount
  useEffect(() => {
    const checkStatus = async () => {
      log(`checkStatus started, isNative=${isNative}`);

      if (isNative) {
        // Native iOS push
        log('Native app, checking iOS push status...');
        const status = await getPushPermissionStatus();
        log(`Permission status: ${status}`);
        setPermissionStatus(status);
        setPlatform('ios');

        if (status === 'granted') {
          // Load stored token
          try {
            log('Checking for stored token...');
            const { value: storedToken } = await Preferences.get({ key: PUSH_TOKEN_KEY });
            if (storedToken) {
              log(`Found stored token: ${storedToken.substring(0, 10)}...`);
              setToken(storedToken);
              setIsEnabled(true);
            }
          } catch (e) {
            log(`Error loading stored token: ${e}`);
            setError(`Failed to load stored token: ${e}`);
          }

          // Initialize listeners
          log('Calling initPushNotifications...');
          try {
            const success = await initPushNotifications(handleToken, handleNotification, handleAction);
            log(`initPushNotifications returned: ${success}`);
          } catch (e) {
            log(`initPushNotifications error: ${e}`);
            setError(`Init error: ${e}`);
          }
        }
      } else {
        // Web browser - check for web push support
        log('Web browser, checking web push support...');
        const webPushSupported = isWebPushSupported();
        setIsWebPushAvailable(webPushSupported);

        if (!webPushSupported) {
          log('Web push not supported in this browser');
          setPermissionStatus('unsupported');
          return;
        }

        // Check VAPID key
        if (!VAPID_PUBLIC_KEY) {
          log('VAPID_PUBLIC_KEY not configured');
          setPermissionStatus('unsupported');
          setError('Web push not configured (missing VAPID key)');
          return;
        }

        log('Web push supported, checking permission...');
        const webPermission = getWebPushPermission();
        log(`Web permission: ${webPermission}`);

        if (webPermission === 'unsupported') {
          setPermissionStatus('unsupported');
          return;
        }

        setPermissionStatus(webPermission as 'granted' | 'denied' | 'prompt');
        setPlatform('web');

        if (webPermission === 'granted') {
          // Check for existing subscription
          try {
            const existingSub = await getWebPushSubscription();
            if (existingSub) {
              log('Found existing web push subscription');
              await handleWebPushSubscription(existingSub);
            }
          } catch (e) {
            log(`Error checking web subscription: ${e}`);
          }
        }
      }
    };

    checkStatus();

    return () => {
      if (isNative) {
        removePushListeners();
      }
    };
  }, [isNative, handleToken, handleNotification, handleAction, handleWebPushSubscription, log]);

  // Request permission and initialize
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isNative) {
      // Native iOS
      const success = await initPushNotifications(handleToken, handleNotification, handleAction);
      const newStatus = await getPushPermissionStatus();
      setPermissionStatus(newStatus);
      return success;
    } else if (isWebPushAvailable && VAPID_PUBLIC_KEY) {
      // Web push
      log('Requesting web push permission...');
      try {
        const subscription = await subscribeToWebPush(VAPID_PUBLIC_KEY);
        if (subscription) {
          await handleWebPushSubscription(subscription);
          setPermissionStatus('granted');
          return true;
        }
        const perm = getWebPushPermission();
        setPermissionStatus(perm === 'unsupported' ? 'unsupported' : perm as any);
        return false;
      } catch (e) {
        log(`Web push subscription error: ${e}`);
        setError(`Failed to subscribe: ${e}`);
        return false;
      }
    }
    return false;
  }, [isNative, isWebPushAvailable, handleToken, handleNotification, handleAction, handleWebPushSubscription, log]);

  // Force refresh the push token (useful when token is missing)
  const refreshToken = useCallback(async (): Promise<void> => {
    if (isNative) {
      console.log('Refreshing iOS push token...');
      await refreshPushToken();
    } else if (isWebPushAvailable && VAPID_PUBLIC_KEY) {
      console.log('Refreshing web push subscription...');
      try {
        const subscription = await subscribeToWebPush(VAPID_PUBLIC_KEY);
        if (subscription) {
          await handleWebPushSubscription(subscription);
        }
      } catch (e) {
        console.error('Web push refresh error:', e);
      }
    }
  }, [isNative, isWebPushAvailable, handleWebPushSubscription]);

  // Clear app badge and delivered notifications
  const clearBadge = useCallback(async (): Promise<void> => {
    if (!isNative) return;
    await clearPushBadge();
  }, [isNative]);

  return (
    <PushContext.Provider value={{
      isNative,
      isWebPushAvailable,
      isEnabled,
      permissionStatus,
      token,
      platform,
      error,
      debugLog,
      requestPermission,
      refreshToken,
      clearBadge,
    }}>
      {children}
    </PushContext.Provider>
  );
}

export const usePush = () => useContext(PushContext);
