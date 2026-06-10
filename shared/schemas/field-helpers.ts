import { z } from 'zod'

export const trimmedRequired = (label: string, max: number) =>
  z.string().trim().min(1, `${label} required`).max(max, `${label} too long`)

// Like trimmedRequired, but also rejects strings made up entirely of
// punctuation/symbols/whitespace (e.g. ".,&#@#"). At least one Unicode
// letter or number must be present so display names stay meaningful.
export const nameRequired = (label: string, max: number) =>
  trimmedRequired(label, max).regex(/[\p{L}\p{N}]/u, `${label} must contain a letter or number`)

export const trimmedOptional = (label: string, max: number) =>
  z.string().trim().max(max, `${label} too long`)
