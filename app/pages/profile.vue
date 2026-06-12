<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { UserCog, Check } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { updateProfileSchema } from '#shared/schemas/profile.schema'

// Auth enforced by @nuxtjs/supabase redirectOptions (covers /profile).
const profileClient = useProfile()
const user = useSupabaseUser()

const displayName = ref('')
const email = ref('')
const isLoading = ref(false)
const isSubmitting = ref(false)
const error = ref<string | null>(null)
const saved = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | null = null

const emailValue = () => {
  const u = user.value as { email?: string } | null
  return u?.email ?? ''
}

async function loadProfile() {
  isLoading.value = true
  error.value = null
  email.value = emailValue()
  try {
    const profile = await profileClient.getProfile()
    if (!profile) return // 401: toast handles UX
    displayName.value = profile.display_name
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar tu perfil'
  }
  finally {
    isLoading.value = false
  }
}

async function handleSave() {
  saved.value = false
  const parsed = updateProfileSchema.safeParse({ display_name: displayName.value })
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Datos inválidos'
    return
  }

  isSubmitting.value = true
  error.value = null
  try {
    const profile = await profileClient.updateProfile(parsed.data)
    if (!profile) return // 401: toast handles UX
    displayName.value = profile.display_name
    saved.value = true
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = setTimeout(() => {
      saved.value = false
    }, 2500)
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar tu perfil'
  }
  finally {
    isSubmitting.value = false
  }
}

onMounted(loadProfile)
onUnmounted(() => {
  if (savedTimer) clearTimeout(savedTimer)
})
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="mx-auto w-full max-w-xl space-y-8">
      <header class="flex items-start gap-4">
        <span class="hidden size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
          <UserCog class="size-6" />
        </span>
        <div class="space-y-1">
          <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
            Tu <span class="text-primary">Perfil</span>
          </h1>
          <p class="text-sm text-muted-foreground sm:text-base">
            Cambiá el nombre con el que te ven el resto de los participantes.
          </p>
        </div>
      </header>

      <section class="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div class="space-y-2">
          <label
            for="profile-email"
            class="text-sm font-medium text-muted-foreground"
          >
            Email
          </label>
          <Input
            id="profile-email"
            :model-value="email"
            disabled
            readonly
          />
          <p class="text-xs text-muted-foreground">
            El email está vinculado a tu cuenta y no se puede cambiar acá.
          </p>
        </div>

        <div class="space-y-2">
          <label
            for="profile-name"
            class="text-sm font-medium"
          >
            Nombre para mostrar
          </label>
          <Input
            id="profile-name"
            v-model="displayName"
            placeholder="ej. Stiven Ruben Sanchez"
            maxlength="50"
            :disabled="isLoading"
            @keydown.enter.prevent="handleSave"
          />
          <p class="text-xs text-muted-foreground">
            Es el nombre que aparece en las salas y la tabla de posiciones.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <Button
            type="button"
            :disabled="isLoading || isSubmitting"
            @click="handleSave"
          >
            {{ isSubmitting ? 'Guardando…' : 'Guardar cambios' }}
          </Button>
          <span
            v-if="saved"
            class="flex items-center gap-1.5 text-sm text-primary"
            role="status"
          >
            <Check class="size-4" />
            Guardado
          </span>
        </div>

        <p
          v-if="error"
          class="text-sm text-destructive"
          role="alert"
        >
          {{ error }}
        </p>
      </section>
    </div>
  </div>
</template>
