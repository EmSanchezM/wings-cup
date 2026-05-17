import { describe, it, expect } from 'vitest'
import { isSafeNext } from '../../app/utils/is-safe-next'

describe('isSafeNext (R-INV-07, R-SEC-42)', () => {
  describe('accepts', () => {
    it('a canonical /join/[6 A-Z0-9] path', () => {
      expect(isSafeNext('/join/AB12CD')).toBe(true)
    })

    it('a path with all digits', () => {
      expect(isSafeNext('/join/123456')).toBe(true)
    })

    it('a path with all letters', () => {
      expect(isSafeNext('/join/ABCDEF')).toBe(true)
    })
  })

  describe('rejects (threat model)', () => {
    it('an absolute URL to another origin', () => {
      expect(isSafeNext('https://evil.com')).toBe(false)
    })

    it('an absolute URL to another origin with /join/ path', () => {
      expect(isSafeNext('https://evil.com/join/AB12CD')).toBe(false)
    })

    it('a protocol-relative URL', () => {
      expect(isSafeNext('//evil.com')).toBe(false)
    })

    it('a javascript: pseudo-URL', () => {
      expect(isSafeNext('javascript:alert(1)')).toBe(false)
    })

    it('a data: URI', () => {
      expect(isSafeNext('data:text/html,<script>alert(1)</script>')).toBe(false)
    })

    it('a lowercase invite code', () => {
      expect(isSafeNext('/join/ab12cd')).toBe(false)
    })

    it('a mixed-case invite code', () => {
      expect(isSafeNext('/join/Ab12Cd')).toBe(false)
    })

    it('a code shorter than 6 chars', () => {
      expect(isSafeNext('/join/AB12C')).toBe(false)
    })

    it('a code longer than 6 chars', () => {
      expect(isSafeNext('/join/AB12CDE')).toBe(false)
    })

    it('a path with extra segments after the code', () => {
      expect(isSafeNext('/join/AB12CD/extra')).toBe(false)
    })

    it('a path with a trailing slash', () => {
      expect(isSafeNext('/join/AB12CD/')).toBe(false)
    })

    it('a path with query string appended', () => {
      expect(isSafeNext('/join/AB12CD?foo=bar')).toBe(false)
    })

    it('a path with a fragment appended', () => {
      expect(isSafeNext('/join/AB12CD#x')).toBe(false)
    })

    it('a valid path but to a different route', () => {
      expect(isSafeNext('/rooms')).toBe(false)
    })

    it('a code with special characters', () => {
      expect(isSafeNext('/join/AB12@D')).toBe(false)
    })

    it('a code with whitespace', () => {
      expect(isSafeNext('/join/AB 2CD')).toBe(false)
    })

    it('the empty string', () => {
      expect(isSafeNext('')).toBe(false)
    })

    it('null', () => {
      expect(isSafeNext(null)).toBe(false)
    })

    it('undefined', () => {
      expect(isSafeNext(undefined)).toBe(false)
    })

    it('a non-string (number)', () => {
      expect(isSafeNext(42)).toBe(false)
    })

    it('a path-traversal sequence', () => {
      expect(isSafeNext('/join/../etc/passwd')).toBe(false)
    })
  })
})
