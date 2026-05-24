import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../shared/types/database.types'
import { writeAuditLog } from './audit-log'

export interface LockStartedPredictionsDeps {
  supabaseService: SupabaseClient<Database>
  adminId: string
}

export async function lockStartedPredictionsHandler(
  deps: LockStartedPredictionsDeps,
): Promise<{ locked: number }> {
  const { data, error } = await deps.supabaseService.rpc('lock_started_predictions')
  if (error) throw new Error(error.message)

  const locked = typeof data === 'number' ? data : 0

  await writeAuditLog(deps.supabaseService, {
    admin_id: deps.adminId,
    action: 'predictions.lock_started',
    target_type: 'prediction',
    target_id: null,
    after_value: { locked_count: locked },
  })

  return { locked }
}
