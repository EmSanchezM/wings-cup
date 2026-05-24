/**
 * useSessionExpired — session-expired singleton (R-UX-01)
 *
 * Backed by useState('session-expired') so the flag is shared across all
 * composable call sites and survives SSR hydration without duplication.
 *
 * Exposes:
 *   isExpired  — Readonly<Ref<boolean>> — starts false
 *   setExpired — marks the session as expired (triggers toast)
 *   reset      — clears the flag before navigating to login
 */
export function useSessionExpired() {
  const state = useState<boolean>('session-expired', () => false)

  function setExpired() {
    state.value = true
  }

  function reset() {
    state.value = false
  }

  return {
    isExpired: readonly(state),
    setExpired,
    reset,
  }
}
