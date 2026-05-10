import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    globals: true,
    reporters: ['default'],
    projects: [
      // Unit tests — plain Node environment, no Nuxt runtime
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      // Nuxt component tests — uses @nuxt/test-utils v4 environment
      // IMPORTANT (Vitest v4 breaking change): composables must be in beforeAll, not top-level describe
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['tests/nuxt/**/*.test.ts'],
        },
      }),
    ],
  },
})
