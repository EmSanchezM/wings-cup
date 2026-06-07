import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // project-specific overrides
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@/*', '@@/*'],
          message: 'Use ~/ for app/ imports (project standard).',
        },
        {
          group: ['~~/*', '~~/shared/*'],
          message: 'Use #shared/ for shared/ imports.',
        },
        {
          group: ['../**/shared/**', '../../**/shared/**', '../../../**/shared/**'],
          message: 'Use #shared/ instead of relative paths to shared/.',
        },
      ],
    }],
  },
})
