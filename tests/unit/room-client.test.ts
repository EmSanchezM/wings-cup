import { describe, it, expect, vi } from 'vitest'
import { makeRoomClient } from '../../app/utils/room-client'

type MockFetch = ReturnType<typeof vi.fn>

function setup(mockFetch: MockFetch = vi.fn()) {
  const client = makeRoomClient(mockFetch as unknown as typeof $fetch)
  return { client, mockFetch }
}

describe('makeRoomClient (R-ROOMS-01, R-ROOMS-02, R-ROOMS-03, R-INV-03, R-INV-04)', () => {
  describe('createRoom', () => {
    it('POSTs to /api/rooms with the input body and returns the room', async () => {
      const room = { id: 'r1', name: 'Amigos', prize_description: '', invite_code: 'AB12CD', status: 'active', created_at: '2026-05-17T12:00:00Z', created_by: 'u1', scoring_rules: {} }
      const mockFetch = vi.fn().mockResolvedValue({ room })
      const { client } = setup(mockFetch)

      const result = await client.createRoom({ name: 'Amigos', prize_description: '' })

      expect(mockFetch).toHaveBeenCalledWith('/api/rooms', {
        method: 'POST',
        body: { name: 'Amigos', prize_description: '' },
      })
      expect(result).toEqual(room)
    })

    it('propagates fetch errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('500'))
      const { client } = setup(mockFetch)
      await expect(
        client.createRoom({ name: 'X', prize_description: '' }),
      ).rejects.toThrow('500')
    })
  })

  describe('listRooms', () => {
    it('GETs /api/rooms and returns the rooms array', async () => {
      const rooms = [
        { id: 'r1', name: 'X', prize_description: '', invite_code: 'AB12CD', status: 'active', created_at: '2026-05-17T12:00:00Z' },
      ]
      const mockFetch = vi.fn().mockResolvedValue({ rooms })
      const { client } = setup(mockFetch)

      const result = await client.listRooms()

      expect(mockFetch).toHaveBeenCalledWith('/api/rooms')
      expect(result).toEqual(rooms)
    })
  })

  describe('getRoom', () => {
    it('GETs /api/rooms/[id] and returns { room, members }', async () => {
      const payload = {
        room: { id: 'r1', name: 'X', prize_description: '', invite_code: 'AB12CD', status: 'active', created_at: '2026-05-17T12:00:00Z', created_by: 'u1', scoring_rules: {} },
        members: [{ room_id: 'r1', user_id: 'u1', role: 'owner', total_points: 0, joined_at: '2026-05-17T12:00:00Z' }],
      }
      const mockFetch = vi.fn().mockResolvedValue(payload)
      const { client } = setup(mockFetch)

      const result = await client.getRoom('r1')

      expect(mockFetch).toHaveBeenCalledWith('/api/rooms/r1')
      expect(result).toEqual(payload)
    })
  })

  describe('previewByCode', () => {
    it('GETs /api/join/[code] and returns the RoomPreview', async () => {
      const preview = { roomName: 'X', creatorName: 'Y', isActive: true }
      const mockFetch = vi.fn().mockResolvedValue(preview)
      const { client } = setup(mockFetch)

      const result = await client.previewByCode('AB12CD')

      expect(mockFetch).toHaveBeenCalledWith('/api/join/AB12CD')
      expect(result).toEqual(preview)
    })
  })

  describe('joinByCode', () => {
    it('POSTs to /api/join/[code] with the magic-link payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ roomId: 'r1' })
      const { client } = setup(mockFetch)

      const result = await client.joinByCode('AB12CD', {
        provider: 'magic_link',
        email: 'a@b.com',
        display_name: 'Pepe',
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/join/AB12CD', {
        method: 'POST',
        body: { provider: 'magic_link', email: 'a@b.com', display_name: 'Pepe' },
      })
      expect(result).toEqual({ roomId: 'r1' })
    })

    it('POSTs to /api/join/[code] with a google payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ roomId: 'r1' })
      const { client } = setup(mockFetch)

      await client.joinByCode('AB12CD', { provider: 'google' })

      expect(mockFetch).toHaveBeenCalledWith('/api/join/AB12CD', {
        method: 'POST',
        body: { provider: 'google' },
      })
    })
  })
})
