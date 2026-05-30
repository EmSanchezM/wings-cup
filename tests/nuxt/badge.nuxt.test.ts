/**
 * Nuxt component tests for Badge.vue (R-DS-04).
 *
 * Vitest v4 + @nuxt/test-utils v4. Badge is a shadcn-vue style primitive:
 * cva variants in index.ts + a thin <span> wrapper using cn().
 *
 * Scenarios:
 *   T-113-01: renders default slot content
 *   T-113-02: variant="destructive" applies destructive token classes
 *   T-113-03: accent variant exists and applies accent token classes
 */
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

describe('Badge (R-DS-04)', () => {
  it('T-113-01: renders default slot content', async () => {
    const { Badge } = await import('../../app/components/ui/badge')
    const wrapper = await mountSuspended(Badge, {
      slots: { default: () => 'Finalizado' },
    })
    expect(wrapper.text()).toContain('Finalizado')
  })

  it('T-113-02: destructive variant applies destructive token classes', async () => {
    const { Badge } = await import('../../app/components/ui/badge')
    const wrapper = await mountSuspended(Badge, {
      props: { variant: 'destructive' },
      slots: { default: () => 'En Vivo' },
    })
    const cls = wrapper.attributes('class') ?? ''
    expect(cls).toContain('bg-destructive')
    expect(cls).toContain('text-destructive-foreground')
  })

  it('T-113-03: accent variant exists and applies accent token classes', async () => {
    const { badgeVariants } = await import('../../app/components/ui/badge')
    const cls = badgeVariants({ variant: 'accent' })
    expect(cls).toContain('bg-accent')
    expect(cls).toContain('text-accent-foreground')
  })
})
