/**
 * Unit tests for the design-system token contract (R-DS-01, R-DS-02).
 *
 * Pure file inspection (node env): the @theme block in tailwind.css MUST define
 * the complete shadcn semantic token set in OKLCH, dark by default, with a base
 * layer that applies background/foreground to <body>.
 *
 * Scenarios:
 *   T-110-01: all 19 semantic --color-* tokens are defined, each via oklch(
 *   T-110-02: --color-primary (and -foreground) is preserved (not removed)
 *   T-110-03: a base layer sets body background-color + color from tokens
 *   T-110-04: default border-color is set from --color-border (so bare `border` is themed)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REQUIRED_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
] as const

describe('design-system tokens (R-DS-01, R-DS-02)', () => {
  let css: string

  beforeAll(() => {
    css = readFileSync(resolve(process.cwd(), 'app/assets/css/tailwind.css'), 'utf-8')
  })

  it('T-110-01: defines all 19 semantic --color-* tokens via oklch()', () => {
    for (const token of REQUIRED_TOKENS) {
      // Match e.g. `--color-card-foreground: oklch(...)` allowing arbitrary whitespace
      const re = new RegExp(`--color-${token}\\s*:\\s*oklch\\(`)
      expect(css, `missing oklch token --color-${token}`).toMatch(re)
    }
  })

  it('T-110-02: preserves --color-primary and --color-primary-foreground', () => {
    expect(css).toMatch(/--color-primary\s*:\s*oklch\(/)
    expect(css).toMatch(/--color-primary-foreground\s*:\s*oklch\(/)
  })

  it('T-110-03: base layer applies background-color and color to body from tokens', () => {
    expect(css).toMatch(/@layer\s+base/)
    expect(css).toMatch(/background-color:\s*var\(--color-background\)/)
    expect(css).toMatch(/color:\s*var\(--color-foreground\)/)
  })

  it('T-110-04: default border-color comes from --color-border', () => {
    expect(css).toMatch(/border-color:\s*var\(--color-border\)/)
  })
})
