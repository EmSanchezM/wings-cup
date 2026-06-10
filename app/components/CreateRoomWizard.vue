<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { PlusCircle, ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { defaultScoringRules } from '#shared/schemas/scoring-rules.schema'
import type { CreateRoomInput } from '#shared/schemas/room.schema'

const props = defineProps<{
  submitting: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', payload: CreateRoomInput): void
}>()

// ---------------------------------------------------------------------------
// Step state
// ---------------------------------------------------------------------------
const steps = [
  { title: 'Nombre' },
  { title: 'Premio' },
  { title: 'Reglas' },
  { title: 'Confirmar' },
] as const

const step = ref(1)

const name = ref('')
const prizeDescription = ref('')

// Editable copy of the three configurable point values (wrong stays 0).
const rules = reactive({ ...defaultScoringRules })

const ruleRows = [
  {
    key: 'exact_score' as const,
    label: 'Marcador exacto',
    help: 'Acertás el resultado completo (ej. predecís 2-1 y termina 2-1).',
  },
  {
    key: 'correct_goal_diff' as const,
    label: 'Diferencia de gol',
    help: 'Acertás la diferencia pero no el marcador (ej. predecís 2-1 y fue 3-2).',
  },
  {
    key: 'correct_result' as const,
    label: 'Resultado (ganador o empate)',
    help: 'Acertás quién gana o el empate, sin el marcador exacto.',
  },
]

const isSuggested = computed(() =>
  rules.exact_score === defaultScoringRules.exact_score
  && rules.correct_goal_diff === defaultScoringRules.correct_goal_diff
  && rules.correct_result === defaultScoringRules.correct_result,
)

function useSuggested() {
  rules.exact_score = defaultScoringRules.exact_score
  rules.correct_goal_diff = defaultScoringRules.correct_goal_diff
  rules.correct_result = defaultScoringRules.correct_result
}

// Step 1 is the only one that can block progress: the name must be non-empty
// AND contain at least one letter or number (rejects symbol-only names).
const nameIsValid = computed(() => /[\p{L}\p{N}]/u.test(name.value))
const canAdvance = computed(() => (step.value === 1 ? nameIsValid.value : true))

function next() {
  if (step.value < steps.length && canAdvance.value) step.value += 1
}
function prev() {
  if (step.value > 1) step.value -= 1
}

function submit() {
  if (props.submitting) return
  emit('submit', {
    name: name.value.trim(),
    prize_description: prizeDescription.value.trim(),
    scoring_rules: { ...rules },
  })
}
</script>

<template>
  <section class="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xl">
    <!-- Header -->
    <div class="flex items-center gap-2.5">
      <span class="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <PlusCircle class="size-5" />
      </span>
      <div>
        <h2 class="text-sm font-semibold">
          Crear sala
        </h2>
        <p class="text-xs text-muted-foreground">
          Paso {{ step }} de {{ steps.length }} — {{ steps[step - 1]!.title }}
        </p>
      </div>
    </div>

    <!-- Stepper -->
    <ol class="flex items-center">
      <li
        v-for="(s, i) in steps"
        :key="s.title"
        class="flex flex-1 items-center last:flex-none"
      >
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors"
          :class="step > i + 1
            ? 'border-primary bg-primary text-primary-foreground'
            : step === i + 1
              ? 'border-primary text-primary'
              : 'border-border text-muted-foreground'"
        >
          <Check
            v-if="step > i + 1"
            class="size-4"
          />
          <template v-else>
            {{ i + 1 }}
          </template>
        </span>
        <span
          v-if="i < steps.length - 1"
          class="mx-1 h-0.5 flex-1 rounded-full transition-colors"
          :class="step > i + 1 ? 'bg-primary' : 'bg-border'"
        />
      </li>
    </ol>

    <!-- Step body -->
    <div class="min-h-32">
      <!-- Step 1 — name -->
      <div
        v-if="step === 1"
        class="space-y-2"
      >
        <label
          for="room-name"
          class="text-sm font-medium"
        >
          ¿Cómo se llama tu sala?
        </label>
        <Input
          id="room-name"
          v-model="name"
          placeholder="ej. Amigos del fútbol"
          maxlength="100"
          autofocus
          @keydown.enter.prevent="next"
        />
        <p class="text-xs text-muted-foreground">
          Es el nombre que verán todos los participantes.
        </p>
      </div>

      <!-- Step 2 — prize -->
      <div
        v-else-if="step === 2"
        class="space-y-2"
      >
        <label
          for="room-prize"
          class="text-sm font-medium"
        >
          Premio <span class="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <Input
          id="room-prize"
          v-model="prizeDescription"
          placeholder="ej. Una birra para el ganador"
          maxlength="500"
        />
        <p class="text-xs text-muted-foreground">
          ¿Qué se lleva el campeón? Podés dejarlo vacío.
        </p>
      </div>

      <!-- Step 3 — scoring rules -->
      <div
        v-else-if="step === 3"
        class="space-y-3"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-medium">
            Puntos por acierto
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="isSuggested"
            @click="useSuggested"
          >
            <Sparkles class="size-3.5" />
            Usar sugeridos
          </Button>
        </div>

        <div
          v-for="row in ruleRows"
          :key="row.key"
          class="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium">
              {{ row.label }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ row.help }}
            </p>
          </div>
          <input
            v-model.number="rules[row.key]"
            type="number"
            min="1"
            max="100"
            :aria-label="`Puntos por ${row.label}`"
            class="size-12 shrink-0 rounded-lg border border-input bg-background text-center text-lg font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          >
        </div>
      </div>

      <!-- Step 4 — confirm -->
      <dl
        v-else
        class="space-y-3"
      >
        <div class="flex items-center justify-between gap-3 border-b border-border pb-2">
          <dt class="text-sm text-muted-foreground">
            Nombre
          </dt>
          <dd class="truncate text-sm font-semibold">
            {{ name.trim() || '—' }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3 border-b border-border pb-2">
          <dt class="text-sm text-muted-foreground">
            Premio
          </dt>
          <dd class="truncate text-sm font-medium">
            {{ prizeDescription.trim() || 'Sin premio' }}
          </dd>
        </div>
        <div class="space-y-1.5 pt-1">
          <dt class="text-sm text-muted-foreground">
            Puntos
          </dt>
          <dd class="flex flex-wrap gap-2">
            <span
              v-for="row in ruleRows"
              :key="row.key"
              class="inline-flex items-center gap-1.5 rounded-full bg-secondary/40 px-3 py-1 text-xs"
            >
              {{ row.label }}
              <span class="font-bold text-primary tabular-nums">{{ rules[row.key] }}</span>
            </span>
          </dd>
        </div>
      </dl>
    </div>

    <!-- Navigation -->
    <div class="flex items-center justify-between gap-3 border-t border-border pt-4">
      <Button
        type="button"
        variant="ghost"
        :disabled="step === 1 || submitting"
        @click="prev"
      >
        <ChevronLeft class="size-4" />
        Atrás
      </Button>

      <Button
        v-if="step < steps.length"
        type="button"
        :disabled="!canAdvance"
        @click="next"
      >
        Siguiente
        <ChevronRight class="size-4" />
      </Button>
      <Button
        v-else
        type="button"
        :disabled="submitting || !nameIsValid"
        @click="submit"
      >
        {{ submitting ? 'Creando…' : 'Crear sala' }}
      </Button>
    </div>
  </section>
</template>
