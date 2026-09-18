import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served at https://10dtendy.github.io/training/ (a project page, not a
  // <user>.github.io root site), so every asset URL needs this prefix.
  base: '/training/',
})
