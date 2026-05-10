<script setup lang="ts">
/**
 * Join page — invitation entry point (stub).
 * Full implementation in slice 2 (rooms).
 *
 * This route is excluded from the redirect guard via redirectOptions.exclude: ['/join/*']
 * so unauthenticated users can reach this page (S-AUTH-08).
 */

const route = useRoute()
const code = computed(() => route.params.code as string)
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="text-center space-y-2">
      <h1 class="text-xl font-semibold">
        Wings Cup
      </h1>
      <p class="text-sm text-muted-foreground">
        Accediendo a la sala con código <span class="font-mono font-medium">{{ code }}</span>…
      </p>
      <p class="text-xs text-muted-foreground">
        (Funcionalidad completa en slice 2)
      </p>
    </div>
  </div>
</template>
