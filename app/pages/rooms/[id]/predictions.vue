<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { makePredictionClient } from '~/utils/prediction-client'
import { useMatches, applyMatchUpdate } from '~/composables/useMatches'
import { useLeaderboard } from '~/composables/useLeaderboard'
import MatchPredictionCard from '~/components/MatchPredictionCard.vue'
import type { MatchListItem } from '~~/shared/types/matches'
import type { Prediction } from '~~/shared/types/predictions'

const route = useRoute()
const roomId = route.params.id as string

const { data: allMatches, load: loadMatches, subscribe } = useMatches()
const predClient = makePredictionClient($fetch)

// "Resumen de Puntos" sidebar — READ-ONLY derived data (R-UX-07). The leaderboard
// fetch and current-user lookup are non-fatal: if either is unavailable the match
// cards stay fully functional and the points/position figures show "—".
const { data: leaderboard, load: loadLeaderboard } = useLeaderboard(roomId)
const user = useSupabaseUser()

const predictionsMap = ref<Map<string, Prediction>>(new Map())
const isLoading = ref(true)

// Subscription cleanup ref — D9 pattern
const cleanup = ref<(() => void) | null>(null)

// Client-side join helper
function joinMatchesWithPredictions(
  matches: MatchListItem[],
  predictionsMap: Map<string, Prediction>,
): { match: MatchListItem; prediction: Prediction | null }[] {
  return matches.map((match) => ({
    match,
    prediction: predictionsMap.get(match.id) ?? null,
  }))
}

// Filter widened from 'scheduled' only to ['scheduled', 'live', 'finished'] — R-PRED-06
const eligibleEntries = computed(() => {
  const eligible = (allMatches.value ?? []).filter(
    (m) => ['scheduled', 'live', 'finished'].includes(m.status),
  )
  return joinMatchesWithPredictions(eligible, predictionsMap.value)
})

// --- Sidebar derived figures (read-only) ---
const completados = computed(() => {
  const entries = eligibleEntries.value
  const done = entries.filter((e) => e.prediction !== null).length
  return `${done}/${entries.length}`
})
const myRank = computed(() => {
  const uid = user.value?.id
  if (!uid) return -1
  return (leaderboard.value ?? []).findIndex((e) => e.user_id === uid)
})
const puntos = computed(() =>
  myRank.value >= 0 ? String(leaderboard.value![myRank.value]!.total_points) : '—',
)
const posicion = computed(() => (myRank.value >= 0 ? `${myRank.value + 1}°` : '—'))

// Realtime reducer — R-RT-04 / design D5a
function onMatchUpdate(payload: { new: MatchListItem }) {
  allMatches.value = applyMatchUpdate(allMatches.value, payload)
}

onMounted(async () => {
  try {
    // Parallel fetch. loadLeaderboard() is read-only and self-catching (never
    // rejects), so it can join the critical path without risking the cards.
    const [, predResult] = await Promise.all([
      loadMatches(),
      predClient.getPredictions(roomId),
      loadLeaderboard(),
    ])
    const map = new Map<string, Prediction>()
    for (const pred of predResult.predictions) {
      map.set(pred.match_id, pred)
    }
    predictionsMap.value = map
  } catch {
    // Non-fatal: surface errors via per-card state, not globally
  } finally {
    isLoading.value = false
  }

  // Subscribe to realtime match updates — reuse the same useMatches() instance
  // so reconnect reload flows back into allMatches (not a discarded second instance).
  cleanup.value = subscribe(onMatchUpdate)
})

onUnmounted(() => {
  cleanup.value?.()
  cleanup.value = null
})
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="mx-auto w-full max-w-5xl space-y-6">
      <header class="space-y-1">
        <NuxtLink
          :to="`/rooms/${roomId}`"
          class="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Volver a la sala
        </NuxtLink>
        <h1 class="text-2xl font-bold tracking-tight">
          Mis Pronósticos
        </h1>
        <p class="text-sm text-muted-foreground">
          Cargá tus marcadores antes del pitazo inicial de cada partido.
        </p>
      </header>

      <div class="grid gap-6 lg:grid-cols-[1fr_300px]">
        <!-- Left column: match cards -->
        <div>
          <p
            v-if="isLoading"
            class="text-sm text-muted-foreground"
          >
            Cargando partidos…
          </p>

          <template v-else>
            <!-- Empty state -->
            <div
              v-if="eligibleEntries.length === 0"
              class="space-y-3 rounded-xl border border-dashed bg-card p-8 text-center"
            >
              <p class="text-sm text-muted-foreground">
                No hay partidos disponibles para pronosticar
              </p>
              <NuxtLink
                :to="`/rooms/${roomId}/leaderboard`"
                class="text-sm font-medium text-primary hover:underline"
              >
                Ver tabla de posiciones
              </NuxtLink>
            </div>

            <!-- Card list — one per eligible match (scheduled, live, finished) -->
            <div
              v-else
              class="space-y-4"
            >
              <MatchPredictionCard
                v-for="entry in eligibleEntries"
                :key="entry.match.id"
                :match="entry.match"
                :existing-prediction="entry.prediction"
                :room-id="roomId"
              />
            </div>
          </template>
        </div>

        <!-- Right column: points summary sidebar -->
        <aside
          data-testid="points-summary"
          class="h-fit space-y-4 rounded-xl border bg-card p-5 lg:sticky lg:top-8"
        >
          <h2 class="text-sm font-semibold">
            Resumen de Puntos
          </h2>
          <dl class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">
                Pronósticos completados
              </dt>
              <dd
                data-testid="completados"
                class="font-semibold"
              >
                {{ completados }}
              </dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">
                Puntos acumulados
              </dt>
              <dd
                data-testid="puntos"
                class="font-semibold text-primary"
              >
                {{ puntos }}<span
                  v-if="puntos !== '—'"
                  class="ml-1 text-xs font-normal text-muted-foreground"
                >pts</span>
              </dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-muted-foreground">
                Posición actual
              </dt>
              <dd
                data-testid="posicion"
                class="font-semibold"
              >
                {{ posicion }}
              </dd>
            </div>
          </dl>
          <NuxtLink
            :to="`/rooms/${roomId}/leaderboard`"
            class="block rounded-md border border-border px-3 py-2 text-center text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Ver tabla completa
          </NuxtLink>
        </aside>
      </div>
    </div>
  </div>
</template>
