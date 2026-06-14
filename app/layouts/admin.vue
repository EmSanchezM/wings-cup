<script setup lang="ts">
import { computed, ref } from 'vue'
import { Shield, LogOut, ArrowLeft, CalendarClock } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()
const router = useRouter()

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

const sections = [
  { label: 'Partidos', to: '/admin/matches', icon: CalendarClock },
]

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(`${to}/`)
}

async function logout() {
  await supabase.auth.signOut()
  await router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <header class="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div class="flex items-center gap-2.5">
          <NuxtLink
            to="/rooms"
            class="flex items-center gap-2 text-lg font-bold tracking-tight"
          >
            <WingLogo class="size-6" />
            <span>Wings <span class="text-primary">Cup</span></span>
          </NuxtLink>
          <Badge
            variant="accent"
            class="gap-1"
          >
            <Shield class="size-3" />
            ADMIN
          </Badge>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <Button
            as-child
            variant="ghost"
            size="sm"
          >
            <NuxtLink to="/rooms">
              <ArrowLeft class="size-4" />
              <span class="hidden sm:inline">Volver a la app</span>
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

      <!-- Admin section bar -->
      <nav class="border-t border-border bg-card/30">
        <div class="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 sm:px-8">
          <NuxtLink
            v-for="section in sections"
            :key="section.to"
            :to="section.to"
            class="flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
            :class="isActive(section.to)
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'"
          >
            <component
              :is="section.icon"
              class="size-4"
            />
            {{ section.label }}
          </NuxtLink>
        </div>
      </nav>
    </header>

    <slot />
  </div>
</template>
