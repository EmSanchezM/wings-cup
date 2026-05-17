import type { CreateRoomInput } from '../../shared/schemas/room.schema'
import type { JoinPayload } from '../../shared/schemas/join.schema'
import type {
  Room,
  RoomListItem,
  RoomMember,
  RoomPreview,
} from '../../shared/types/rooms'

export function makeRoomClient(fetchImpl: typeof $fetch) {
  return {
    async createRoom(input: CreateRoomInput): Promise<Room> {
      const { room } = await fetchImpl<{ room: Room }>('/api/rooms', {
        method: 'POST',
        body: input,
      })
      return room
    },

    async listRooms(): Promise<RoomListItem[]> {
      const { rooms } = await fetchImpl<{ rooms: RoomListItem[] }>('/api/rooms')
      return rooms
    },

    async getRoom(id: string): Promise<{ room: Room; members: RoomMember[] }> {
      return fetchImpl<{ room: Room; members: RoomMember[] }>(`/api/rooms/${id}`)
    },

    async previewByCode(code: string): Promise<RoomPreview> {
      return fetchImpl<RoomPreview>(`/api/join/${code}`)
    },

    async joinByCode(
      code: string,
      payload: JoinPayload,
    ): Promise<{ roomId: string }> {
      return fetchImpl<{ roomId: string }>(`/api/join/${code}`, {
        method: 'POST',
        body: payload,
      })
    },
  }
}
