import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.dangerousgames.online',
  appName: 'Dangerous Games Online',
  webDir: '../web/dist',
  bundledWebRuntime: false
  server: {
    androidScheme: 'http',
    hostname: 'localhost',
  },
};

export default config;
