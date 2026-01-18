import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.familyhub.home',
  appName: 'Family Hub',
  webDir: 'out',

  // Load from your Vercel deployment URL
  // Update this to your actual Vercel URL
  server: {
    url: 'https://family-hub-sage.vercel.app',
    cleartext: false,
  },

  ios: {
    contentInset: 'automatic',
    scheme: 'Family Hub',
    backgroundColor: '#0f172a', // Match dark mode background (slate-900)
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
