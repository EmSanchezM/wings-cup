import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({

  modules: [
    'shadcn-nuxt',
    '@pinia/nuxt',
    '@nuxt/eslint',
  ],

  css: ['~/assets/css/tailwind.css'],

  runtimeConfig: {
    supabaseServiceKey: '',
    cronSecret: '',
    apiFootballKey: '',
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
})
