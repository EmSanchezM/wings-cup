/**
 * useSuperAdmin — exposes whether the current user is a super admin, cached for
 * the session via useState so the nav (and any page) can read it without each
 * call re-hitting /api/me/is-super-admin.
 *
 * The admin pages keep their own authoritative gate (which distinguishes
 * forbidden vs unauthenticated); this composable only drives presentational
 * affordances like the "Admin" nav link.
 */
export function useSuperAdmin() {
  const isSuperAdmin = useState<boolean | null>('is-super-admin', () => null)
  const pending = useState<boolean>('is-super-admin-pending', () => false)

  async function ensure(): Promise<boolean> {
    if (isSuperAdmin.value !== null) return isSuperAdmin.value
    if (pending.value) return false
    pending.value = true
    try {
      const { isSuperAdmin: admin } = await $fetch<{
        isSuperAdmin: boolean
        reason: 'authorized' | 'forbidden' | 'unauthenticated'
      }>('/api/me/is-super-admin')
      isSuperAdmin.value = !!admin
    }
    catch {
      isSuperAdmin.value = false
    }
    finally {
      pending.value = false
    }
    return isSuperAdmin.value ?? false
  }

  return { isSuperAdmin, ensure }
}
