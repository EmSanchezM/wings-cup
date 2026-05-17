import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../shared/types/database.types'

export interface AuditLogRow {
  admin_id: string
  action: string
  target_type: string
  target_id?: string | null
  before_value?: Json | null
  after_value?: Json | null
}

export async function writeAuditLog(
  client: SupabaseClient<Database>,
  row: AuditLogRow,
): Promise<void> {
  const { error } = await client.from('audit_log').insert(row)
  if (error) throw new Error(error.message)
}
