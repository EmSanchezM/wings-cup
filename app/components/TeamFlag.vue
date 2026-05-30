<script setup lang="ts">
import { computed } from 'vue'
import { flagSrc, teamInitials } from '~~/shared/constants/team-flags'

const props = withDefaults(
  defineProps<{
    /** Country name as stored in matches.home_team / away_team. */
    team: string
    /** Rendered size in pixels (square). */
    size?: number
  }>(),
  { size: 24 },
)

const src = computed(() => flagSrc(props.team))
const initials = computed(() => teamInitials(props.team))
const dimensions = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :alt="team"
    :style="dimensions"
    loading="lazy"
    class="shrink-0 rounded-full object-cover"
  >
  <span
    v-else
    :style="dimensions"
    :aria-label="team"
    role="img"
    class="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary text-[0.6em] font-semibold text-secondary-foreground"
  >{{ initials }}</span>
</template>
