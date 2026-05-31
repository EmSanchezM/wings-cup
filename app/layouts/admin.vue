<script setup lang="ts">
import { computed } from 'vue'
import { Trophy, Shield, LogOut, ArrowLeft, CalendarClock } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()
const router = useRouter()

const email = computed(() => {
  const u = user.value as { email?: string } | null
  return u?.email ?? ''
})

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
            <Trophy class="size-5 text-accent" />
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
          <span
            v-if="email"
            class="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline"
          >
            {{ email }}
          </span>
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
