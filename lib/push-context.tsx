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
  getPushPermissionStatus
} from './push-notifications';
import type { PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

const PUSH_TOKEN_KEY = 'push_token';

interface PushContextType {
  isNative: boolean;
  isEnabled: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'loading';
  token: string | null;
  requestPermission: () => Promise<boolean>;
}

const PushContext = createContext<PushContextType>({
  isNative: false,
  isEnabled: false,
  permissionStatus: 'loading',
  token: null,
  requestPermission: async () => false,
});

export function PushProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [isNative] = useState(() => isNativeApp());
  const [isEnabled, setIsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'loading'>('loading');
  const [token, setToken] = useState<string | null>(null);

  // Save token to server
  const saveTokenToServer = useCallback(async (tokenToSave: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('No session for push token save');
        return false;
      }

      const response = await fetch('/api/push-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token: tokenToSave, platform: 'ios' }),
      });

      const result = await response.json();
      if (result.success) {
        console.log('Push token saved successfully');
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

  // Handle receiving token from native
  const handleToken = useCallback(async (newToken: string) => {
    console.log('handleToken called with:', newToken?.substring(0, 20) + '...');
    setToken(newToken);
    setIsEnabled(true);

    // Store token locally for persistence
    try {
      await Preferences.set({ key: PUSH_TOKEN_KEY, value: newToken });
      console.log('Token saved locally');
    } catch (e) {
      console.error('Failed to save token locally:', e);
    }

    // Store token via API
    if (user) {
      await saveTokenToServer(newToken);
    } else {
      console.log('No user, will save token when user logs in');
    }
  }, [user, saveTokenToServer]);

  // When user logs in, save any stored token
  useEffect(() => {
    const saveStoredToken = async () => {
      if (!user || !isNative) return;

      try {
        const { value: storedToken } = await Preferences.get({ key: PUSH_TOKEN_KEY });
        if (storedToken) {
          console.log('Found stored token, saving to server...');
          setToken(storedToken);
          setIsEnabled(true);
          await saveTokenToServer(storedToken);
        }
      } catch (e) {
        console.error('Failed to get stored token:', e);
      }
    };

    saveStoredToken();
  }, [user, isNative, saveTokenToServer]);

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
      if (!isNative) {
        setPermissionStatus('denied');
        return;
      }

      const status = await getPushPermissionStatus();
      setPermissionStatus(status);

      // If already granted, initialize
      if (status === 'granted') {
        initPushNotifications(handleToken, handleNotification, handleAction);
      }
    };

    checkStatus();

    return () => {
      removePushListeners();
    };
  }, [isNative, handleToken, handleNotification, handleAction]);

  // Request permission and initialize
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;

    const success = await initPushNotifications(handleToken, handleNotification, handleAction);
    const newStatus = await getPushPermissionStatus();
    setPermissionStatus(newStatus);

    return success;
  }, [isNative, handleToken, handleNotification, handleAction]);

  return (
    <PushContext.Provider value={{
      isNative,
      isEnabled,
      permissionStatus,
      token,
      requestPermission,
    }}>
      {children}
    </PushContext.Provider>
  );
}

export const usePush = () => useContext(PushContext);
