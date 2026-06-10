<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { Trophy, Users, Flag, BarChart3, Copy, Check, Pencil, Target } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import type { Room, RoomMemberView } from '#shared/types/rooms'
import { updateRoomSchema } from '#shared/schemas/room.schema'
import type { UpdateRoomInput } from '#shared/schemas/room.schema'

// Auth enforced by @nuxtjs/supabase redirectOptions (covers /rooms/**)
const route = useRoute()
const roomClient = useRoom()
const roomId = route.params.id as string

const user = useSupabaseUser()
const { isSuperAdmin, ensure } = useSuperAdmin()

const room = ref<Room | null>(null)
const members = ref<RoomMemberView[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const isOwner = computed(() => !!user.value?.id && room.value?.created_by === user.value.id)
const canEdit = computed(() => isOwner.value || isSuperAdmin.value === true)

// Read-only scoring rules for the member-facing display.
// Cast through unknown to avoid TS2589 from Supabase's recursive Json type (see openEdit).
const scoringRules = computed(() => {
  const sr = (room.value as unknown as Record<string, unknown> | null)?.['scoring_rules'] as
    | Record<string, number>
    | null
    | undefined
  return {
    exact_score: sr?.['exact_score'] ?? 5,
    correct_goal_diff: sr?.['correct_goal_diff'] ?? 3,
    correct_result: sr?.['correct_result'] ?? 1,
  }
})

// Edit state
const isEditing = ref(false)
const editSubmitting = ref(false)
const editError = ref<string | null>(null)

const editName = ref('')
const editPrize = ref('')
const editRules = reactive({
  exact_score: 0,
  correct_goal_diff: 0,
  correct_result: 0,
  wrong: 0,
})

function openEdit() {
  if (!room.value) return
  // Cast to unknown first to cut TS recursion from the Json JSONB type in Room.
  // Using `as unknown as Record<string, unknown>` before property access avoids
  // TS2589 "type instantiation is excessively deep" caused by Supabase's recursive Json typedef.
  const r = room.value as unknown as Record<string, unknown>
  editName.value = r['name'] as string
  editPrize.value = (r['prize_description'] as string | null) ?? ''
  const sr = r['scoring_rules'] as Record<string, number> | null | undefined
  editRules.exact_score = sr?.['exact_score'] ?? 5
  editRules.correct_goal_diff = sr?.['correct_goal_diff'] ?? 3
  editRules.correct_result = sr?.['correct_result'] ?? 1
  editRules.wrong = sr?.['wrong'] ?? 0
  editError.value = null
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editError.value = null
}

// Maps the first Zod validation issue to a friendly Spanish message.
function firstEditMessage(issues: { path: (string | number)[], code: string }[]): string {
  const issue = issues[0]
  const field = issue?.path[issue.path.length - 1]
  if (field === 'name') {
    return 'El nombre debe tener al menos una letra o número.'
  }
  if (issue?.path[0] === 'scoring_rules') {
    if (issue.code === 'too_small') return 'Cada puntaje debe ser al menos 1.'
    if (issue.code === 'too_big') return 'Cada puntaje no puede superar 100.'
    return 'Los puntos deben ir de mayor a menor: marcador exacto > diferencia de gol > resultado.'
  }
  return 'Revisá los datos: hay un valor inválido.'
}

async function saveEdit() {
  if (!room.value) return
  const patch: UpdateRoomInput = {
    name: editName.value.trim(),
    prize_description: editPrize.value.trim(),
    scoring_rules: { ...editRules },
  }

  // Validate client-side against the same schema the API enforces, so the
  // user gets an immediate, friendly message instead of a raw 400.
  const check = updateRoomSchema.safeParse(patch)
  if (!check.success) {
    editError.value = firstEditMessage(check.error.issues)
    return
  }

  editSubmitting.value = true
  editError.value = null
  try {
    const updated = await roomClient.updateRoom(roomId, patch)
    if (!updated) return // 401 handled by guard
    room.value = updated
    isEditing.value = false
  }
  catch (err) {
    const status = (err as { statusCode?: number })?.statusCode
    const msg = (err as { statusMessage?: string })?.statusMessage
    if (status === 409 || msg === 'room_already_started') {
      editError.value = 'Las reglas ya no se pueden cambiar: el torneo arrancó.'
    }
    else if (status === 403 || msg === 'forbidden') {
      editError.value = 'No tenés permiso para editar esta sala.'
    }
    else {
      editError.value = err instanceof Error ? err.message : 'Error al guardar los cambios.'
    }
  }
  finally {
    editSubmitting.value = false
  }
}

const copied = ref(false)
async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
  catch {
    // Clipboard unavailable — silently no-op.
  }
}

function memberInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase()
  return (words[0] ?? '').slice(0, 2).toUpperCase() || '··'
}

onMounted(async () => {
  await ensure()
  try {
    const result = await roomClient.getRoom(roomId)
    if (!result) return // 401: toast handles UX
    room.value = result.room
    members.value = result.members
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar la sala'
  }
  finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="mx-auto w-full max-w-2xl space-y-8">
      <p
        v-if="isLoading"
        class="text-sm text-muted-foreground"
      >
        Cargando…
      </p>

      <p
        v-else-if="error"
        class="text-sm text-destructive"
        role="alert"
      >
        {{ error }}
      </p>

      <template v-else-if="room">
        <header class="space-y-4">
          <NuxtLink
            to="/rooms"
            class="inline-flex items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Volver a Salas
          </NuxtLink>
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
                {{ room.name }}
              </h1>
              <p
                v-if="room.prize_description"
                class="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Trophy class="size-4 shrink-0 text-accent" />
                {{ room.prize_description }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Badge
                variant="outline"
                class="font-mono"
              >
                {{ room.invite_code }}
              </Badge>
              <Button
                v-if="canEdit"
                type="button"
                variant="outline"
                size="sm"
                @click="openEdit"
              >
                <Pencil class="size-3.5" />
                Editar
              </Button>
            </div>
          </div>

          <!-- Invite code with copy -->
          <div class="flex items-center gap-2 rounded-xl bg-secondary/40 px-3 py-2">
            <span class="text-xs text-muted-foreground">Código de invitación</span>
            <span class="font-mono text-sm font-semibold">{{ room.invite_code }}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="ml-auto size-7"
              :aria-label="copied ? 'Copiado' : 'Copiar código'"
              @click="copyCode(room.invite_code)"
            >
              <Check
                v-if="copied"
                class="size-4 text-primary"
              />
              <Copy
                v-else
                class="size-4"
              />
            </Button>
          </div>
        </header>

        <!-- Edit form -->
        <section
          v-if="isEditing"
          class="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl"
        >
          <div class="flex items-center gap-2.5">
            <span class="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Pencil class="size-5" />
            </span>
            <h2 class="text-sm font-semibold">
              Editar sala
            </h2>
          </div>

          <div class="space-y-2">
            <label
              for="edit-name"
              class="text-sm font-medium"
            >Nombre</label>
            <Input
              id="edit-name"
              v-model="editName"
              maxlength="100"
            />
          </div>

          <div class="space-y-2">
            <label
              for="edit-prize"
              class="text-sm font-medium"
            >Premio <span class="font-normal text-muted-foreground">(opcional)</span></label>
            <Input
              id="edit-prize"
              v-model="editPrize"
              maxlength="500"
            />
          </div>

          <div class="space-y-3">
            <p class="text-sm font-medium">
              Puntos por acierto
            </p>

            <div class="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-3">
              <div class="min-w-0">
                <p class="text-sm font-medium">
                  Marcador exacto
                </p>
                <p class="text-xs text-muted-foreground">
                  Acertás el resultado completo.
                </p>
              </div>
              <input
                v-model.number="editRules.exact_score"
                type="number"
                min="1"
                max="100"
                aria-label="Puntos por marcador exacto"
                class="size-12 shrink-0 rounded-lg border border-input bg-background text-center text-lg font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              >
            </div>

            <div class="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-3">
              <div class="min-w-0">
                <p class="text-sm font-medium">
                  Diferencia de gol
                </p>
                <p class="text-xs text-muted-foreground">
                  Acertás la diferencia pero no el marcador.
                </p>
              </div>
              <input
                v-model.number="editRules.correct_goal_diff"
                type="number"
                min="1"
                max="100"
                aria-label="Puntos por diferencia de gol"
                class="size-12 shrink-0 rounded-lg border border-input bg-background text-center text-lg font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              >
            </div>

            <div class="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-3">
              <div class="min-w-0">
                <p class="text-sm font-medium">
                  Resultado (ganador o empate)
                </p>
                <p class="text-xs text-muted-foreground">
                  Acertás quién gana o el empate.
                </p>
              </div>
              <input
                v-model.number="editRules.correct_result"
                type="number"
                min="1"
                max="100"
                aria-label="Puntos por resultado correcto"
                class="size-12 shrink-0 rounded-lg border border-input bg-background text-center text-lg font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              >
            </div>

            <p class="text-xs text-muted-foreground">
              Las reglas solo se pueden editar antes de que arranque el torneo.
            </p>
          </div>

          <p
            v-if="editError"
            class="text-sm text-destructive"
            role="alert"
          >
            {{ editError }}
          </p>

          <div class="flex items-center gap-2 border-t border-border pt-4">
            <Button
              type="button"
              :disabled="editSubmitting"
              @click="saveEdit"
            >
              {{ editSubmitting ? 'Guardando…' : 'Guardar' }}
            </Button>
            <Button
              type="button"
              variant="ghost"
              :disabled="editSubmitting"
              @click="cancelEdit"
            >
              Cancelar
            </Button>
          </div>
        </section>

        <!-- Scoring rules (read-only, visible to every member) -->
        <section
          v-if="!isEditing"
          class="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl"
        >
          <div class="flex items-center gap-2.5">
            <span class="flex size-9 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Target class="size-5" />
            </span>
            <h2 class="text-sm font-semibold">
              Reglas de puntaje
            </h2>
          </div>

          <ul class="space-y-2">
            <li class="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-3">
              <div class="min-w-0">
                <p class="text-sm font-medium">
                  Marcador exacto
                </p>
                <p class="text-xs text-muted-foreground">
                  Acertás el resultado completo.
                </p>
              </div>
              <Badge
                variant="accent"
                class="shrink-0 font-mono text-sm tabular-nums"
              >
                +{{ scoringRules.exact_score }}
              </Badge>
            </li>

            <li class="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-3">
              <div class="min-w-0">
                <p class="text-sm font-medium">
                  Diferencia de gol
                </p>
                <p class="text-xs text-muted-foreground">
                  Acertás la diferencia pero no el marcador.
                </p>
              </div>
              <Badge
                variant="accent"
                class="shrink-0 font-mono text-sm tabular-nums"
              >
                +{{ scoringRules.correct_goal_diff }}
              </Badge>
            </li>

            <li class="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-3">
              <div class="min-w-0">
                <p class="text-sm font-medium">
                  Resultado (ganador o empate)
                </p>
                <p class="text-xs text-muted-foreground">
                  Acertás quién gana o el empate.
                </p>
              </div>
              <Badge
                variant="accent"
                class="shrink-0 font-mono text-sm tabular-nums"
              >
                +{{ scoringRules.correct_result }}
              </Badge>
            </li>
          </ul>
        </section>

        <!-- Members -->
        <section class="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl">
          <div class="flex items-center gap-2.5">
            <span class="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users class="size-5" />
            </span>
            <h2 class="text-sm font-semibold">
              Miembros <span class="text-muted-foreground">({{ members.length }})</span>
            </h2>
          </div>
          <ul class="space-y-1">
            <li
              v-for="member in members"
              :key="member.user_id"
              class="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/40"
            >
              <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                {{ memberInitials(member.display_name) }}
              </span>
              <span class="min-w-0 flex-1 truncate text-sm font-medium">
                {{ member.display_name || 'Sin nombre' }}
              </span>
              <Badge :variant="member.role === 'owner' ? 'accent' : 'secondary'">
                {{ member.role === 'owner' ? 'Dueño' : 'Miembro' }}
              </Badge>
            </li>
          </ul>
        </section>

        <!-- Actions -->
        <section class="grid gap-3 sm:grid-cols-2">
          <Button
            as-child
            size="lg"
            class="h-auto justify-start gap-3 py-4"
          >
            <NuxtLink :to="`/rooms/${roomId}/predictions`">
              <Flag class="size-5" />
              <span class="flex flex-col items-start">
                <span class="font-semibold">Mis Predicciones</span>
                <span class="text-xs font-normal opacity-80">Cargá tus marcadores</span>
              </span>
            </NuxtLink>
          </Button>
          <Button
            as-child
            variant="outline"
            size="lg"
            class="h-auto justify-start gap-3 py-4"
          >
            <NuxtLink :to="`/rooms/${roomId}/leaderboard`">
              <BarChart3 class="size-5 text-accent" />
              <span class="flex flex-col items-start">
                <span class="font-semibold">Tabla de Posiciones</span>
                <span class="text-xs font-normal text-muted-foreground">Quién va ganando</span>
              </span>
            </NuxtLink>
          </Button>
        </section>
      </template>
    </div>
  </div>
</template>
