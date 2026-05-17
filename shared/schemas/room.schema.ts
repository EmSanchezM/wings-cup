import { z } from 'zod'
import { trimmedOptional, trimmedRequired } from './field-helpers'

export const createRoomSchema = z.object({
  name: trimmedRequired('name', 100),
  prize_description: trimmedOptional('prize_description', 500).default(''),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>
