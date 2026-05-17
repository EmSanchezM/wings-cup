import { describe, it, expect } from 'vitest'
import { joinPayloadSchema } from '../../shared/schemas/join.schema'

describe('joinPayloadSchema (R-INV-09 / design §4.3)', () => {
  describe('magic_link branch', () => {
    it('accepts a valid magic-link payload', () => {
      const result = joinPayloadSchema.parse({
        provider: 'magic_link',
        email: 'a@b.com',
        display_name: 'Pepe',
      })
      expect(result).toMatchObject({
        provider: 'magic_link',
        email: 'a@b.com',
        display_name: 'Pepe',
      })
    })

    it('trims whitespace from display_name', () => {
      const result = joinPayloadSchema.parse({
        provider: 'magic_link',
        email: 'a@b.com',
        display_name: '  Pepe  ',
      })
      if (result.provider !== 'magic_link') throw new Error('wrong branch')
      expect(result.display_name).toBe('Pepe')
    })

    it('rejects empty display_name', () => {
      expect(() =>
        joinPayloadSchema.parse({
          provider: 'magic_link',
          email: 'a@b.com',
          display_name: '',
        }),
      ).toThrow()
    })

    it('rejects whitespace-only display_name (empty after trim)', () => {
      expect(() =>
        joinPayloadSchema.parse({
          provider: 'magic_link',
          email: 'a@b.com',
          display_name: '   ',
        }),
      ).toThrow()
    })

    it('rejects missing display_name', () => {
      expect(() =>
        joinPayloadSchema.parse({
          provider: 'magic_link',
          email: 'a@b.com',
        }),
      ).toThrow()
    })

    it('rejects invalid email', () => {
      expect(() =>
        joinPayloadSchema.parse({
          provider: 'magic_link',
          email: 'not-an-email',
          display_name: 'Pepe',
        }),
      ).toThrow()
    })

    it('accepts display_name of exactly 50 characters', () => {
      const result = joinPayloadSchema.parse({
        provider: 'magic_link',
        email: 'a@b.com',
        display_name: 'x'.repeat(50),
      })
      if (result.provider !== 'magic_link') throw new Error('wrong branch')
      expect(result.display_name).toHaveLength(50)
    })

    it('rejects display_name longer than 50 characters', () => {
      expect(() =>
        joinPayloadSchema.parse({
          provider: 'magic_link',
          email: 'a@b.com',
          display_name: 'x'.repeat(51),
        }),
      ).toThrow()
    })
  })

  describe('google branch', () => {
    it('accepts a google payload with no extra fields', () => {
      const result = joinPayloadSchema.parse({ provider: 'google' })
      expect(result.provider).toBe('google')
    })

    it('does not require display_name on google branch', () => {
      expect(() => joinPayloadSchema.parse({ provider: 'google' })).not.toThrow()
    })
  })

  describe('discriminator', () => {
    it('rejects an unknown provider', () => {
      expect(() =>
        joinPayloadSchema.parse({ provider: 'facebook' }),
      ).toThrow()
    })

    it('rejects a missing provider', () => {
      expect(() => joinPayloadSchema.parse({})).toThrow()
    })
  })
})
