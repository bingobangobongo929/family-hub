import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.familyhub.app',
  appName: 'Family Hub',
  webDir: 'out',

  // Load from your Vercel deployment URL
  // Update this to your actual Vercel URL
  server: {
    url: 'https://family-hub-sage.vercel.app',
    cleartext: false,
  },

  ios: {
    // Enable push notifications
    contentInset: 'automatic',
    scheme: 'Family Hub',
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
