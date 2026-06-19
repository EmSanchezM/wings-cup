<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Flag, ChevronLeft, ChevronRight, CalendarDays, Lock, Clock, Ban } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { makePredictionClient } from '~/utils/prediction-client'
import { useMatches } from '~/composables/useMatches'
import type { MatchListItem } from '#shared/types/matches'
import type { Prediction } from '#shared/types/predictions'

const route = useRoute()
const roomId = route.params.id as string
const memberId = route.params.memberId as string

const { data: allMatches, load: loadMatches } = useMatches()
const predClient = makePredictionClient($fetch)

const predictionsMap = ref<Map<string, Prediction>>(new Map())
const displayName = ref('')
const isLoading = ref(true)
const loadError = ref<string | null>(null)

// ---------------------------------------------------------------------------
// Date-bucket grouping (mirrors predictions.vue logic)
// ---------------------------------------------------------------------------

function dateKeyOf(kickoffAt: string): string {
  return new Date(kickoffAt).toLocaleDateString('en-CA')
}

function dateLabelOf(kickoffAt: string): string {
  return new Date(kickoffAt).toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

type DateBucket = {
  key: string
  label: string
  count: number
  entries: { match: MatchListItem, prediction: Prediction | null }[]
}

const eligibleEntries = computed(() => {
  return (allMatches.value ?? [])
    .filter(m => ['scheduled', 'live', 'finished'].includes(m.status))
    .map(match => ({
      match,
      prediction: predictionsMap.value.get(match.id) ?? null,
    }))
})

const dateBuckets = computed<DateBucket[]>(() => {
  const map = new Map<string, DateBucket>()
  for (const entry of eligibleEntries.value) {
    const key = dateKeyOf(entry.match.kickoff_at)
    let bucket = map.get(key)
    if (!bucket) {
      bucket = { key, label: dateLabelOf(entry.match.kickoff_at), count: 0, entries: [] }
      map.set(key, bucket)
    }
    bucket.entries.push(entry)
    bucket.count += 1
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
})

const activeDate = ref<string | null>(null)
const showAllDates = ref(false)

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

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

onMounted(async () => {
  try {
    const [, memberData] = await Promise.all([
      loadMatches(),
      predClient.getMemberPredictions(roomId, memberId),
    ])
    displayName.value = memberData.display_name
    const map = new Map<string, Prediction>()
    for (const pred of memberData.predictions) {
      map.set(pred.match_id, pred)
    }
    predictionsMap.value = map
  }
  catch (e) {
    loadError.value = e instanceof Error ? e.message : 'No se pudieron cargar las predicciones'
  }
  finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="mx-auto w-full max-w-3xl space-y-8">
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
              Predicciones de
              <span class="text-primary">{{ displayName || '…' }}</span>
            </h1>
            <p class="text-sm text-muted-foreground sm:text-base">
              Solo se muestran los pronósticos de partidos que ya empezaron.
            </p>
          </div>
        </div>
      </header>

      <p
        v-if="isLoading"
        class="text-sm text-muted-foreground"
      >
        Cargando predicciones…
      </p>

      <p
        v-else-if="loadError"
        class="text-sm text-destructive"
        role="alert"
      >
        {{ loadError }}
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
            Todavía no hay partidos disponibles
          </p>
        </div>

        <div
          v-else
          class="space-y-4"
        >
          <!-- Matchday navigator -->
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
                  {{ activeBucket?.count }} {{ activeBucket?.count === 1 ? 'partido' : 'partidos' }}
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

            <button
              v-if="dateBuckets.length > 1"
              type="button"
              class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              @click="showAllDates = !showAllDates"
            >
              <CalendarDays class="size-3.5" />
              {{ showAllDates ? 'Ocultar jornadas' : `Ver todas las jornadas (${dateBuckets.length})` }}
            </button>

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
              </button>
            </div>
          </div>

          <!-- Match cards (read-only) -->
          <div class="space-y-4">
            <template
              v-for="entry in visibleEntries"
              :key="entry.match.id"
            >
              <!-- Locked prediction: show the member's pick -->
              <div
                v-if="entry.prediction"
                class="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl"
                data-testid="member-prediction-card"
              >
                <!-- Header -->
                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {{ entry.match.stage }}<span v-if="entry.match.group_name"> · Grupo {{ entry.match.group_name }}</span>
                  </p>
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    🔒 Revelada
                  </span>
                </div>

                <!-- Teams + predicted score -->
                <div class="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-5">
                  <div class="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                    <TeamFlag
                      :team="entry.match.home_team"
                      :size="40"
                    />
                    <span class="w-full truncate text-sm font-semibold">{{ entry.match.home_team }}</span>
                  </div>

                  <!-- Predicted score (read-only display) -->
                  <div class="flex shrink-0 items-center gap-2">
                    <span class="flex size-14 items-center justify-center rounded-lg border border-border bg-background text-2xl font-bold tabular-nums opacity-80">
                      {{ entry.prediction.predicted_home }}
                    </span>
                    <span class="text-lg font-bold text-muted-foreground">-</span>
                    <span class="flex size-14 items-center justify-center rounded-lg border border-border bg-background text-2xl font-bold tabular-nums opacity-80">
                      {{ entry.prediction.predicted_away }}
                    </span>
                  </div>

                  <div class="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                    <TeamFlag
                      :team="entry.match.away_team"
                      :size="40"
                    />
                    <span class="w-full truncate text-sm font-semibold">{{ entry.match.away_team }}</span>
                  </div>
                </div>

                <p class="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Clock class="size-3.5" />
                  {{ formatKickoff(entry.match.kickoff_at) }}
                </p>

                <!-- Final score + points when finished -->
                <div
                  v-if="entry.match.status === 'finished' && entry.match.home_score != null && entry.match.away_score != null"
                  class="flex items-center justify-between gap-3"
                >
                  <div
                    class="flex-1 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-center text-sm font-semibold font-mono text-accent"
                    data-testid="final-score"
                  >
                    Final: {{ entry.match.home_score }} - {{ entry.match.away_score }}
                  </div>
                  <div
                    v-if="entry.prediction.points_awarded != null"
                    class="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-center text-sm font-bold text-primary"
                    data-testid="points-awarded"
                  >
                    {{ entry.prediction.points_awarded }} pts
                  </div>
                </div>
              </div>

              <!-- Match not started yet: the pick stays hidden until kickoff. -->
              <div
                v-else-if="entry.match.status === 'scheduled'"
                class="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-5"
                data-testid="hidden-prediction-card"
              >
                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Lock class="size-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">
                    {{ entry.match.home_team }} vs {{ entry.match.away_team }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    🔒 Se revela cuando empiece el partido
                  </p>
                </div>
                <p class="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {{ formatKickoff(entry.match.kickoff_at) }}
                </p>
              </div>

              <!-- Match already started but no locked prediction exists: the
                   member never submitted a pick. A submitted pick would have
                   been locked at kickoff and returned by the API, so its
                   absence here unambiguously means "no prediction sent". -->
              <div
                v-else
                class="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-5"
                data-testid="no-prediction-card"
              >
                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Ban class="size-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">
                    {{ entry.match.home_team }} vs {{ entry.match.away_team }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Sin predicción — no envió pronóstico para este partido
                  </p>
                </div>
                <p class="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {{ formatKickoff(entry.match.kickoff_at) }}
                </p>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
