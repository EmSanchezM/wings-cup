import { makeProfileClient } from '~/utils/profile-client'

/**
 * useProfile — wraps makeProfileClient with 401-aware error handling,
 * mirroring useRoom (R-UX-03).
 *
 * On 401 → calls useSessionExpired().setExpired() and returns undefined
 * (does not throw). All other errors propagate.
 */
export function useProfile(fetchImpl?: typeof $fetch) {
  const client = makeProfileClient(fetchImpl ?? $fetch)
  const { setExpired } = useSessionExpired()

  async function with401Guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn()
    }
    catch (err) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 401) {
        setExpired()
        return undefined
      }
      throw err
    }
  }

  return {
    getProfile: () => with401Guard(() => client.getProfile()),
    updateProfile: (input: Parameters<typeof client.updateProfile>[0]) =>
      with401Guard(() => client.updateProfile(input)),
  }
}
