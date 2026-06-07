<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Trophy, LogOut, Shield } from 'lucide-vue-next'
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
          <Trophy class="size-5 text-accent" />
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
          <span
            v-if="email"
            class="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline"
          >
            {{ email }}
          </span>
          <span class="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
            {{ initials }}
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
    </header>

    <slot />
  </div>
</template>
