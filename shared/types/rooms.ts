import type { Tables } from './database.types'

export type Room = Tables<'rooms'>
export type RoomMember = Tables<'room_members'>

export type RoomListItem = Pick<
  Room,
  'id' | 'name' | 'prize_description' | 'invite_code' | 'status' | 'created_at'
>

export interface RoomPreview {
  roomName: string
  creatorName: string
  isActive: boolean
}
