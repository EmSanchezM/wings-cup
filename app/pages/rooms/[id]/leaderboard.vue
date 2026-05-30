<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Trophy, Medal } from 'lucide-vue-next'
import { useLeaderboard, applyMemberUpdate } from '~/composables/useLeaderboard'
import { useMatches } from '~/composables/useMatches'
import type { RoomMember } from '~~/shared/types/rooms'
import type { MatchListItem } from '~~/shared/types/matches'
import type { LeaderboardEntry } from '~~/shared/types/leaderboard'

const route = useRoute()
const roomId = route.params.id as string

// Auth enforced by @nuxtjs/supabase redirectOptions — covers /rooms/** routes.
const { data: leaderboard, pending, error, load, subscribe } = useLeaderboard(roomId)

// Secondary reload path — R-RT-06 / R-LEAD-04 (matches-driven). The matches data
// is also read (read-only) to derive the "partidos restantes" stat.
const { data: matchesData, load: loadMatches, subscribe: subscribeMatches } = useMatches()

// Current user — drives the "Tú" row highlight only (read-only, presentational).
const user = useSupabaseUser()

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

// --- Presentational derived data (read-only) ---
function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean)
  if (w.length >= 2) return (w[0]![0]! + w[1]![0]!).toUpperCase()
  return (w[0] ?? '').slice(0, 2).toUpperCase()
}
function isMe(entry: LeaderboardEntry): boolean {
  return !!user.value && entry.user_id === user.value.id
}
const promedio = computed(() => {
  const entries = leaderboard.value
  if (!entries || entries.length === 0) return '0'
  const avg = entries.reduce((sum, e) => sum + e.total_points, 0) / entries.length
  return avg.toFixed(1)
})
const partidosRestantes = computed(
  () => (matchesData.value ?? []).filter(m => m.status !== 'finished').length,
)

onMounted(() => {
  void load()
  void loadMatches() // read-only, for the "partidos restantes" stat
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
    <div class="mx-auto w-full max-w-5xl space-y-6">
      <header class="space-y-4">
        <NuxtLink
          :to="`/rooms/${roomId}`"
          class="inline-flex items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Volver a la sala
        </NuxtLink>
        <div class="flex items-start gap-4">
          <span class="hidden size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent sm:flex">
            <Trophy class="size-6" />
          </span>
          <div class="space-y-1">
            <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
              Tabla de Posiciones
            </h1>
            <p
              v-if="!pending && !error"
              class="text-sm text-muted-foreground sm:text-base"
            >
              {{ leaderboard.length }} participante<span v-if="leaderboard.length !== 1">s</span>
            </p>
          </div>
        </div>
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

      <div
        v-else
        class="grid gap-6 lg:grid-cols-[1fr_280px]"
      >
        <!-- Ranking rows -->
        <section class="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div class="flex items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span class="w-6 text-center">#</span>
            <span class="w-8" />
            <span class="flex-1">Jugador</span>
            <span>Puntos</span>
          </div>

          <div
            v-for="(entry, index) in leaderboard"
            :key="entry.user_id"
            :data-testid="isMe(entry) ? 'lb-row-me' : 'lb-row'"
            class="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0"
            :class="isMe(entry) ? 'border-l-2 border-l-primary bg-primary/10' : 'hover:bg-secondary/30'"
          >
            <span class="flex w-6 justify-center">
              <Medal
                v-if="index === 0"
                class="size-5 text-accent"
              />
              <span
                v-else
                class="text-sm font-semibold tabular-nums text-muted-foreground"
              >
                {{ index + 1 }}
              </span>
            </span>
            <span
              data-testid="lb-avatar"
              class="flex size-8 items-center justify-center rounded-full text-xs font-semibold"
              :class="index === 0
                ? 'bg-accent/15 text-accent'
                : 'bg-secondary text-secondary-foreground'"
            >
              {{ initials(entry.display_name) }}
            </span>
            <span
              class="flex-1 truncate text-sm font-medium"
              :class="isMe(entry) ? 'text-primary' : ''"
            >
              {{ isMe(entry) ? 'Tú' : entry.display_name }}
            </span>
            <span
              class="font-mono font-semibold tabular-nums"
              :class="index === 0 ? 'text-accent' : ''"
            >
              {{ entry.total_points }}
            </span>
          </div>

          <div
            v-if="leaderboard.length === 0"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            Sin miembros todavía.
          </div>
        </section>

        <!-- League stats sidebar (derived) -->
        <aside class="h-fit space-y-5 rounded-2xl border border-border bg-card p-5 shadow-xl lg:sticky lg:top-8">
          <div class="flex items-center gap-2.5">
            <span class="flex size-9 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Trophy class="size-5" />
            </span>
            <h2 class="text-sm font-semibold">
              Estadísticas de la liga
            </h2>
          </div>
          <dl class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">
                Promedio grupo
              </dt>
              <dd
                data-testid="promedio"
                class="font-semibold"
              >
                {{ promedio }}<span class="ml-1 text-xs font-normal text-muted-foreground">pts</span>
              </dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">
                Partidos restantes
              </dt>
              <dd
                data-testid="partidos-restantes"
                class="font-semibold"
              >
                {{ partidosRestantes }}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  </div>
</template>
