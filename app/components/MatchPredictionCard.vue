<script setup lang="ts">
import { ref } from 'vue'
import { makePredictionClient } from '~/utils/prediction-client'
import type { MatchListItem } from '~~/shared/types/matches'
import type { Prediction } from '~~/shared/types/predictions'

const props = defineProps<{
  match: MatchListItem
  existingPrediction: Prediction | null
  roomId: string
}>()

const emit = defineEmits<{
  (e: 'submitted', prediction: Prediction): void
}>()

// ---------------------------------------------------------------------------
// Local reactive state — per-card, no parent involvement
// ---------------------------------------------------------------------------

const predictedHome = ref<number>(props.existingPrediction?.predicted_home ?? 0)
const predictedAway = ref<number>(props.existingPrediction?.predicted_away ?? 0)
const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const isLocked = computed(() => props.existingPrediction?.locked_at !== null && props.existingPrediction?.locked_at !== undefined)

const predClient = makePredictionClient($fetch)

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function handleSubmit() {
  if (isLocked.value) return
  submitting.value = true
  error.value = null
  success.value = false

  try {
    const result = await predClient.upsertPrediction(props.roomId, {
      match_id: props.match.id,
      predicted_home: predictedHome.value,
      predicted_away: predictedAway.value,
    })
    success.value = true
    emit('submitted', result.prediction)
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    const msg = err instanceof Error ? err.message : 'unknown_error'
    if (statusCode === 401) {
      useSessionExpired().setExpired()
    } else if (statusCode === 423 || msg.includes('prediction_locked')) {
      error.value = 'prediction_locked'
    } else if (statusCode === 409 || msg.includes('match_already_started')) {
      error.value = 'match_already_started'
    } else {
      error.value = msg
    }
  } finally {
    submitting.value = false
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKickoff(kickoffAt: string): string {
  return new Date(kickoffAt).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div
    class="rounded-lg border p-4 space-y-3"
    data-testid="prediction-card"
  >
    <!-- Match header -->
    <div class="space-y-1">
      <p class="text-xs text-muted-foreground uppercase tracking-wide">
        {{ match.stage }}<span v-if="match.group_name"> · Grupo {{ match.group_name }}</span>
      </p>
      <div class="flex items-center justify-between">
        <span class="font-semibold">{{ match.home_team }}</span>
        <span class="text-xs text-muted-foreground">vs</span>
        <span class="font-semibold">{{ match.away_team }}</span>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ formatKickoff(match.kickoff_at) }}
      </p>
    </div>

    <!-- Lock badge (shown when locked) -->
    <div
      v-if="isLocked"
      class="flex items-center gap-1 rounded-md bg-yellow-50 border border-yellow-300 px-2 py-1 text-xs text-yellow-800 w-fit"
      data-testid="lock-badge"
    >
      🔒 Predicción bloqueada
    </div>

    <!-- Score inputs -->
    <form
      class="space-y-3"
      @submit.prevent="handleSubmit"
    >
      <div class="flex items-center gap-3">
        <div class="flex-1 space-y-1">
          <label
            class="text-xs font-medium text-muted-foreground"
            :for="`home-${match.id}`"
          >
            {{ match.home_team }}
          </label>
          <input
            :id="`home-${match.id}`"
            v-model.number="predictedHome"
            name="predicted_home"
            type="number"
            min="0"
            max="15"
            class="w-full rounded-md border px-3 py-2 text-sm text-center"
            :readonly="isLocked"
            required
          >
        </div>

        <span class="text-muted-foreground font-bold pt-5">-</span>

        <div class="flex-1 space-y-1">
          <label
            class="text-xs font-medium text-muted-foreground"
            :for="`away-${match.id}`"
          >
            {{ match.away_team }}
          </label>
          <input
            :id="`away-${match.id}`"
            v-model.number="predictedAway"
            name="predicted_away"
            type="number"
            min="0"
            max="15"
            class="w-full rounded-md border px-3 py-2 text-sm text-center"
            :readonly="isLocked"
            required
          >
        </div>
      </div>

      <!-- Error messages -->
      <div
        v-if="error === 'prediction_locked'"
        class="rounded-md border border-yellow-400 bg-yellow-50 p-2 text-xs text-yellow-800"
        role="alert"
      >
        Predicción bloqueada — ya no se puede modificar.
        <span class="sr-only">prediction_locked</span>
      </div>

      <div
        v-else-if="error === 'match_already_started'"
        class="rounded-md border border-red-400 bg-red-50 p-2 text-xs text-red-800"
        role="alert"
      >
        El partido ya empezó — no se aceptan más predicciones.
        <span class="sr-only">match_already_started</span>
      </div>

      <div
        v-else-if="error"
        class="rounded-md border border-red-400 bg-red-50 p-2 text-xs text-red-800"
        role="alert"
      >
        {{ error }}
      </div>

      <!-- Success badge -->
      <div
        v-if="success"
        class="rounded-md border border-green-400 bg-green-50 p-2 text-xs text-green-800"
        role="status"
      >
        ¡Predicción guardada!
      </div>

      <!-- Submit button — hidden when locked -->
      <button
        v-if="!isLocked"
        type="submit"
        :disabled="submitting"
        class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {{ submitting ? 'Guardando…' : 'Guardar predicción' }}
      </button>
    </form>
  </div>
</template>
