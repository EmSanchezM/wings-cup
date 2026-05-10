<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

definePageMeta({
  // This page is excluded from the redirect guard via redirectOptions.exclude: ['/auth/*']
  // Authenticated users visiting /auth/login are NOT force-redirected away.
  layout: false,
})

const supabase = useSupabaseClient()

const email = ref('')
const magicLinkSent = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

/**
 * R-AUTH-09: "Sign in with Google" calls signInWithOAuth with redirectTo pointing at /auth/confirm.
 * The PKCE exchange happens in confirm.vue.
 */
async function signInWithGoogle() {
  error.value = null
  isLoading.value = true
  try {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/confirm`,
      },
    })
    if (oauthError) throw oauthError
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al iniciar sesión con Google'
  }
  finally {
    isLoading.value = false
  }
}

/**
 * R-AUTH-13: Magic link uses signInWithOtp with emailRedirectTo pointing at /auth/confirm.
 * On first sign-in the handle_new_user trigger creates a profiles row with is_guest = true.
 */
async function sendMagicLink() {
  if (!email.value.trim()) return
  error.value = null
  isLoading.value = true
  try {
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.value.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })
    if (otpError) throw otpError
    magicLinkSent.value = true
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al enviar el enlace mágico'
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">
          Wings Cup
        </h1>
        <p class="text-sm text-muted-foreground">
          Inicia sesión para continuar
        </p>
      </div>

      <div class="space-y-4">
        <!-- Google OAuth — R-AUTH-09 -->
        <Button
          type="button"
          variant="outline"
          class="w-full"
          :disabled="isLoading"
          @click="signInWithGoogle"
        >
          <svg
            class="mr-2 h-4 w-4"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continuar con Google
        </Button>

        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <span class="w-full border-t" />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-background px-2 text-muted-foreground">o</span>
          </div>
        </div>

        <!-- Magic link form — R-AUTH-13 -->
        <template v-if="!magicLinkSent">
          <form
            class="space-y-3"
            @submit.prevent="sendMagicLink"
          >
            <Input
              v-model="email"
              type="email"
              placeholder="tu@email.com"
              autocomplete="email"
              required
              :disabled="isLoading"
            />
            <Button
              type="submit"
              class="w-full"
              :disabled="isLoading || !email.trim()"
            >
              Enviar enlace mágico
            </Button>
          </form>
        </template>

        <template v-else>
          <p class="text-center text-sm text-muted-foreground">
            Revisá tu correo — te enviamos un enlace para ingresar a
            <span class="font-medium text-foreground">{{ email }}</span>.
          </p>
          <Button
            type="button"
            variant="ghost"
            class="w-full text-xs"
            @click="magicLinkSent = false"
          >
            Usar otro email
          </Button>
        </template>

        <p
          v-if="error"
          class="text-center text-sm text-destructive"
          role="alert"
        >
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>
