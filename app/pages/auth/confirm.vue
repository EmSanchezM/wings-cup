<script setup lang="ts">
definePageMeta({
  // Excluded from the redirect guard via redirectOptions.exclude: ['/auth/*']
  layout: false,
})

useSeoMeta({ title: 'Confirmando…', robots: 'noindex, nofollow' })

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()
const cookieRedirect = useSupabaseCookieRedirect()

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
