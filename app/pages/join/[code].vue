<script setup lang="ts">
import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import type { RoomPreview } from '#shared/types/rooms'

definePageMeta({
  layout: false,
})

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const roomClient = useRoom()
const config = useRuntimeConfig()
const requestUrl = useRequestURL()

const code = route.params.code as string

const email = ref('')
const displayName = ref('')
const magicLinkSent = ref(false)
const isAuthLoading = ref(false)

const isJoining = ref(false)
const joinError = ref<string | null>(null)

function nextUrl() {
  return `${window.location.origin}/auth/confirm?next=/join/${code}`
}

function fetchStatus(err: unknown): number | null {
  const e = err as { statusCode?: number, status?: number, response?: { status?: number } }
  return e?.statusCode ?? e?.status ?? e?.response?.status ?? null
}

// SSR-fetched so social scrapers (WhatsApp/Telegram/etc.) and meta tags get the room preview.
const { data: _previewData, error: previewErr, status: previewStatus } = await useAsyncData<RoomPreview>(
  `room-preview-${code}`,
  () => roomClient.previewByCode(code) as Promise<RoomPreview>,
)
const preview = _previewData as Ref<RoomPreview | null>

const isLoadingPreview = computed(() => previewStatus.value === 'pending')
const previewNotFound = computed(() => !!previewErr.value && fetchStatus(previewErr.value) === 404)
const previewError = computed(() => {
  if (!previewErr.value || previewNotFound.value) return null
  return previewErr.value instanceof Error ? previewErr.value.message : 'No se pudo cargar la sala'
})

const origin = (config.public.siteUrl as string) || requestUrl.origin

useSeoMeta({
  title: () => (preview.value ? preview.value.roomName : 'Unirse a una sala'),
  description: () => (preview.value
    ? `${preview.value.creatorName} te invitó a su quiniela "${preview.value.roomName}" en Wings Cup. Sumate y demostrá quién sabe más de fútbol.`
    : 'Sumate a la quiniela entre amigos en Wings Cup.'),
  ogTitle: () => (preview.value ? `Te invitaron a "${preview.value.roomName}"` : 'Unite a Wings Cup'),
  ogDescription: () => (preview.value
    ? `${preview.value.creatorName} te invitó a su quiniela en Wings Cup. Pronosticá los partidos y competí con tus amigos.`
    : 'Sumate a la quiniela entre amigos en Wings Cup.'),
  ogUrl: `${origin}/join/${code}`,
  robots: 'noindex, nofollow',
})

async function autoJoin() {
  if (!user.value || !preview.value || isJoining.value) return
  isJoining.value = true
  joinError.value = null
  try {
    const result = await roomClient.joinByCode(code, { provider: 'google' })
    if (!result) return
    await router.replace(`/rooms/${result.roomId}`)
  }
  catch (e) {
    joinError.value = e instanceof Error ? e.message : 'No se pudo entrar a la sala'
    isJoining.value = false
  }
}

async function sendMagicLink() {
  if (!email.value.trim() || !displayName.value.trim()) return
  isAuthLoading.value = true
  joinError.value = null
  try {
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.value.trim(),
      options: {
        emailRedirectTo: nextUrl(),
        data: { display_name: displayName.value.trim() },
      },
    })
    if (otpError) throw otpError
    magicLinkSent.value = true
  }
  catch (e) {
    joinError.value = e instanceof Error ? e.message : 'No se pudo enviar el enlace mágico'
  }
  finally {
    isAuthLoading.value = false
  }
}

async function signInWithGoogle() {
  isAuthLoading.value = true
  joinError.value = null
  try {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: nextUrl() },
    })
    if (oauthError) throw oauthError
  }
  catch (e) {
    joinError.value = e instanceof Error ? e.message : 'No se pudo iniciar sesión con Google'
    isAuthLoading.value = false
  }
}

onMounted(async () => {
  if (user.value && preview.value) {
    await autoJoin()
  }
})

watch(user, (next) => {
  if (next && preview.value && !isJoining.value) {
    autoJoin()
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-sm space-y-6">
      <p
        v-if="isLoadingPreview"
        class="text-center text-sm text-muted-foreground"
      >
        Cargando…
      </p>

      <template v-else-if="previewNotFound">
        <div class="text-center space-y-2">
          <h1 class="text-xl font-semibold">
            Sala no encontrada
          </h1>
          <p class="text-sm text-muted-foreground">
            El código <span class="font-mono">{{ code }}</span> no corresponde a ninguna sala activa.
          </p>
        </div>
      </template>

      <template v-else-if="previewError">
        <div class="text-center space-y-2">
          <h1 class="text-xl font-semibold">
            No se pudo cargar la sala
          </h1>
          <p
            class="text-sm text-destructive"
            role="alert"
          >
            {{ previewError }}
          </p>
        </div>
      </template>

      <template v-else-if="preview">
        <header class="text-center space-y-1">
          <h1 class="text-2xl font-bold tracking-tight">
            {{ preview.roomName }}
          </h1>
          <p class="text-sm text-muted-foreground">
            Te invitó <span class="font-medium text-foreground">{{ preview.creatorName }}</span>
          </p>
          <p
            v-if="!preview.isActive"
            class="text-xs text-destructive"
          >
            Esta sala está archivada — no se puede unir.
          </p>
        </header>

        <template v-if="preview.isActive">
          <div
            v-if="isJoining"
            class="text-center text-sm text-muted-foreground"
          >
            Entrando a la sala…
          </div>

          <div
            v-else-if="!user"
            class="space-y-4"
          >
            <Button
              type="button"
              variant="outline"
              class="w-full"
              :disabled="isAuthLoading"
              @click="signInWithGoogle"
            >
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
                  :disabled="isAuthLoading"
                />
                <Input
                  v-model="displayName"
                  placeholder="Tu nombre (cómo te van a ver)"
                  maxlength="50"
                  required
                  :disabled="isAuthLoading"
                />
                <Button
                  type="submit"
                  class="w-full"
                  :disabled="isAuthLoading || !email.trim() || !displayName.trim()"
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
            </template>
          </div>
        </template>

        <p
          v-if="joinError"
          class="text-center text-sm text-destructive"
          role="alert"
        >
          {{ joinError }}
        </p>
      </template>
    </div>
  </div>
</template>
