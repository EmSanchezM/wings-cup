<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { makePredictionClient } from '~/utils/prediction-client'
import PredictionForm from '~/components/PredictionForm.vue'
import type { Prediction } from '~~/shared/types/predictions'

const route = useRoute()
const roomId = route.params.id as string

const predictedHome = ref<number>(0)
const predictedAway = ref<number>(0)
const matchId = ref<string>('')
const predictions = ref<Prediction[]>([])
const isLoading = ref(true)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const submitSuccess = ref(false)
/** true when the server returned 423 (prediction locked by admin) */
const locked = ref(false)

const predClient = makePredictionClient($fetch)

onMounted(async () => {
  try {
    const result = await predClient.getPredictions(roomId)
    predictions.value = result.predictions
  } catch {
    // Non-fatal: user may not have predictions yet
  } finally {
    isLoading.value = false
  }
})

async function handleSubmit() {
  if (!matchId.value) return
  submitting.value = true
  submitError.value = null
  submitSuccess.value = false
  locked.value = false

  try {
    await predClient.upsertPrediction(roomId, {
      match_id: matchId.value,
      predicted_home: predictedHome.value,
      predicted_away: predictedAway.value,
    })
    submitSuccess.value = true
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    if (msg.includes('prediction_locked') || (err as { statusCode?: number })?.statusCode === 423) {
      locked.value = true
      submitError.value = 'prediction_locked'
    } else if (msg.includes('match_already_started') || (err as { statusCode?: number })?.statusCode === 409) {
      submitError.value = 'match_already_started'
    } else {
      submitError.value = msg
    }
  } finally {
    submitting.value = false
  }
}
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

      <!-- Locked banner (423) -->
      <div
        v-if="locked"
        class="rounded-lg border border-yellow-400 bg-yellow-50 p-4 text-sm text-yellow-800"
        role="alert"
        data-testid="locked-banner"
      >
        Predicción bloqueada — esta predicción ya no se puede modificar.
        <span class="sr-only">prediction_locked</span>
      </div>

      <!-- Match already started (409) -->
      <div
        v-if="submitError === 'match_already_started'"
        class="rounded-lg border border-red-400 bg-red-50 p-4 text-sm text-red-800"
        role="alert"
        data-testid="started-error"
      >
        El partido ya empezó — no se pueden enviar predicciones para este partido.
        <span class="sr-only">match_already_started</span>
      </div>

      <!-- Generic error -->
      <div
        v-else-if="submitError && submitError !== 'prediction_locked'"
        class="rounded-lg border border-red-400 bg-red-50 p-4 text-sm text-red-800"
        role="alert"
      >
        {{ submitError }}
      </div>

      <!-- Success -->
      <div
        v-if="submitSuccess"
        class="rounded-lg border border-green-400 bg-green-50 p-4 text-sm text-green-800"
        role="status"
      >
        ¡Predicción guardada!
      </div>

      <PredictionForm
        v-model:predicted-home="predictedHome"
        v-model:predicted-away="predictedAway"
        :submitting="submitting"
        :locked="locked"
        @submit="handleSubmit"
      />

      <!-- Existing predictions list -->
      <section
        v-if="predictions.length > 0"
        class="space-y-3"
      >
        <h2 class="text-sm font-semibold">
          Predicciones existentes
        </h2>
        <ul class="space-y-1">
          <li
            v-for="pred in predictions"
            :key="pred.id"
            class="flex items-center justify-between rounded-md border p-3 text-sm"
          >
            <span>Partido: {{ pred.match_id }}</span>
            <span>{{ pred.predicted_home }} - {{ pred.predicted_away }}</span>
            <span
              v-if="pred.locked_at"
              class="text-xs text-muted-foreground"
            >Bloqueada</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
