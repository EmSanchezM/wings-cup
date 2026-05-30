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

// Status-based read-only mode (D8) — independent of lock state
const isReadonly = computed(() => props.match.status !== 'scheduled')

const predClient = makePredictionClient($fetch)

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function handleSubmit() {
  if (isLocked.value || isReadonly.value) return
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
    class="rounded-xl border bg-card p-4 space-y-3 transition-colors"
    :class="{ 'border-l-4 border-destructive': match.status === 'live' }"
    data-testid="prediction-card"
  >
    <!-- Header: stage/group + status badge -->
    <div class="flex items-center justify-between gap-3">
      <p class="text-xs text-muted-foreground uppercase tracking-wide">
        {{ match.stage }}<span v-if="match.group_name"> · Grupo {{ match.group_name }}</span>
      </p>

      <!-- Status badge — token-styled, dark-safe (replaces former bg-*-50 literals) -->
      <span
        v-if="isLocked"
        data-testid="lock-badge"
        class="inline-flex items-center gap-1 rounded-md border border-transparent bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
      >
        🔒 Bloqueada
      </span>
      <span
        v-else-if="match.status === 'live'"
        data-testid="live-badge"
        class="inline-flex items-center gap-1 rounded-md border border-transparent bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground"
      >
        <span class="size-1.5 rounded-full bg-destructive-foreground" /> En vivo
      </span>
      <span
        v-else-if="match.status === 'finished'"
        data-testid="finished-badge"
        class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground"
      >
        Finalizado
      </span>
      <span
        v-else
        data-testid="status-badge"
        class="inline-flex items-center gap-1 rounded-md border border-transparent bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
      >
        Pendiente
      </span>
    </div>

    <!-- Teams + score inputs -->
    <form
      class="space-y-3"
      @submit.prevent="handleSubmit"
    >
      <div class="flex items-center justify-between gap-3">
        <!-- Home team -->
        <label
          :for="`home-${match.id}`"
          class="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold"
        >
          <TeamFlag
            :team="match.home_team"
            :size="28"
          />
          <span class="truncate">{{ match.home_team }}</span>
        </label>

        <!-- Score inputs -->
        <div class="flex shrink-0 items-center gap-2">
          <input
            :id="`home-${match.id}`"
            v-model.number="predictedHome"
            name="predicted_home"
            type="number"
            min="0"
            max="15"
            class="w-14 rounded-md border bg-background px-2 py-2 text-center text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 read-only:opacity-60"
            :readonly="isLocked || isReadonly"
            required
          >
          <span class="text-xs font-bold text-muted-foreground">vs</span>
          <input
            :id="`away-${match.id}`"
            v-model.number="predictedAway"
            name="predicted_away"
            type="number"
            min="0"
            max="15"
            class="w-14 rounded-md border bg-background px-2 py-2 text-center text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 read-only:opacity-60"
            :readonly="isLocked || isReadonly"
            required
          >
        </div>

        <!-- Away team -->
        <label
          :for="`away-${match.id}`"
          class="flex min-w-0 flex-1 items-center justify-end gap-2 text-right text-sm font-semibold"
        >
          <span class="truncate">{{ match.away_team }}</span>
          <TeamFlag
            :team="match.away_team"
            :size="28"
          />
        </label>
      </div>

      <p class="text-xs text-muted-foreground">
        {{ formatKickoff(match.kickoff_at) }}
      </p>

      <!-- Error messages — token-styled (destructive), dark-safe -->
      <div
        v-if="error === 'prediction_locked'"
        class="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
        role="alert"
      >
        Predicción bloqueada — ya no se puede modificar.
        <span class="sr-only">prediction_locked</span>
      </div>

      <div
        v-else-if="error === 'match_already_started'"
        class="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
        role="alert"
      >
        El partido ya empezó — no se aceptan más predicciones.
        <span class="sr-only">match_already_started</span>
      </div>

      <div
        v-else-if="error"
        class="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
        role="alert"
      >
        {{ error }}
      </div>

      <!-- Success badge — token-styled (primary/emerald) -->
      <div
        v-if="success"
        class="rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-primary"
        role="status"
      >
        ¡Predicción guardada!
      </div>

      <!-- Final score block — shown when finished and scores are non-null -->
      <div
        v-if="match.status === 'finished' && match.home_score != null && match.away_score != null"
        class="rounded-md bg-muted/40 px-3 py-2 text-center text-sm font-mono"
        data-testid="final-score"
      >
        Final: {{ match.home_score }} - {{ match.away_score }}
      </div>

      <!-- Submit button — hidden when locked or readonly -->
      <button
        v-if="!isLocked && !isReadonly"
        type="submit"
        :disabled="submitting"
        class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {{ submitting ? 'Guardando…' : 'Guardar predicción' }}
      </button>
    </form>
  </div>
</template>
