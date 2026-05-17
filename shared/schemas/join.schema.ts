import { z } from 'zod'
import { trimmedRequired } from './field-helpers'

const magicLinkSchema = z.object({
  provider: z.literal('magic_link'),
  email: z.string().email('invalid email'),
  display_name: trimmedRequired('display_name', 50),
})

const googleSchema = z.object({
  provider: z.literal('google'),
})

export const joinPayloadSchema = z.discriminatedUnion('provider', [
  magicLinkSchema,
  googleSchema,
])

export type JoinPayload = z.infer<typeof joinPayloadSchema>
