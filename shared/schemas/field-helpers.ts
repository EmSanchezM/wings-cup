import { z } from 'zod'

export const trimmedRequired = (label: string, max: number) =>
  z.string().trim().min(1, `${label} required`).max(max, `${label} too long`)

export const trimmedOptional = (label: string, max: number) =>
  z.string().trim().max(max, `${label} too long`)
