import { describe, it, expect } from 'vitest'
import { createRoomSchema } from '../../shared/schemas/room.schema'

describe('createRoomSchema (R-ROOMS-07)', () => {
  it('accepts a minimal valid payload', () => {
    const result = createRoomSchema.parse({ name: 'Test Room' })
    expect(result.name).toBe('Test Room')
  })

  it('defaults prize_description to "" when omitted', () => {
    const result = createRoomSchema.parse({ name: 'Test' })
    expect(result.prize_description).toBe('')
  })

  it('accepts a populated prize_description', () => {
    const result = createRoomSchema.parse({
      name: 'Test',
      prize_description: 'Una birra',
    })
    expect(result.prize_description).toBe('Una birra')
  })

  it('trims whitespace from name', () => {
    const result = createRoomSchema.parse({ name: '  Padding  ' })
    expect(result.name).toBe('Padding')
  })

  it('rejects empty name', () => {
    expect(() => createRoomSchema.parse({ name: '' })).toThrow()
  })

  it('rejects whitespace-only name (empty after trim)', () => {
    expect(() => createRoomSchema.parse({ name: '   ' })).toThrow()
  })

  it('rejects missing name', () => {
    expect(() => createRoomSchema.parse({})).toThrow()
  })

  it('accepts name of exactly 100 characters', () => {
    const result = createRoomSchema.parse({ name: 'x'.repeat(100) })
    expect(result.name).toHaveLength(100)
  })

  it('rejects name longer than 100 characters (R-ROOMS-01 scenario 2)', () => {
    expect(() => createRoomSchema.parse({ name: 'x'.repeat(101) })).toThrow()
  })

  it('accepts prize_description of exactly 500 characters', () => {
    const result = createRoomSchema.parse({
      name: 'OK',
      prize_description: 'x'.repeat(500),
    })
    expect(result.prize_description).toHaveLength(500)
  })

  it('rejects prize_description longer than 500 characters', () => {
    expect(() =>
      createRoomSchema.parse({
        name: 'OK',
        prize_description: 'x'.repeat(501),
      }),
    ).toThrow()
  })
})
