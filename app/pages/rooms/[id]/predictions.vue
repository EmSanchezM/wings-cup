<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Flag, Trophy, ArrowRight, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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
): { match: MatchListItem, prediction: Prediction | null }[] {
  return matches.map(match => ({
    match,
    prediction: predictionsMap.get(match.id) ?? null,
  }))
}

// Filter widened from 'scheduled' only to ['scheduled', 'live', 'finished'] — R-PRED-06
const eligibleEntries = computed(() => {
  const eligible = (allMatches.value ?? []).filter(
    m => ['scheduled', 'live', 'finished'].includes(m.status),
  )
  return joinMatchesWithPredictions(eligible, predictionsMap.value)
})

// --- Sidebar derived figures (read-only) ---
const completados = computed(() => {
  const entries = eligibleEntries.value
  const done = entries.filter(e => e.prediction !== null).length
  return `${done}/${entries.length}`
})
const myRank = computed(() => {
  const uid = user.value?.id
  if (!uid) return -1
  return (leaderboard.value ?? []).findIndex(e => e.user_id === uid)
})
const puntos = computed(() =>
  myRank.value >= 0 ? String(leaderboard.value![myRank.value]!.total_points) : '—',
)
const posicion = computed(() => (myRank.value >= 0 ? `${myRank.value + 1}°` : '—'))

// Progress bar fill (0–100) for the "Resumen de Puntos" sidebar — presentational only.
const progressPct = computed(() => {
  const entries = eligibleEntries.value
  if (entries.length === 0) return 0
  const done = entries.filter(e => e.prediction !== null).length
  return Math.round((done / entries.length) * 100)
})

// --- Matchday (date) filter — presentational grouping to avoid one long scroll ---
// "Jornada" is not a stored field, so we derive it from each match's local kickoff
// date. Matches are bucketed by day; the user views one day at a time via the chip
// strip. completados / puntos / posición stay GLOBAL (whole tournament).
type DateBucket = {
  key: string
  label: string
  count: number
  done: number
  hasPending: boolean
  entries: typeof eligibleEntries.value
}

function dateKeyOf(kickoffAt: string): string {
  // en-CA → YYYY-MM-DD in the viewer's local timezone (stable, sortable).
  return new Date(kickoffAt).toLocaleDateString('en-CA')
}
function dateLabelOf(kickoffAt: string): string {
  return new Date(kickoffAt).toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

const dateBuckets = computed<DateBucket[]>(() => {
  const map = new Map<string, DateBucket>()
  for (const entry of eligibleEntries.value) {
    const key = dateKeyOf(entry.match.kickoff_at)
    let bucket = map.get(key)
    if (!bucket) {
      bucket = {
        key,
        label: dateLabelOf(entry.match.kickoff_at),
        count: 0,
        done: 0,
        hasPending: false,
        entries: [],
      }
      map.set(key, bucket)
    }
    bucket.entries.push(entry)
    bucket.count += 1
    if (entry.prediction !== null) bucket.done += 1
    if (entry.match.status === 'scheduled') bucket.hasPending = true
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
})

// User's explicit chip selection; null until they pick one (or the default resolves).
const activeDate = ref<string | null>(null)
// Whether the full matchday list is expanded (collapsed by default to avoid clutter).
const showAllDates = ref(false)

// Always a valid date when buckets exist. Priority:
//   1. the user's explicit pick (if still valid)
//   2. today's matchday (the natural "what's on now" view)
//   3. the next upcoming matchday (tournament hasn't started / nothing today)
//   4. the most recent past matchday (everything is already over)
const resolvedDate = computed<string | null>(() => {
  const buckets = dateBuckets.value
  if (buckets.length === 0) return null
  if (activeDate.value && buckets.some(b => b.key === activeDate.value)) {
    return activeDate.value
  }
  const todayKey = new Date().toLocaleDateString('en-CA')
  const today = buckets.find(b => b.key === todayKey)
  if (today) return today.key
  const upcoming = buckets.find(b => b.key > todayKey)
  if (upcoming) return upcoming.key
  return buckets[buckets.length - 1]!.key
})

// Index of the active bucket — drives the prev/next matchday navigator.
const activeIndex = computed(() => dateBuckets.value.findIndex(b => b.key === resolvedDate.value))
const activeBucket = computed(() => dateBuckets.value[activeIndex.value] ?? null)
const hasPrevDate = computed(() => activeIndex.value > 0)
const hasNextDate = computed(() => activeIndex.value >= 0 && activeIndex.value < dateBuckets.value.length - 1)
function goPrevDate() {
  if (hasPrevDate.value) activeDate.value = dateBuckets.value[activeIndex.value - 1]!.key
}
function goNextDate() {
  if (hasNextDate.value) activeDate.value = dateBuckets.value[activeIndex.value + 1]!.key
}

const visibleEntries = computed(() => {
  const key = resolvedDate.value
  if (!key) return []
  return dateBuckets.value.find(b => b.key === key)?.entries ?? []
})

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
  }
  catch {
    // Non-fatal: surface errors via per-card state, not globally
  }
  finally {
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
    <div class="mx-auto w-full max-w-5xl space-y-8">
      <header class="space-y-4">
        <NuxtLink
          :to="`/rooms/${roomId}`"
          class="inline-flex items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Volver a la sala
        </NuxtLink>
        <div class="flex items-start gap-4">
          <span class="hidden size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
            <Flag class="size-6" />
          </span>
          <div class="space-y-1">
            <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
              Mis <span class="text-primary">Pronósticos</span>
            </h1>
            <p class="text-sm text-muted-foreground sm:text-base">
              Cargá tus marcadores antes del pitazo inicial de cada partido.
            </p>
          </div>
        </div>
      </header>

      <div class="grid gap-6 lg:grid-cols-[1fr_300px]">
        <!-- Left column: match cards (min-w-0 keeps wide content from breaking the grid) -->
        <div class="min-w-0">
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
              class="space-y-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center"
            >
              <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Flag class="size-6" />
              </span>
              <p class="text-sm text-muted-foreground">
                No hay partidos disponibles para pronosticar
              </p>
              <Button
                as-child
                variant="outline"
              >
                <NuxtLink :to="`/rooms/${roomId}/leaderboard`">
                  Ver tabla de posiciones
                  <ArrowRight class="size-4" />
                </NuxtLink>
              </Button>
            </div>

            <!-- Matches grouped by day — view one matchday at a time -->
            <div
              v-else
              class="space-y-4"
            >
              <!-- Matchday navigator — compact, shows one day at a time -->
              <div class="space-y-2">
                <div class="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    :disabled="!hasPrevDate"
                    aria-label="Jornada anterior"
                    @click="goPrevDate"
                  >
                    <ChevronLeft class="size-4" />
                  </Button>
                  <div class="flex-1 text-center">
                    <p
                      data-testid="active-date"
                      class="text-sm font-semibold capitalize"
                    >
                      {{ activeBucket?.label }}
                    </p>
                    <p class="text-xs text-muted-foreground tabular-nums">
                      {{ activeBucket?.done }}/{{ activeBucket?.count }} pronosticados
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    :disabled="!hasNextDate"
                    aria-label="Jornada siguiente"
                    @click="goNextDate"
                  >
                    <ChevronRight class="size-4" />
                  </Button>
                </div>

                <!-- Reveal the full matchday list on demand (only when there's more than one) -->
                <button
                  v-if="dateBuckets.length > 1"
                  type="button"
                  class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  @click="showAllDates = !showAllDates"
                >
                  <CalendarDays class="size-3.5" />
                  {{ showAllDates ? 'Ocultar jornadas' : `Ver todas las jornadas (${dateBuckets.length})` }}
                </button>

                <!-- Full list — wraps (no horizontal scroll), collapsed by default -->
                <div
                  v-if="showAllDates"
                  class="flex flex-wrap gap-2 pt-1"
                  role="tablist"
                  aria-label="Filtrar por jornada"
                >
                  <button
                    v-for="bucket in dateBuckets"
                    :key="bucket.key"
                    type="button"
                    role="tab"
                    :aria-selected="bucket.key === resolvedDate"
                    data-testid="date-tab"
                    class="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors"
                    :class="bucket.key === resolvedDate
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'"
                    @click="activeDate = bucket.key; showAllDates = false"
                  >
                    {{ bucket.label }}
                    <span
                      class="rounded-full px-1.5 tabular-nums"
                      :class="bucket.key === resolvedDate
                        ? 'bg-primary-foreground/20'
                        : 'bg-secondary'"
                    >
                      {{ bucket.done }}/{{ bucket.count }}
                    </span>
                  </button>
                </div>
              </div>

              <!-- Cards for the active matchday only -->
              <div class="space-y-4">
                <MatchPredictionCard
                  v-for="entry in visibleEntries"
                  :key="entry.match.id"
                  :match="entry.match"
                  :existing-prediction="entry.prediction"
                  :room-id="roomId"
                />
              </div>
            </div>
          </template>
        </div>

        <!-- Right column: points summary sidebar -->
        <aside
          data-testid="points-summary"
          class="h-fit space-y-5 rounded-2xl border border-border bg-card p-5 shadow-xl lg:sticky lg:top-8"
        >
          <div class="flex items-center gap-2.5">
            <span class="flex size-9 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Trophy class="size-5" />
            </span>
            <h2 class="text-sm font-semibold">
              Resumen de Puntos
            </h2>
          </div>

          <!-- Progress: predictions completed -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Pronósticos completados</span>
              <span
                data-testid="completados"
                class="font-semibold"
              >
                {{ completados }}
              </span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                class="h-full rounded-full bg-primary transition-all duration-500"
                :style="{ width: `${progressPct}%` }"
              />
            </div>
          </div>

          <!-- Accumulated points — accent highlight -->
          <div class="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-3">
            <span class="text-sm text-muted-foreground">Puntos acumulados</span>
            <span
              data-testid="puntos"
              class="text-2xl font-bold text-primary"
            >
              {{ puntos }}<span
                v-if="puntos !== '—'"
                class="ml-1 text-xs font-normal text-muted-foreground"
              >pts</span>
            </span>
          </div>

          <dl class="space-y-3 text-sm">
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

          <Button
            as-child
            variant="outline"
            class="w-full"
          >
            <NuxtLink :to="`/rooms/${roomId}/leaderboard`">
              Ver tabla completa
            </NuxtLink>
          </Button>
        </aside>
      </div>
    </div>
  </div>
</template>
