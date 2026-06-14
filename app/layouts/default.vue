<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { LogOut, Shield } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

const { isSuperAdmin, ensure: ensureSuperAdmin } = useSuperAdmin()
onMounted(() => {
  void ensureSuperAdmin()
})

const email = computed(() => {
  const u = user.value as { email?: string } | null
  return u?.email ?? ''
})

const initials = computed(() => {
  const handle = email.value.split('@')[0] ?? ''
  return handle.slice(0, 2).toUpperCase() || '··'
})

// OAuth providers (e.g. Google) expose the profile picture via user metadata.
const avatarUrl = computed(() => {
  const u = user.value as { user_metadata?: { avatar_url?: string, picture?: string } } | null
  return u?.user_metadata?.avatar_url ?? u?.user_metadata?.picture ?? ''
})

// Fall back to initials if the user has no photo or the image fails to load.
const avatarFailed = ref(false)
const showAvatar = computed(() => avatarUrl.value !== '' && !avatarFailed.value)

async function logout() {
  await supabase.auth.signOut()
  await router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <header class="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <NuxtLink
          to="/rooms"
          class="flex items-center gap-2 text-lg font-bold tracking-tight"
        >
          <WingLogo class="size-6" />
          <span>Wings <span class="text-primary">Cup</span></span>
        </NuxtLink>

        <div class="flex items-center gap-2 sm:gap-3">
          <Button
            v-if="isSuperAdmin"
            as-child
            variant="outline"
            size="sm"
          >
            <NuxtLink to="/admin/matches">
              <Shield class="size-4" />
              <span class="hidden sm:inline">Admin</span>
            </NuxtLink>
          </Button>
          <NuxtLink
            to="/profile"
            class="flex size-8 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Tu perfil"
          >
            <img
              v-if="showAvatar"
              :src="avatarUrl"
              alt=""
              referrerpolicy="no-referrer"
              class="size-full object-cover"
              data-testid="nav-avatar-img"
              @error="avatarFailed = true"
            >
            <span
              v-else
              data-testid="nav-avatar-initials"
            >{{ initials }}</span>
          </NuxtLink>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cerrar sesión"
            @click="logout"
          >
            <LogOut class="size-4" />
          </Button>
        </div>
      </div>
    </header>

    <slot />
  </div>
</template>
