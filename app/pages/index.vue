<script setup lang="ts">
import { Trophy, PlusCircle, UserPlus, Flag, ArrowRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

definePageMeta({ layout: false })

const year = new Date().getFullYear()

// Auth-aware CTAs: a logged-in visitor lands here (e.g. after logout it's the root,
// or via the URL) and should be sent to their rooms, not the login form.
const user = useSupabaseUser()
const isAuthed = computed(() => !!user.value)
const ctaTo = computed(() => (isAuthed.value ? '/rooms' : '/auth/login'))

const steps = [
  {
    icon: PlusCircle,
    title: '1. Creá tu grupo',
    text: 'Armá tu quiniela en segundos. Elegí el torneo y las reglas, y listo.',
  },
  {
    icon: UserPlus,
    title: '2. Invitá amigos',
    text: 'Compartí un enlace único. Sumarse es rápido y desde cualquier dispositivo.',
  },
  {
    icon: Flag,
    title: '3. Pronosticá y ganá',
    text: 'Cargá tus marcadores antes del pitazo inicial y subí en la tabla con cada acierto.',
  },
]
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Nav -->
    <header class="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
      <span class="flex items-center gap-2 text-lg font-bold tracking-tight">
        <Trophy class="size-5 text-accent" />
        <span>Wings <span class="text-primary">Cup</span></span>
      </span>
      <Button
        as-child
        size="sm"
      >
        <NuxtLink :to="ctaTo">
          {{ isAuthed ? 'Ir a mis salas' : 'Entrar' }}
        </NuxtLink>
      </Button>
    </header>

    <!-- Hero -->
    <main>
      <section
        data-testid="hero"
        class="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-8 lg:grid-cols-2 lg:py-20"
      >
        <div class="space-y-6">
          <span class="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span class="relative flex size-2">
              <span class="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span class="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            La nueva temporada está en vivo
          </span>

          <h1 class="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            La emoción del fútbol<br>
            se vive <span class="text-primary">entre amigos</span>
          </h1>

          <p class="max-w-md text-base text-muted-foreground sm:text-lg">
            Creá tu propia quiniela, invitá a tus amigos y demostrá quién sabe
            más de fútbol. Simple, rápido y en tiempo real.
          </p>

          <div class="flex flex-col gap-3 sm:flex-row">
            <Button
              as-child
              size="lg"
            >
              <NuxtLink :to="ctaTo">
                {{ isAuthed ? 'Ir a mis salas' : 'Empezá a predecir' }}
                <ArrowRight class="size-4" />
              </NuxtLink>
            </Button>
            <Button
              as-child
              variant="outline"
              size="lg"
            >
              <a href="#como-funciona">Ver cómo funciona</a>
            </Button>
          </div>

          <p class="text-sm text-muted-foreground">
            Gratis para tu grupo. Sin apuestas, solo gloria.
          </p>
        </div>

        <!-- Static decorative preview card (illustrative, no live data) -->
        <div
          aria-hidden="true"
          class="rounded-2xl border border-border bg-card p-5 shadow-xl"
        >
          <div class="mb-4 flex items-center justify-between text-xs">
            <span class="inline-flex items-center gap-1 font-semibold text-destructive">
              <span class="size-2 rounded-full bg-destructive" /> EN VIVO · Grupo B
            </span>
            <span class="text-muted-foreground">75'</span>
          </div>
          <div class="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-5">
            <div class="flex flex-col items-center gap-2">
              <TeamFlag
                team="Argentina"
                :size="40"
              />
              <span class="text-sm font-semibold">ARG</span>
            </div>
            <span class="text-3xl font-bold tracking-widest">2 - 1</span>
            <div class="flex flex-col items-center gap-2">
              <TeamFlag
                team="Chile"
                :size="40"
              />
              <span class="text-sm font-semibold">CHI</span>
            </div>
          </div>
          <div class="mt-4 flex items-center justify-between rounded-xl border border-border px-4 py-4 text-sm">
            <span class="text-muted-foreground">Grupo C · 18 JUN</span>
            <span class="flex items-center gap-2 font-medium">
              <TeamFlag
                team="Brazil"
                :size="20"
              />
              BRA <span class="text-muted-foreground">vs</span> COL
              <TeamFlag
                team="Colombia"
                :size="20"
              />
            </span>
          </div>
        </div>
      </section>

      <!-- Cómo Funciona -->
      <section
        id="como-funciona"
        data-testid="how-it-works"
        class="border-t border-border bg-card/30 py-16"
      >
        <div class="mx-auto w-full max-w-6xl px-4 sm:px-8">
          <div class="mx-auto max-w-2xl space-y-3 text-center">
            <h2 class="text-3xl font-bold tracking-tight">
              Cómo Funciona
            </h2>
            <p class="text-muted-foreground">
              Empezá tu quiniela en tres pasos. Diseñada para ser rápida,
              competitiva y sin complicaciones.
            </p>
          </div>

          <div class="mt-10 grid gap-6 sm:grid-cols-3">
            <div
              v-for="step in steps"
              :key="step.title"
              data-testid="step-card"
              class="space-y-3 rounded-xl border border-border bg-card p-6 text-center"
            >
              <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <component
                  :is="step.icon"
                  class="size-6"
                />
              </span>
              <h3 class="font-semibold">
                {{ step.title }}
              </h3>
              <p class="text-sm text-muted-foreground">
                {{ step.text }}
              </p>
            </div>
          </div>

          <div class="mt-10 text-center">
            <Button
              as-child
              size="lg"
            >
              <NuxtLink :to="ctaTo">
                {{ isAuthed ? 'Ir a mis salas' : 'Comenzá ahora' }}
                <ArrowRight class="size-4" />
              </NuxtLink>
            </Button>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="border-t border-border">
      <div class="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-8">
        <span class="flex items-center gap-2">
          <Trophy class="size-4 text-accent" />
          <span class="font-semibold text-foreground">Wings <span class="text-primary">Cup</span></span>
          <span>· © {{ year }}</span>
        </span>
        <nav class="flex gap-5">
          <a
            href="#"
            class="hover:text-foreground"
          >Reglas</a>
          <a
            href="#"
            class="hover:text-foreground"
          >Soporte</a>
          <a
            href="#"
            class="hover:text-foreground"
          >Privacidad</a>
        </nav>
      </div>
    </footer>
  </div>
</template>
