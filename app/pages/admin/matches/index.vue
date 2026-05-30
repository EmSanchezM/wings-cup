<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MatchListItem, MatchUpdate } from '~~/shared/types/matches'

interface EditDraft {
  status: NonNullable<MatchUpdate['status']>
  home_score: number | undefined
  away_score: number | undefined
}

const router = useRouter()

const matchesState = useMatches()
const isAuthorised = ref(false)
const checkingAuth = ref(true)

const editDrafts = reactive<Record<string, EditDraft>>({})
const savingId = ref<string | null>(null)
const saveError = ref<string | null>(null)
const lockingNow = ref(false)
const lockedCount = ref<number | null>(null)

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
  }
}

function cancelEdit(id: string) {
  delete editDrafts[id]
}

async function saveEdit(id: string) {
  const draft = editDrafts[id]
  if (!draft) return
  savingId.value = id
  saveError.value = null
  try {
    await matchesState.updateMatch(id, draft)
    delete editDrafts[id]
    await matchesState.load()
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'No se pudo guardar'
  } finally {
    savingId.value = null
  }
}

async function handleLockNow() {
  lockingNow.value = true
  saveError.value = null
  try {
    const result = await matchesState.lockNow()
    lockedCount.value = result.locked
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'No se pudo bloquear'
  } finally {
    lockingNow.value = false
  }
}

onMounted(async () => {
  try {
    await ensureSuperAdmin()
  } catch {
    // Network or unexpected error: fail safe by redirecting to root
    await router.replace('/')
  } finally {
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
      <header class="space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">
          Admin · Partidos
        </h1>
        <p class="text-sm text-muted-foreground">
          Cargá resultados y bloqueá predicciones de partidos que ya comenzaron.
        </p>
      </header>

      <section class="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <Button
          :disabled="lockingNow"
          variant="default"
          @click="handleLockNow"
        >
          {{ lockingNow ? 'Bloqueando…' : 'Bloquear predicciones ahora' }}
        </Button>
        <p
          v-if="lockedCount !== null"
          class="text-sm text-muted-foreground"
        >
          {{ lockedCount }} predicciones bloqueadas.
        </p>
      </section>

      <p
        v-if="saveError"
        class="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"
        role="alert"
      >
        {{ saveError }}
      </p>

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

        <ul
          v-else
          class="space-y-2"
        >
          <li
            v-for="match in matchesState.data.value"
            :key="match.id"
            data-testid="admin-match-row"
            class="space-y-3 rounded-xl border bg-card p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span class="flex items-center gap-2 text-sm font-medium">
                <TeamFlag
                  :team="match.home_team"
                  :size="22"
                />
                {{ match.home_team }}
                <span class="text-xs text-muted-foreground">vs</span>
                {{ match.away_team }}
                <TeamFlag
                  :team="match.away_team"
                  :size="22"
                />
              </span>
              <span class="flex items-center gap-2">
                <span
                  data-testid="admin-status-badge"
                  class="inline-flex items-center rounded-md border border-transparent px-2 py-0.5 text-xs font-medium"
                  :class="{
                    'bg-secondary text-secondary-foreground': match.status === 'scheduled',
                    'bg-destructive text-destructive-foreground': match.status === 'live',
                    'border-border text-muted-foreground': match.status === 'finished',
                    'bg-accent text-accent-foreground': match.status === 'postponed',
                  }"
                >
                  {{ match.status }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ match.stage }}<span v-if="match.group_name"> · Grupo {{ match.group_name }}</span> · {{ new Date(match.kickoff_at).toLocaleString() }}
                </span>
              </span>
            </div>

            <div
              v-if="!editDrafts[match.id]"
              class="flex items-center justify-between"
            >
              <span class="text-sm text-muted-foreground">
                Marcador:
                <span class="font-mono font-semibold text-foreground">{{ match.home_score ?? '–' }} - {{ match.away_score ?? '–' }}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                @click="startEdit(match)"
              >
                Editar
              </Button>
            </div>

            <form
              v-else
              class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
              @submit.prevent="saveEdit(match.id)"
            >
              <select
                v-model="editDrafts[match.id]!.status"
                class="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="scheduled">
                  scheduled
                </option>
                <option value="live">
                  live
                </option>
                <option value="finished">
                  finished
                </option>
                <option value="postponed">
                  postponed
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
            </form>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
