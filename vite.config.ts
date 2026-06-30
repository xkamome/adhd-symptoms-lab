import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  // 相對路徑 → build 後可放在任何子路徑/靜態託管 (GitHub Pages / Netlify / Vercel)
  base: './',
  plugins: [svelte()],
  // host: true → 同一 WiFi 下手機可用電腦區網 IP 連進來測試
  server: { host: true },
})
