'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';
import { supabase } from './supabase';
import {
  initPushNotifications,
  removePushListeners,
  isNativeApp,
  getPushPermissionStatus
} from './push-notifications';
import type { PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

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

  // Handle receiving token from native
  const handleToken = useCallback(async (newToken: string) => {
    setToken(newToken);
    setIsEnabled(true);

    // Store token in database for this user
    if (user) {
      try {
        await supabase
          .from('push_tokens')
          .upsert({
            user_id: user.id,
            token: newToken,
            platform: 'ios',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,token',
          });
      } catch (error) {
        console.error('Error storing push token:', error);
      }
    }
  }, [user]);

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
