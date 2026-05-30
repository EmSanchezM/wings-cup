<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Trophy, Users, Flag, BarChart3, Copy, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Room, RoomMemberView } from '~~/shared/types/rooms'

// Auth enforced by @nuxtjs/supabase redirectOptions (covers /rooms/**)
const route = useRoute()
const roomClient = useRoom()
const roomId = route.params.id as string

const room = ref<Room | null>(null)
const members = ref<RoomMemberView[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const copied = ref(false)
async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
  catch {
    // Clipboard unavailable — silently no-op.
  }
}

function memberInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase()
  return (words[0] ?? '').slice(0, 2).toUpperCase() || '··'
}

onMounted(async () => {
  try {
    const result = await roomClient.getRoom(roomId)
    if (!result) return // 401: toast handles UX
    room.value = result.room
    members.value = result.members
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la sala'
  }
  finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="mx-auto w-full max-w-2xl space-y-8">
      <p
        v-if="isLoading"
        class="text-sm text-muted-foreground"
      >
        Cargando…
      </p>

      <p
        v-else-if="error"
        class="text-sm text-destructive"
        role="alert"
      >
        {{ error }}
      </p>

      <template v-else-if="room">
        <header class="space-y-4">
          <NuxtLink
            to="/rooms"
            class="inline-flex items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Volver a Salas
          </NuxtLink>
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
                {{ room.name }}
              </h1>
              <p
                v-if="room.prize_description"
                class="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Trophy class="size-4 shrink-0 text-accent" />
                {{ room.prize_description }}
              </p>
            </div>
            <Badge
              variant="outline"
              class="shrink-0 font-mono"
            >
              {{ room.invite_code }}
            </Badge>
          </div>

          <!-- Invite code with copy -->
          <div class="flex items-center gap-2 rounded-xl bg-secondary/40 px-3 py-2">
            <span class="text-xs text-muted-foreground">Código de invitación</span>
            <span class="font-mono text-sm font-semibold">{{ room.invite_code }}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="ml-auto size-7"
              :aria-label="copied ? 'Copiado' : 'Copiar código'"
              @click="copyCode(room.invite_code)"
            >
              <Check
                v-if="copied"
                class="size-4 text-primary"
              />
              <Copy
                v-else
                class="size-4"
              />
            </Button>
          </div>
        </header>

        <!-- Members -->
        <section class="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl">
          <div class="flex items-center gap-2.5">
            <span class="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users class="size-5" />
            </span>
            <h2 class="text-sm font-semibold">
              Miembros <span class="text-muted-foreground">({{ members.length }})</span>
            </h2>
          </div>
          <ul class="space-y-1">
            <li
              v-for="member in members"
              :key="member.user_id"
              class="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/40"
            >
              <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                {{ memberInitials(member.display_name) }}
              </span>
              <span class="min-w-0 flex-1 truncate text-sm font-medium">
                {{ member.display_name || 'Sin nombre' }}
              </span>
              <Badge :variant="member.role === 'owner' ? 'accent' : 'secondary'">
                {{ member.role === 'owner' ? 'Dueño' : 'Miembro' }}
              </Badge>
            </li>
          </ul>
        </section>

        <!-- Actions -->
        <section class="grid gap-3 sm:grid-cols-2">
          <Button
            as-child
            size="lg"
            class="h-auto justify-start gap-3 py-4"
          >
            <NuxtLink :to="`/rooms/${roomId}/predictions`">
              <Flag class="size-5" />
              <span class="flex flex-col items-start">
                <span class="font-semibold">Mis Predicciones</span>
                <span class="text-xs font-normal opacity-80">Cargá tus marcadores</span>
              </span>
            </NuxtLink>
          </Button>
          <Button
            as-child
            variant="outline"
            size="lg"
            class="h-auto justify-start gap-3 py-4"
          >
            <NuxtLink :to="`/rooms/${roomId}/leaderboard`">
              <BarChart3 class="size-5 text-accent" />
              <span class="flex flex-col items-start">
                <span class="font-semibold">Tabla de Posiciones</span>
                <span class="text-xs font-normal text-muted-foreground">Quién va ganando</span>
              </span>
            </NuxtLink>
          </Button>
        </section>
      </template>
    </div>
  </div>
</template>
