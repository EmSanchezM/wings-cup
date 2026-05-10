import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'nuxt',
      include: ['tests/nuxt/**/*.test.ts'],
      environment: 'nuxt',
    },
  },
])
