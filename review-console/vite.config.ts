import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    watch: {
      // This repo lives on a non-APFS external drive (T7Shield) where native
      // fsevents file watching is unreliable — edits can silently fail to
      // trigger HMR, serving stale code until the dev server is restarted
      // (confirmed: a saved change sat un-served for several edits before
      // this was diagnosed). Polling is slower but actually detects changes.
      usePolling: true,
      interval: 300,
    },
  },
})
