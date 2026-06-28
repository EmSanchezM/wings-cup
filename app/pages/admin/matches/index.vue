<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Shield, Lock, Clock, Pencil, ChevronLeft, ChevronRight, CalendarDays, HelpCircle, ChevronDown } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import type { MatchListItem, MatchUpdate } from '#shared/types/matches'

definePageMeta({ layout: 'admin' })

type BadgeVariant = 'secondary' | 'destructive' | 'outline' | 'accent'
const statusVariant: Record<string, BadgeVariant> = {
  scheduled: 'secondary',
  live: 'destructive',
  finished: 'outline',
  postponed: 'accent',
}
const statusLabel: Record<string, string> = {
  scheduled: 'Programado',
  live: 'En vivo',
  finished: 'Finalizado',
  postponed: 'Pospuesto',
}

const statusGuide: { value: string, label: string, variant: BadgeVariant, help: string }[] = [
  {
    value: 'scheduled',
    label: 'Programado',
    variant: 'secondary',
    help: 'El partido todavía no empezó. Los jugadores pueden cargar y editar sus pronósticos. No hay nada que hacer.',
  },
  {
    value: 'live',
    label: 'En vivo',
    variant: 'destructive',
    help: 'El partido está en juego. Los pronósticos ya quedaron cerrados. Podés ir cargando el marcador, pero los puntos recién se reparten al finalizar.',
  },
  {
    value: 'finished',
    label: 'Finalizado',
    variant: 'outline',
    help: 'El partido terminó. Cargá el marcador final (ambos goles) y poné el estado en Finalizado: eso reparte los puntos a todos automáticamente. Ojo: sin marcador cargado no se calcula nada.',
  },
  {
    value: 'postponed',
    label: 'Pospuesto',
    variant: 'accent',
    help: 'El partido se suspendió o reprogramó. Queda fuera de los pronósticos hasta que tenga una nueva fecha.',
  },
]
const showGuide = ref(false)

interface EditDraft {
  status: NonNullable<MatchUpdate['status']>
  home_score: number | undefined
  away_score: number | undefined
  home_penalties: number | undefined
  away_penalties: number | undefined
}

const router = useRouter()

const matchesState = useMatches()
const isAuthorised = ref(false)
const checkingAuth = ref(true)

const editDrafts = reactive<Record<string, EditDraft | undefined>>({})
const savingId = ref<string | null>(null)
const saveError = ref<string | null>(null)
const lockingNow = ref(false)
const lockedCount = ref<number | null>(null)

interface MatchBucket {
  key: string
  label: string
  count: number
  matches: MatchListItem[]
}
function dateKeyOf(kickoffAt: string): string {
  return new Date(kickoffAt).toLocaleDateString('en-CA')
}
function dateLabelOf(kickoffAt: string): string {
  return new Date(kickoffAt).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}
const dateBuckets = computed<MatchBucket[]>(() => {
  const map = new Map<string, MatchBucket>()
  for (const m of matchesState.data.value) {
    const key = dateKeyOf(m.kickoff_at)
    let bucket = map.get(key)
    if (!bucket) {
      bucket = { key, label: dateLabelOf(m.kickoff_at), count: 0, matches: [] }
      map.set(key, bucket)
    }
    bucket.matches.push(m)
    bucket.count += 1
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
})
const activeDate = ref<string | null>(null)
const showAllDates = ref(false)
const resolvedDate = computed<string | null>(() => {
  const buckets = dateBuckets.value
  if (buckets.length === 0) return null
  if (activeDate.value && buckets.some(b => b.key === activeDate.value)) return activeDate.value
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
const visibleMatches = computed(() => {
  const key = resolvedDate.value
  if (!key) return []
  return dateBuckets.value.find(b => b.key === key)?.matches ?? []
})

async function ensureSuperAdmin() {
  const { reason } = await $fetch<{
    isSuperAdmin: boolean
    reason: 'authorized' | 'forbidden' | 'unauthenticated'
  }>('/api/me/is-super-admin')

  switch (reason) {
    case 'authorized':
      isAuthorised.value = true
      await matchesState.load()
      break
    case 'forbidden':
      await router.replace('/')
      break
    case 'unauthenticated':
      useSessionExpired().setExpired()
      break
  }
}

function startEdit(match: MatchListItem) {
  if (editDrafts[match.id]) return
  editDrafts[match.id] = {
    status: match.status,
    home_score: match.home_score ?? undefined,
    away_score: match.away_score ?? undefined,
    home_penalties: match.home_penalties ?? undefined,
    away_penalties: match.away_penalties ?? undefined,
  }
}

function cancelEdit(id: string) {
  editDrafts[id] = undefined
}

// Penalties only apply to a knockout tie: non-group stage with an equal score.
function isKnockoutDraw(match: MatchListItem): boolean {
  const draft = editDrafts[match.id]
  if (!draft) return false
  return (
    match.stage !== 'group'
    && typeof draft.home_score === 'number'
    && typeof draft.away_score === 'number'
    && draft.home_score === draft.away_score
  )
}

async function saveEdit(id: string) {
  const draft = editDrafts[id]
  if (!draft) return

  const match = matchesState.data.value.find(m => m.id === id)
  const knockoutDraw = match != null && isKnockoutDraw(match)

  // A finished knockout tie must name a penalty winner so the bracket advances.
  if (draft.status === 'finished' && knockoutDraw) {
    if (typeof draft.home_penalties !== 'number' || typeof draft.away_penalties !== 'number') {
      saveError.value = 'Empate en eliminatoria: cargá los penales de ambos equipos.'
      return
    }
    if (draft.home_penalties === draft.away_penalties) {
      saveError.value = 'Los penales no pueden quedar empatados — tiene que haber un ganador.'
      return
    }
  }

  // Send penalties only for a knockout tie; otherwise clear them (both null).
  const payload: MatchUpdate = {
    ...draft,
    home_penalties: knockoutDraw ? (draft.home_penalties ?? null) : null,
    away_penalties: knockoutDraw ? (draft.away_penalties ?? null) : null,
  }

  savingId.value = id
  saveError.value = null
  try {
    await matchesState.updateMatch(id, payload)
    editDrafts[id] = undefined
    await matchesState.load()
  }
  catch (err) {
    saveError.value = err instanceof Error ? err.message : 'No se pudo guardar'
  }
  finally {
    savingId.value = null
  }
}

async function handleLockNow() {
  lockingNow.value = true
  saveError.value = null
  try {
    const result = await matchesState.lockNow()
    lockedCount.value = result.locked
  }
  catch (err) {
    saveError.value = err instanceof Error ? err.message : 'No se pudo bloquear'
  }
  finally {
    lockingNow.value = false
  }
}

onMounted(async () => {
  try {
    await ensureSuperAdmin()
  }
  catch {
    // Network or unexpected error: fail safe by redirecting to root
    await router.replace('/')
  }
  finally {
    checkingAuth.value = false
  }
})
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div
      v-if="checkingAuth"
      class="mx-auto max-w-3xl text-sm text-muted-foreground"
    >
      Verificando permisos…
    </div>

    <div
      v-else-if="isAuthorised"
      class="mx-auto w-full max-w-4xl space-y-6"
    >
      <header class="flex items-start gap-4">
        <span class="hidden size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent sm:flex">
          <Shield class="size-6" />
        </span>
        <div class="space-y-1">
          <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
            Partidos
          </h1>
          <p class="text-sm text-muted-foreground sm:text-base">
            Cargá resultados y bloqueá predicciones de partidos que ya comenzaron.
          </p>
        </div>
      </header>

      <section class="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex items-start gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Lock class="size-5" />
            </span>
            <div class="space-y-1">
              <p class="text-sm font-semibold">
                Bloquear predicciones
              </p>
              <p class="max-w-prose text-xs leading-relaxed text-muted-foreground">
                Congela de una sola vez los pronósticos de
                <span class="font-medium text-foreground">todos los partidos que ya empezaron</span>
                (su horario de inicio ya pasó). Quedan cerrados: el jugador no los
                puede modificar y los ve con un candado 🔒. No afecta a los partidos
                que todavía no arrancaron.
              </p>
            </div>
          </div>
          <Button
            class="shrink-0"
            :disabled="lockingNow"
            @click="handleLockNow"
          >
            <Lock class="size-4" />
            {{ lockingNow ? 'Bloqueando…' : 'Bloquear ahora' }}
          </Button>
        </div>

        <!-- Result feedback -->
        <p
          v-if="lockedCount !== null"
          class="rounded-lg border px-3 py-2 text-xs"
          :class="lockedCount > 0
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border bg-secondary/40 text-muted-foreground'"
          role="status"
        >
          <template v-if="lockedCount > 0">
            Se {{ lockedCount === 1 ? 'bloqueó' : 'bloquearon' }}
            {{ lockedCount }} {{ lockedCount === 1 ? 'predicción' : 'predicciones' }}.
          </template>
          <template v-else>
            No había predicciones nuevas para bloquear — todo al día.
          </template>
        </p>
      </section>

      <p
        v-if="saveError"
        class="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive"
        role="alert"
      >
        {{ saveError }}
      </p>

      <!-- Status guide — what each state means and what to do -->
      <section class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-xl">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 text-left"
          :aria-expanded="showGuide"
          @click="showGuide = !showGuide"
        >
          <span class="flex items-center gap-2 text-sm font-semibold">
            <HelpCircle class="size-4 text-accent" />
            ¿Qué significa cada estado?
          </span>
          <ChevronDown
            class="size-4 shrink-0 text-muted-foreground transition-transform"
            :class="showGuide ? 'rotate-180' : ''"
          />
        </button>

        <ul
          v-if="showGuide"
          class="space-y-3 border-t border-border pt-3"
        >
          <li
            v-for="s in statusGuide"
            :key="s.value"
            class="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3"
          >
            <Badge
              :variant="s.variant"
              class="w-fit shrink-0 sm:w-24 sm:justify-center"
            >
              {{ s.label }}
            </Badge>
            <p class="text-xs leading-relaxed text-muted-foreground">
              {{ s.help }}
            </p>
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-sm font-semibold">
          Partidos ({{ matchesState.data.value.length }})
        </h2>

        <p
          v-if="matchesState.pending.value"
          class="text-sm text-muted-foreground"
        >
          Cargando partidos…
        </p>

        <template v-else>
          <!-- Matchday navigator -->
          <div
            v-if="dateBuckets.length"
            class="space-y-2"
          >
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
                <p class="text-sm font-semibold capitalize">
                  {{ activeBucket?.label }}
                </p>
                <p class="text-xs text-muted-foreground tabular-nums">
                  {{ activeBucket?.count }} partido<span v-if="(activeBucket?.count ?? 0) !== 1">s</span>
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
            >
              <button
                v-for="bucket in dateBuckets"
                :key="bucket.key"
                type="button"
                class="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors"
                :class="bucket.key === resolvedDate
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'"
                @click="activeDate = bucket.key; showAllDates = false"
              >
                {{ bucket.label }}
                <span
                  class="rounded-full px-1.5 tabular-nums"
                  :class="bucket.key === resolvedDate ? 'bg-primary-foreground/20' : 'bg-secondary'"
                >
                  {{ bucket.count }}
                </span>
              </button>
            </div>
          </div>

          <ul class="space-y-3">
            <li
              v-for="match in visibleMatches"
              :key="match.id"
              data-testid="admin-match-row"
              class="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <span class="flex items-center gap-2 text-sm font-semibold">
                  <TeamFlag
                    :team="match.home_team"
                    :size="24"
                  />
                  {{ match.home_team }}
                  <span class="text-xs font-normal text-muted-foreground">vs</span>
                  {{ match.away_team }}
                  <TeamFlag
                    :team="match.away_team"
                    :size="24"
                  />
                </span>
                <Badge
                  data-testid="admin-status-badge"
                  :variant="statusVariant[match.status] ?? 'secondary'"
                >
                  {{ statusLabel[match.status] ?? match.status }}
                </Badge>
              </div>

              <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock class="size-3.5 shrink-0" />
                {{ match.stage }}<span v-if="match.group_name"> · Grupo {{ match.group_name }}</span> · {{ new Date(match.kickoff_at).toLocaleString() }}
              </p>

              <div
                v-if="!editDrafts[match.id]"
                class="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-3"
              >
                <span class="text-sm text-muted-foreground">
                  Marcador
                  <span class="ml-2 font-mono text-lg font-bold text-foreground">{{ match.home_score ?? '–' }} - {{ match.away_score ?? '–' }}</span>
                  <span
                    v-if="match.home_penalties != null && match.away_penalties != null"
                    class="ml-2 text-xs font-medium text-accent"
                  >
                    (pen. {{ match.home_penalties }}-{{ match.away_penalties }})
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  @click="startEdit(match)"
                >
                  <Pencil class="size-3.5" />
                  Editar
                </Button>
              </div>

              <form
                v-else
                class="space-y-2"
                @submit.prevent="saveEdit(match.id)"
              >
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                  <select
                    v-model="editDrafts[match.id]!.status"
                    class="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="scheduled">
                      Programado
                    </option>
                    <option value="live">
                      En vivo
                    </option>
                    <option value="finished">
                      Finalizado
                    </option>
                    <option value="postponed">
                      Pospuesto
                    </option>
                  </select>
                  <Input
                    v-model.number="editDrafts[match.id]!.home_score"
                    type="number"
                    min="0"
                    max="50"
                    placeholder="Local"
                    class="w-20"
                  />
                  <Input
                    v-model.number="editDrafts[match.id]!.away_score"
                    type="number"
                    min="0"
                    max="50"
                    placeholder="Visita"
                    class="w-20"
                  />
                  <div class="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      :disabled="savingId === match.id"
                    >
                      {{ savingId === match.id ? 'Guardando…' : 'Guardar' }}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      :disabled="savingId === match.id"
                      @click="cancelEdit(match.id)"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>

                <!-- Penalty shootout — only for a knockout tie. -->
                <div
                  v-if="isKnockoutDraw(match)"
                  data-testid="admin-penalties"
                  class="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2"
                >
                  <span class="text-xs font-medium text-muted-foreground">
                    Empate — definición por penales
                  </span>
                  <Input
                    v-model.number="editDrafts[match.id]!.home_penalties"
                    type="number"
                    min="0"
                    max="50"
                    placeholder="Pen. local"
                    class="w-24"
                  />
                  <span class="text-xs text-muted-foreground">-</span>
                  <Input
                    v-model.number="editDrafts[match.id]!.away_penalties"
                    type="number"
                    min="0"
                    max="50"
                    placeholder="Pen. visita"
                    class="w-24"
                  />
                </div>
              </form>
            </li>
          </ul>
        </template>
      </section>
    </div>
  </div>
</template>
