<script setup lang="ts">
/**
 * PKCE callback handler — R-AUTH-06, R-AUTH-07, S-AUTH-10
 *
 * Handles two cases:
 *   1. OAuth (Google): Supabase redirects here with ?code=<pkce_code> in the query string.
 *   2. Magic link: Supabase redirects here with the token_hash in the URL fragment or query.
 *
 * Flow:
 *   - Read `code` from the URL query string.
 *   - If present: exchange via exchangeCodeForSession(code).
 *   - Redirect to the saved cookie path (via useSupabaseCookieRedirect) or default to /rooms.
 *   - If no code: redirect silently to /auth/login (S-AUTH-10).
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

onMounted(async () => {
  const code = route.query.code as string | undefined

  if (!code) {
    // S-AUTH-10: no code — redirect to login silently
    await router.replace('/auth/login')
    return
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    await router.replace('/auth/login')
    return
  }

  // R-AUTH-24 / R-INV-06: honour ?next= when it points at a join page,
  // otherwise fall back to the saved cookie path or /rooms.
  // isSafeNext rejects open-redirects, lowercase codes, and shape mismatches (R-INV-07 / R-SEC-42).
  const nextParam = route.query.next
  if (isSafeNext(nextParam)) {
    await router.replace(nextParam)
    return
  }

  const redirectTo = cookieRedirect.pluck() ?? '/rooms'
  await router.replace(redirectTo)
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <p class="text-sm text-muted-foreground">
      Verificando sesión…
    </p>
  </div>
</template>
