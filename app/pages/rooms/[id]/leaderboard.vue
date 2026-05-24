<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useLeaderboard, applyMemberUpdate } from '~/composables/useLeaderboard'
import { useMatches } from '~/composables/useMatches'
import type { RoomMember } from '~~/shared/types/rooms'
import type { MatchListItem } from '~~/shared/types/matches'

const route = useRoute()
const roomId = route.params.id as string

// Auth enforced by @nuxtjs/supabase redirectOptions — covers /rooms/** routes.
const { data: leaderboard, pending, error, load, subscribe } = useLeaderboard(roomId)

// Secondary reload path — R-RT-06 / R-LEAD-04 (matches-driven)
const { subscribe: subscribeMatches } = useMatches()

// Subscription cleanup refs — D9 pattern
const cleanup = ref<(() => void) | null>(null)
let matchesCleanup: (() => void) | null = null
let matchReloadTimer: ReturnType<typeof setTimeout> | null = null

// Realtime reducer — R-RT-05 / design D5b, D5c
function onMemberUpdate(payload: { new: RoomMember }) {
  leaderboard.value = applyMemberUpdate(leaderboard.value, payload)
}

// Matches-driven leaderboard reload — R-RT-06 / R-LEAD-04 scenarios 5–7
// Fires only when a match transitions to 'finished'; all other statuses are ignored.
function onMatchUpdate(payload: { new: MatchListItem }) {
  if (payload.new.status !== 'finished') return
  if (matchReloadTimer) clearTimeout(matchReloadTimer)
  matchReloadTimer = setTimeout(() => {
    void load()
    matchReloadTimer = null
  }, 300)
}

onMounted(() => {
  void load()
  cleanup.value = subscribe(onMemberUpdate)
  matchesCleanup = subscribeMatches(onMatchUpdate, 'matches-leaderboard-reload')
})

onUnmounted(() => {
  if (matchReloadTimer) {
    clearTimeout(matchReloadTimer)
    matchReloadTimer = null
  }
  matchesCleanup?.()
  matchesCleanup = null
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
