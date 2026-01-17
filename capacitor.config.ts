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
  },
};

export default config;
