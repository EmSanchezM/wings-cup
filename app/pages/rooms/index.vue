<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createRoomSchema } from '~~/shared/schemas/room.schema'
import type { RoomListItem } from '~~/shared/types/rooms'

const roomClient = useRoom()
const router = useRouter()

const rooms = ref<RoomListItem[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const name = ref('')
const prizeDescription = ref('')
const isSubmitting = ref(false)

async function loadRooms() {
  isLoading.value = true
  error.value = null
  try {
    rooms.value = await roomClient.listRooms()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar las salas'
  }
  finally {
    isLoading.value = false
  }
}

async function handleCreate() {
  const parsed = createRoomSchema.safeParse({
    name: name.value,
    prize_description: prizeDescription.value,
  })
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Datos inválidos'
    return
  }

  isSubmitting.value = true
  error.value = null
  try {
    const room = await roomClient.createRoom(parsed.data)
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

onMounted(loadRooms)
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="mx-auto w-full max-w-2xl space-y-8">
      <header class="space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">
          Salas
        </h1>
        <p class="text-sm text-muted-foreground">
          Creá una sala o entrá a las que sos miembro.
        </p>
      </header>

      <section class="space-y-3 rounded-lg border p-4">
        <h2 class="text-sm font-semibold">
          Crear sala
        </h2>
        <form
          class="space-y-3"
          @submit.prevent="handleCreate"
        >
          <Input
            v-model="name"
            placeholder="Nombre (ej. Amigos del fútbol)"
            maxlength="100"
            required
            :disabled="isSubmitting"
          />
          <Input
            v-model="prizeDescription"
            placeholder="Premio (opcional — ej. Una birra para el ganador)"
            maxlength="500"
            :disabled="isSubmitting"
          />
          <Button
            type="submit"
            class="w-full"
            :disabled="isSubmitting || !name.trim()"
          >
            {{ isSubmitting ? 'Creando…' : 'Crear sala' }}
          </Button>
        </form>
      </section>

      <section class="space-y-3">
        <h2 class="text-sm font-semibold">
          Tus salas
        </h2>

        <p
          v-if="isLoading"
          class="text-sm text-muted-foreground"
        >
          Cargando…
        </p>

        <p
          v-else-if="rooms.length === 0"
          class="text-sm text-muted-foreground"
        >
          Todavía no participás en ninguna sala. Creá una arriba o pedí a alguien que te invite.
        </p>

        <ul
          v-else
          class="space-y-2"
        >
          <li
            v-for="room in rooms"
            :key="room.id"
            class="rounded-lg border p-4 space-y-2"
          >
            <div class="flex items-baseline justify-between gap-3">
              <NuxtLink
                :to="`/rooms/${room.id}`"
                class="font-medium hover:underline"
              >
                {{ room.name }}
              </NuxtLink>
              <span class="text-xs font-mono text-muted-foreground">
                {{ room.invite_code }}
              </span>
            </div>
            <p
              v-if="room.prize_description"
              class="text-sm text-muted-foreground"
            >
              Premio: {{ room.prize_description }}
            </p>
            <p class="text-xs text-muted-foreground break-all">
              Link de invitación: <span class="font-mono">{{ inviteUrl(room.invite_code) }}</span>
            </p>
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
