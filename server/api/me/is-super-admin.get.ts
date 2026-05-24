import { requireSuperAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    await requireSuperAdmin(event)
    return { isSuperAdmin: true }
  } catch {
    return { isSuperAdmin: false }
  }
})
