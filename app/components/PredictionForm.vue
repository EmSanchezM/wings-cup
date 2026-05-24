<script setup lang="ts">
const props = defineProps<{
  predictedHome: number
  predictedAway: number
  submitting: boolean
  locked: boolean
}>()

const emit = defineEmits<{
  (e: 'update:predictedHome', v: number): void
  (e: 'update:predictedAway', v: number): void
  (e: 'submit'): void
}>()
</script>

<template>
  <form
    class="space-y-4 rounded-lg border p-4"
    data-testid="prediction-form"
    @submit.prevent="$emit('submit')"
  >
    <div class="space-y-2">
      <label
        class="text-sm font-medium"
        for="predicted_home"
      >
        Goles local (predicted_home)
      </label>
      <input
        id="predicted_home"
        :value="props.predictedHome"
        name="predicted_home"
        type="number"
        min="0"
        max="15"
        class="w-full rounded-md border px-3 py-2 text-sm"
        required
        @input="$emit('update:predictedHome', Number(($event.target as HTMLInputElement).value))"
      >
    </div>

    <div class="space-y-2">
      <label
        class="text-sm font-medium"
        for="predicted_away"
      >
        Goles visitante (predicted_away)
      </label>
      <input
        id="predicted_away"
        :value="props.predictedAway"
        name="predicted_away"
        type="number"
        min="0"
        max="15"
        class="w-full rounded-md border px-3 py-2 text-sm"
        required
        @input="$emit('update:predictedAway', Number(($event.target as HTMLInputElement).value))"
      >
    </div>

    <p
      v-if="props.locked"
      class="text-xs text-muted-foreground"
    >
      Las predicciones están bloqueadas para este partido.
    </p>

    <button
      type="submit"
      :disabled="submitting || locked"
      class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
    >
      {{ submitting ? 'Guardando…' : 'Guardar predicción' }}
    </button>
  </form>
</template>
