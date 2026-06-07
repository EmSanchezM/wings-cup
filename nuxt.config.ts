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

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/wing-logo.svg' },
      ],
    },
  },

  runtimeConfig: {
    // Reserved server-only placeholder. Keep at least one top-level (non-public) key:
    // an empty server runtimeConfig breaks @nuxtjs/supabase client init in the Nuxt
    // test env. Prediction locking runs via Supabase pg_cron (lock_started_predictions),
    // so there is no cron secret / HTTP cron endpoint anymore.
    _reserved: '',
    public: {
      // Optional canonical origin for absolute OG/canonical URLs (e.g. https://wings-cup.vercel.app).
      // Falls back to the request origin when empty. Env: NUXT_PUBLIC_SITE_URL
      siteUrl: '',
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
