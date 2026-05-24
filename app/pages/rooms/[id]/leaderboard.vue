<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useLeaderboard, applyMemberUpdate } from '~/composables/useLeaderboard'
import type { RoomMember } from '~~/shared/types/rooms'

const route = useRoute()
const roomId = route.params.id as string

// Auth enforced by @nuxtjs/supabase redirectOptions — covers /rooms/** routes.
const { data: leaderboard, pending, error, load, subscribe } = useLeaderboard(roomId)

// Subscription cleanup ref — D9 pattern
const cleanup = ref<(() => void) | null>(null)

// Realtime reducer — R-RT-05 / design D5b, D5c
function onMemberUpdate(payload: { new: RoomMember }) {
  leaderboard.value = applyMemberUpdate(leaderboard.value, payload)
}

onMounted(() => {
  void load()
  cleanup.value = subscribe(onMemberUpdate)
})

onUnmounted(() => {
  cleanup.value?.()
  cleanup.value = null
})
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="mx-auto w-full max-w-2xl space-y-6">
      <header class="space-y-1">
        <NuxtLink
          :to="`/rooms/${roomId}`"
          class="text-xs text-muted-foreground hover:underline"
        >
          ← Volver a la sala
        </NuxtLink>
        <h1 class="text-2xl font-bold tracking-tight">
          Tabla de Posiciones
        </h1>
      </header>

      <p
        v-if="pending"
        class="text-sm text-muted-foreground"
      >
        Cargando tabla…
      </p>

      <p
        v-else-if="error"
        class="text-sm text-destructive"
        role="alert"
      >
        {{ error }}
      </p>

      <section
        v-else
        class="rounded-lg border"
      >
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-4 py-3 font-semibold">
                #
              </th>
              <th class="px-4 py-3 font-semibold">
                Jugador
              </th>
              <th class="px-4 py-3 text-right font-semibold">
                Puntos
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, index) in leaderboard"
              :key="entry.user_id"
              class="border-b last:border-0"
            >
              <td class="px-4 py-3 text-muted-foreground">
                {{ index + 1 }}
              </td>
              <td class="px-4 py-3">
                {{ entry.display_name }}
              </td>
              <td class="px-4 py-3 text-right font-mono font-semibold">
                {{ entry.total_points }}
              </td>
            </tr>
            <tr v-if="leaderboard.length === 0">
              <td
                colspan="3"
                class="px-4 py-6 text-center text-muted-foreground"
              >
                Sin miembros todavía.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>
