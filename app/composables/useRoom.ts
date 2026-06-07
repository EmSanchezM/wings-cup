import { makeRoomClient } from '~/utils/room-client'

/**
 * useRoom — wraps makeRoomClient with 401-aware error handling (R-UX-03).
 *
 * On 401 → calls useSessionExpired().setExpired() and returns undefined
 * (does not throw). All other errors propagate as before.
 *
 * Accepts an optional fetchImpl for testability; defaults to the Nuxt global $fetch.
 */
export function useRoom(fetchImpl?: typeof $fetch) {
  const client = makeRoomClient(fetchImpl ?? $fetch)
  const { setExpired } = useSessionExpired()

  // Wrap a client method with 401 detection.
  // On 401: calls setExpired() and returns undefined.
  // On any other error: re-throws so callers can handle it.
  async function with401Guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn()
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 401) {
        setExpired()
        return undefined
      }
      throw err
    }
  }

  return {
    createRoom: (input: Parameters<typeof client.createRoom>[0]) =>
      with401Guard(() => client.createRoom(input)),
    listRooms: () => with401Guard(() => client.listRooms()),
    getRoom: (id: string) => with401Guard(() => client.getRoom(id)),
    previewByCode: (code: string) => with401Guard(() => client.previewByCode(code)),
    joinByCode: (
      code: string,
      payload: Parameters<typeof client.joinByCode>[1],
    ) => with401Guard(() => client.joinByCode(code, payload)),
  }
}
