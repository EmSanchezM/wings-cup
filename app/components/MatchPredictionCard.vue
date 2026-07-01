<script setup lang="ts">
import { ref } from 'vue'
import { Clock } from 'lucide-vue-next'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { makePredictionClient } from '~/utils/prediction-client'
import type { MatchListItem } from '#shared/types/matches'
import type { Prediction } from '#shared/types/predictions'

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
const predictedAdvances = ref<'home' | 'away' | null>(
  (props.existingPrediction?.predicted_advances as 'home' | 'away' | null) ?? null,
)
const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const isLocked = computed(() => props.existingPrediction?.locked_at !== null && props.existingPrediction?.locked_at !== undefined)

// Status-based read-only mode (D8) — independent of lock state
const isReadonly = computed(() => props.match.status !== 'scheduled')

// Knockout matches carry an "advance pick": who goes through. A correct pick
// earns +1 regardless of how the tie is decided (regulation, extra time, or
// penalties). Group-stage draws are legitimate and have no winner.
const isKnockout = computed(() => props.match.stage !== 'group')

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
      // Only knockout matches carry a tiebreak pick.
      predicted_advances: isKnockout.value ? predictedAdvances.value : null,
    })
    success.value = true
    emit('submitted', result.prediction)
  }
  catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    const msg = err instanceof Error ? err.message : 'unknown_error'
    if (statusCode === 401) {
      useSessionExpired().setExpired()
    }
    else if (statusCode === 423 || msg.includes('prediction_locked')) {
      error.value = 'prediction_locked'
    }
    else if (statusCode === 409 || msg.includes('match_already_started')) {
      error.value = 'match_already_started'
    }
    else {
      error.value = msg
    }
  }
  finally {
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
    class="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl transition-colors"
    :class="{ 'border-l-4 border-destructive': match.status === 'live' }"
    data-testid="prediction-card"
  >
    <!-- Header: stage/group + status badge -->
    <div class="flex items-center justify-between gap-3">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {{ match.stage }}<span v-if="match.group_name"> · Grupo {{ match.group_name }}</span>
      </p>

      <!-- Status badge — shadcn Badge component, token-driven -->
      <Badge
        v-if="isLocked"
        data-testid="lock-badge"
        variant="secondary"
      >
        🔒 Bloqueada
      </Badge>
      <Badge
        v-else-if="match.status === 'live'"
        data-testid="live-badge"
        variant="destructive"
        class="gap-1.5"
      >
        <span class="relative flex size-1.5">
          <span class="absolute inline-flex size-full animate-ping rounded-full bg-destructive-foreground opacity-75" />
          <span class="relative inline-flex size-1.5 rounded-full bg-destructive-foreground" />
        </span>
        En vivo
      </Badge>
      <Badge
        v-else-if="match.status === 'finished'"
        data-testid="finished-badge"
        variant="outline"
      >
        Finalizado
      </Badge>
      <Badge
        v-else
        data-testid="status-badge"
        variant="secondary"
      >
        Pendiente
      </Badge>
    </div>

    <!-- Teams + score inputs -->
    <form
      class="space-y-4"
      @submit.prevent="handleSubmit"
    >
      <!-- Pitch surface: flag · score · flag (landing's match-card treatment) -->
      <div class="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-5">
        <!-- Home team -->
        <label
          :for="`home-${match.id}`"
          class="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"
        >
          <TeamFlag
            :team="match.home_team"
            :size="40"
          />
          <span class="w-full truncate text-sm font-semibold">{{ match.home_team }}</span>
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
            class="size-14 rounded-lg border border-input bg-background text-center text-2xl font-bold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 read-only:border-transparent read-only:bg-transparent read-only:opacity-80 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            :readonly="isLocked || isReadonly"
            required
          >
          <span class="text-lg font-bold text-muted-foreground">-</span>
          <input
            :id="`away-${match.id}`"
            v-model.number="predictedAway"
            name="predicted_away"
            type="number"
            min="0"
            max="15"
            class="size-14 rounded-lg border border-input bg-background text-center text-2xl font-bold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 read-only:border-transparent read-only:bg-transparent read-only:opacity-80 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            :readonly="isLocked || isReadonly"
            required
          >
        </div>

        <!-- Away team -->
        <label
          :for="`away-${match.id}`"
          class="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"
        >
          <TeamFlag
            :team="match.away_team"
            :size="40"
          />
          <span class="w-full truncate text-sm font-semibold">{{ match.away_team }}</span>
        </label>
      </div>

      <!-- Knockout advance pick: who goes through. +1 bonus for the correct pick,
           however the match is decided. Hidden for group-stage matches. -->
      <fieldset
        v-if="isKnockout"
        class="space-y-2 rounded-xl bg-secondary/40 px-4 py-3"
        data-testid="advance-pick"
      >
        <legend class="text-xs font-medium text-muted-foreground">
          ¿Quién avanza? <span class="text-accent">+1</span>
        </legend>
        <div class="grid grid-cols-2 gap-2">
          <label
            class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition"
            :class="predictedAdvances === 'home'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-input text-muted-foreground hover:border-accent/50'"
          >
            <input
              v-model="predictedAdvances"
              type="radio"
              name="advances"
              value="home"
              class="sr-only"
              :disabled="isLocked || isReadonly"
            >
            <span class="truncate">{{ match.home_team }}</span>
          </label>
          <label
            class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition"
            :class="predictedAdvances === 'away'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-input text-muted-foreground hover:border-accent/50'"
          >
            <input
              v-model="predictedAdvances"
              type="radio"
              name="advances"
              value="away"
              class="sr-only"
              :disabled="isLocked || isReadonly"
            >
            <span class="truncate">{{ match.away_team }}</span>
          </label>
        </div>
      </fieldset>

      <p class="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Clock class="size-3.5" />
        {{ formatKickoff(match.kickoff_at) }}
      </p>

      <!-- Error messages — token-styled (destructive), dark-safe -->
      <div
        v-if="error === 'prediction_locked'"
        class="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
        role="alert"
      >
        Predicción bloqueada — ya no se puede modificar.
        <span class="sr-only">prediction_locked</span>
      </div>

      <div
        v-else-if="error === 'match_already_started'"
        class="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
        role="alert"
      >
        El partido ya empezó — no se aceptan más predicciones.
        <span class="sr-only">match_already_started</span>
      </div>

      <div
        v-else-if="error"
        class="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
        role="alert"
      >
        {{ error }}
      </div>

      <!-- Success badge — token-styled (primary/emerald) -->
      <div
        v-if="success"
        class="rounded-lg border border-primary/40 bg-primary/10 p-2.5 text-xs font-medium text-primary"
        role="status"
      >
        ¡Predicción guardada!
      </div>

      <!-- Final score block — shown when finished and scores are non-null -->
      <div
        v-if="match.status === 'finished' && match.home_score != null && match.away_score != null"
        class="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-center text-sm font-semibold font-mono text-accent"
        data-testid="final-score"
      >
        Final: {{ match.home_score }} - {{ match.away_score }}
      </div>

      <!-- Submit button — hidden when locked or readonly -->
      <Button
        v-if="!isLocked && !isReadonly"
        type="submit"
        size="lg"
        class="w-full"
        :disabled="submitting"
      >
        {{ submitting ? 'Guardando…' : 'Guardar predicción' }}
      </Button>
    </form>
  </div>
</template>
