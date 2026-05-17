import { makeRoomClient } from '../utils/room-client'

export function useRoom() {
  return makeRoomClient($fetch)
}
