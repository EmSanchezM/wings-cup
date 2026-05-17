import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({

  modules: [
    'shadcn-nuxt',
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    '@nuxt/eslint',
  ],

  css: ['~/assets/css/tailwind.css'],

  runtimeConfig: {
    // SERVER-ONLY: these never reach the client bundle.
    // Env convention: NUXT_* (without PUBLIC_) → top-level runtimeConfig.* (server-only).
    supabaseServiceKey: '', // env: NUXT_SUPABASE_SERVICE_KEY
    cronSecret: '', // env: NUXT_CRON_SECRET
    apiFootballKey: '', // env: NUXT_API_FOOTBALL_KEY (used in slice 3 — matches sync)
    public: {
      // safe-to-expose values only.
      // @nuxtjs/supabase reads NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_KEY itself.
    },
  },

  future: { compatibilityVersion: 4 },
  compatibilityDate: '2025-11-01',

  vite: {
    plugins: [tailwindcss()],
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  supabase: {
    // @nuxtjs/supabase v2 reads NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_KEY from env directly.
    // We do NOT mirror them into runtimeConfig.public to avoid duplication.
    useSsrCookies: true,
    redirectOptions: {
      login: '/auth/login',
      callback: '/auth/confirm',
      include: ['/rooms(/*)?', '/admin(/*)?'],
      exclude: ['/', '/join/*', '/auth/*'],
      saveRedirectToCookie: true,
    },
    types: fileURLToPath(new URL('./shared/types/database.types.ts', import.meta.url)),
  },
})
