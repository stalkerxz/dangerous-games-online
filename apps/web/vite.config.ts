import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Dangerous Games Online',
        short_name: 'DangerousGames',
        start_url: '/',
        display: 'standalone',
        background_color: '#f9fafb',
        theme_color: '#2563eb'
      }
    })
  ],
  server: {
    port: 5173,
    host: '0.0.0.0'
  }
});
