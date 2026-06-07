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
    cronSecret: '', // env: NUXT_CRON_SECRET
    public: {},
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
    useSsrCookies: true,
    clientOptions: {
      auth: {
        detectSessionInUrl: false,
      },
    },
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
