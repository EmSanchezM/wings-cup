<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next'
import { Primitive } from 'reka-ui'

// ---------------------------------------------------------------------------
// Session-expired toast (R-UX-01, R-UX-02, R-UX-05)
//
// Renders only when useSessionExpired().isExpired is true.
// Dismiss × calls reset(). CTA calls reset() THEN navigateTo('/auth/login').
// Built with reka-ui Primitive — no new runtime dependencies.
// ---------------------------------------------------------------------------

const { isExpired, reset } = useSessionExpired()

async function handleCta() {
  reset()
  await navigateTo('/auth/login')
}
</script>

<template>
  <Primitive
    v-if="isExpired"
    as="div"
    data-testid="session-expired-toast"
    class="fixed bottom-6 right-6 z-50 w-full max-w-sm rounded-lg border border-yellow-300 bg-yellow-50 p-4 shadow-lg"
    role="alert"
  >
    <!-- Header row: icon + message + dismiss button -->
    <div class="flex items-start gap-3">
      <TriangleAlert
        class="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600"
        aria-hidden="true"
      />

      <p class="flex-1 text-sm text-yellow-900">
        Tu sesión expiró. Volvé a iniciar sesión para continuar.
      </p>

      <button
        type="button"
        data-testid="dismiss-btn"
        class="ml-2 flex-shrink-0 rounded p-0.5 text-yellow-700 hover:bg-yellow-100"
        aria-label="Cerrar"
        @click="reset()"
      >
        ×
      </button>
    </div>

    <!-- CTA -->
    <div class="mt-3 flex justify-end">
      <button
        type="button"
        data-testid="cta-btn"
        class="rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700"
        @click="handleCta"
      >
        Volver a iniciar sesión
      </button>
    </div>
  </Primitive>
</template>
