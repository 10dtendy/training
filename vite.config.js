import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// A Content Security Policy for the built site: GitHub Pages can't send security
// headers, so it goes in a <meta> tag instead. It only lists what the app really
// uses — Supabase (data, logins, images), YouTube (videos, after cookie consent),
// Cloudflare Turnstile (the bot check on login) and the site itself — so injected scripts or data sent elsewhere are refused.
// Build only: the dev server relies on inline scripts this policy would block.
function contentSecurityPolicy(supabaseUrl) {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : ''
  const supabaseWs = supabase.replace(/^https:/, 'wss:')
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://www.youtube.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase} https://img.youtube.com https://i.ytimg.com`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs} https://challenges.cloudflare.com`,
    `media-src 'self' blob: ${supabase}`,
    'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://challenges.cloudflare.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), contentSecurityPolicy(env.VITE_SUPABASE_URL)],
    // Served at the root of its own domain, https://app.10dtendy.com/ (GitHub Pages
    // custom domain; the old 10dtendy.github.io/training/ address redirects there).
    base: '/',
  }
})
