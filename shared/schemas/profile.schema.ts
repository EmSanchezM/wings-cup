import { z } from 'zod'
import { nameRequired } from './field-helpers'

// display_name is the only user-editable profile field. avatar_url and the
// auth fields (email, provider) are out of scope for self-service editing.
export const updateProfileSchema = z.object({
  display_name: nameRequired('display_name', 50),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
