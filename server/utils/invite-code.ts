import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/types/database.types'

export class InviteCodeCollisionError extends Error {
  readonly code = 'INVITE_CODE_COLLISION' as const
  constructor(public readonly attempts: number) {
    super(`Failed to generate a unique invite code after ${attempts} attempts`)
  }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CODE_LENGTH = 6

export function buildCandidate(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let candidate = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    // bytes[i] is defined because i < CODE_LENGTH and getRandomValues filled the array.
    let byte = bytes[i]!
    // Rejection-sample bytes >= 252 to avoid modulo bias (256 % 36 != 0).
    while (byte >= 252) {
      const replacement = new Uint8Array(1)
      crypto.getRandomValues(replacement)
      byte = replacement[0]!
    }
    candidate += ALPHABET[byte % ALPHABET.length]
  }
  return candidate
}

export async function generateInviteCode(
  supabase: SupabaseClient<Database>,
  retries = 3,
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const candidate = buildCandidate()
    const { data, error } = await supabase
      .from('rooms')
      .select('invite_code')
      .eq('invite_code', candidate)
      .maybeSingle()
    if (error) throw error
    if (!data) return candidate
  }
  throw new InviteCodeCollisionError(retries)
}
