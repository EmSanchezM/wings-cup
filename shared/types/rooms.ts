import type { Tables } from './database.types'

export type Room = Tables<'rooms'>
export type RoomMember = Tables<'room_members'>

/**
 * A room member enriched with the display name from the joined profiles row.
 * Returned by getRoomHandler so the UI can show names instead of raw user ids.
 */
export interface RoomMemberView {
  user_id: string
  role: string
  joined_at: string
  display_name: string
}

export type RoomListItem = Pick<
  Room,
  'id' | 'name' | 'prize_description' | 'invite_code' | 'status' | 'created_at'
>

export interface RoomPreview {
  roomName: string
  creatorName: string
  isActive: boolean
}

export type { CreateRoomInput, UpdateRoomInput } from '../schemas/room.schema'
export type { JoinPayload } from '../schemas/join.schema'
