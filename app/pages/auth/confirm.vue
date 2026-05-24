<script setup lang="ts">
/**
 * Auth callback handler — R-AUTH-06, R-AUTH-07, S-AUTH-10, R-AUTH-11
 *
 * Handles three cases (evaluated in order):
 *   1. PKCE / OAuth (Google): ?code=<pkce_code> → exchangeCodeForSession
 *   2. Admin invite: ?token_hash=<hash>&type=invite → verifyOtp (R-AUTH-11)
 *   3. Fallback: redirect silently to /auth/login (S-AUTH-10)
 *
 * Redirect priority (cases 1 and 2 on success):
 *   a. ?next= if it passes isSafeNext() validation
 *   b. useSupabaseCookieRedirect().pluck() if non-null
 *   c. /rooms (fallback)
 */

definePageMeta({
  // Excluded from the redirect guard via redirectOptions.exclude: ['/auth/*']
  layout: false,
})

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()
// useSupabaseCookieRedirect reads the 'sb-redirect-path' cookie set by @nuxtjs/supabase
const cookieRedirect = useSupabaseCookieRedirect()

/**
 * Resolve the post-auth redirect target and navigate to it.
 * Priority: ?next (via isSafeNext) → saved cookie path → /rooms
 * R-AUTH-24 / R-INV-06, R-INV-07 / R-SEC-42
 */
async function resolveAndRedirect() {
  const nextParam = route.query.next
  if (isSafeNext(nextParam)) {
    await router.replace(nextParam)
    return
  }
  const redirectTo = cookieRedirect.pluck() ?? '/rooms'
  await router.replace(redirectTo)
}

onMounted(async () => {
  // --- Branch 1: PKCE / OAuth ---
  const code = route.query.code as string | undefined

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      await router.replace('/auth/login')
      return
    }

    await resolveAndRedirect()
    return
  }

  // --- Branch 2: Admin invite via token_hash (R-AUTH-11) ---
  // Evaluated AFTER the PKCE branch. Guard: token_hash must be a string AND type must be 'invite'.
  const tokenHash = route.query.token_hash
  const otpType = route.query.type

  if (typeof tokenHash === 'string' && otpType === 'invite') {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'invite',
    })

    if (error) {
      await router.replace('/auth/login')
      return
    }

    await resolveAndRedirect()
    return
  }

  // --- Branch 3: Fallback — no recognisable auth params (S-AUTH-10) ---
  await router.replace('/auth/login')
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <p class="text-sm text-muted-foreground">
      Verificando sesión…
    </p>
  </div>
</template>
