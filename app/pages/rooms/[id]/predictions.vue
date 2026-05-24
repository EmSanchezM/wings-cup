<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { makePredictionClient } from '~/utils/prediction-client'
import { useMatches } from '~/composables/useMatches'
import MatchPredictionCard from '~/components/MatchPredictionCard.vue'
import type { MatchListItem } from '~~/shared/types/matches'
import type { Prediction } from '~~/shared/types/predictions'

const route = useRoute()
const roomId = route.params.id as string

const { data: allMatches, load: loadMatches } = useMatches()
const predClient = makePredictionClient($fetch)

const predictionsMap = ref<Map<string, Prediction>>(new Map())
const isLoading = ref(true)

// Client-side join helper (T-52)
function joinMatchesWithPredictions(
  matches: MatchListItem[],
  predictionsMap: Map<string, Prediction>,
): { match: MatchListItem; prediction: Prediction | null }[] {
  return matches.map((match) => ({
    match,
    prediction: predictionsMap.get(match.id) ?? null,
  }))
}

const scheduledEntries = computed(() => {
  const now = new Date()
  const scheduled = (allMatches.value ?? []).filter(
    (m) => m.status === 'scheduled' && new Date(m.kickoff_at) > now,
  )
  return joinMatchesWithPredictions(scheduled, predictionsMap.value)
})

onMounted(async () => {
  try {
    // Parallel fetch — no useSupabaseUser; auth guaranteed by redirectOptions
    const [, predResult] = await Promise.all([
      loadMatches(),
      predClient.getPredictions(roomId),
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
          Mis Predicciones
        </h1>
      </header>

      <p
        v-if="isLoading"
        class="text-sm text-muted-foreground"
      >
        Cargando partidos…
      </p>

      <template v-else>
        <!-- Empty state -->
        <div
          v-if="scheduledEntries.length === 0"
          class="rounded-lg border border-dashed p-8 text-center space-y-3"
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

        <!-- Card list — one per scheduled match -->
        <div
          v-else
          class="space-y-4"
        >
          <MatchPredictionCard
            v-for="entry in scheduledEntries"
            :key="entry.match.id"
            :match="entry.match"
            :existing-prediction="entry.prediction"
            :room-id="roomId"
          />
        </div>
      </template>
    </div>
  </div>
</template>
