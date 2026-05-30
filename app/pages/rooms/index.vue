<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { LayoutGrid, Trophy, Copy, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createRoomSchema } from '~~/shared/schemas/room.schema'
import type { CreateRoomInput } from '~~/shared/schemas/room.schema'
import type { RoomListItem } from '~~/shared/types/rooms'

// Auth enforced by @nuxtjs/supabase redirectOptions (covers /rooms/**)
const roomClient = useRoom()
const router = useRouter()

const rooms = ref<RoomListItem[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const isSubmitting = ref(false)

async function loadRooms() {
  isLoading.value = true
  error.value = null
  try {
    const result = await roomClient.listRooms()
    if (!result) return // 401: toast handles UX
    rooms.value = result
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar las salas'
  }
  finally {
    isLoading.value = false
  }
}

// The wizard emits the full payload (name + prize + scoring_rules).
async function handleCreate(payload: CreateRoomInput) {
  const parsed = createRoomSchema.safeParse(payload)
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Datos inválidos'
    return
  }

  isSubmitting.value = true
  error.value = null
  try {
    const room = await roomClient.createRoom(parsed.data)
    if (!room) return // 401: toast handles UX
    await router.push(`/rooms/${room.id}`)
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo crear la sala'
  }
  finally {
    isSubmitting.value = false
  }
}

function inviteUrl(code: string): string {
  if (typeof window === 'undefined') return `/join/${code}`
  return `${window.location.origin}/join/${code}`
}

// Copy-to-clipboard for invite links — transient per-room "copied" feedback.
const copiedCode = ref<string | null>(null)
async function copyInvite(code: string) {
  try {
    await navigator.clipboard.writeText(inviteUrl(code))
    copiedCode.value = code
    setTimeout(() => {
      if (copiedCode.value === code) copiedCode.value = null
    }, 2000)
  }
  catch {
    // Clipboard unavailable (insecure context / denied) — silently no-op.
  }
}

onMounted(loadRooms)
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="mx-auto w-full max-w-3xl space-y-8">
      <header class="flex items-start gap-4">
        <span class="hidden size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
          <LayoutGrid class="size-6" />
        </span>
        <div class="space-y-1">
          <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
            Tus <span class="text-primary">Salas</span>
          </h1>
          <p class="text-sm text-muted-foreground sm:text-base">
            Creá una sala o entrá a las que sos miembro.
          </p>
        </div>
      </header>

      <CreateRoomWizard
        :submitting="isSubmitting"
        @submit="handleCreate"
      />

      <section class="space-y-4">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tus salas
        </h2>

        <p
          v-if="isLoading"
          class="text-sm text-muted-foreground"
        >
          Cargando…
        </p>

        <div
          v-else-if="rooms.length === 0"
          class="space-y-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center"
        >
          <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <LayoutGrid class="size-6" />
          </span>
          <p class="text-sm text-muted-foreground">
            Todavía no participás en ninguna sala. Creá una arriba o pedí a alguien que te invite.
          </p>
        </div>

        <ul
          v-else
          class="grid gap-4 sm:grid-cols-2"
        >
          <li
            v-for="room in rooms"
            :key="room.id"
            class="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xl transition-colors hover:border-primary/40"
          >
            <div class="flex items-start justify-between gap-3">
              <NuxtLink
                :to="`/rooms/${room.id}`"
                class="text-base font-semibold tracking-tight transition-colors group-hover:text-primary"
              >
                {{ room.name }}
              </NuxtLink>
              <Badge
                variant="outline"
                class="shrink-0 font-mono"
              >
                {{ room.invite_code }}
              </Badge>
            </div>

            <p
              v-if="room.prize_description"
              class="flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <Trophy class="size-4 shrink-0 text-accent" />
              <span class="truncate">{{ room.prize_description }}</span>
            </p>

            <div class="mt-auto flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2">
              <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                {{ inviteUrl(room.invite_code) }}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="size-7 shrink-0"
                :aria-label="copiedCode === room.invite_code ? 'Link copiado' : 'Copiar link de invitación'"
                @click="copyInvite(room.invite_code)"
              >
                <Check
                  v-if="copiedCode === room.invite_code"
                  class="size-4 text-primary"
                />
                <Copy
                  v-else
                  class="size-4"
                />
              </Button>
            </div>
          </li>
        </ul>
      </section>

      <p
        v-if="error"
        class="text-sm text-destructive"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
  </div>
</template>
