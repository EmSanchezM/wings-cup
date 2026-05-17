<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Room, RoomMember } from '~~/shared/types/rooms'

const route = useRoute()
const roomClient = useRoom()
const roomId = route.params.id as string

const room = ref<Room | null>(null)
const members = ref<RoomMember[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const result = await roomClient.getRoom(roomId)
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
        <header class="space-y-2">
          <NuxtLink
            to="/rooms"
            class="text-xs text-muted-foreground hover:underline"
          >
            ← Volver a Salas
          </NuxtLink>
          <h1 class="text-2xl font-bold tracking-tight">
            {{ room.name }}
          </h1>
          <p
            v-if="room.prize_description"
            class="text-sm text-muted-foreground"
          >
            Premio: {{ room.prize_description }}
          </p>
          <p class="text-xs font-mono text-muted-foreground">
            Código de invitación: {{ room.invite_code }}
          </p>
        </header>

        <section class="space-y-3 rounded-lg border p-4">
          <h2 class="text-sm font-semibold">
            Miembros ({{ members.length }})
          </h2>
          <ul class="space-y-1">
            <li
              v-for="member in members"
              :key="member.user_id"
              class="text-sm text-muted-foreground flex items-center justify-between"
            >
              <span class="font-mono text-xs">{{ member.user_id }}</span>
              <span class="text-xs uppercase">{{ member.role }}</span>
            </li>
          </ul>
        </section>

        <section class="space-y-2 rounded-lg border border-dashed p-4">
          <h2 class="text-sm font-semibold">
            Predicciones
          </h2>
          <p class="text-sm text-muted-foreground">
            Próximamente — disponible en la siguiente entrega.
          </p>
        </section>
      </template>
    </div>
  </div>
</template>
