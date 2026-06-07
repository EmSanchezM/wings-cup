<script setup lang="ts">
// Brand mark: a happy crispy chicken wing. Sizes via `class` (e.g. size-5),
// same as lucide icons. Defaults to 1em so it follows font-size when unstyled.
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 128 128"
    width="1em"
    height="1em"
    role="img"
    aria-label="Wings Cup"
  >
    <defs>
      <linearGradient id="wing-crispy" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#F2AE43" />
        <stop offset="1" stop-color="#C25E1E" />
      </linearGradient>
    </defs>

    <!-- bone -->
    <g fill="#FBF0DA" stroke="#E2CFA4" stroke-width="3">
      <rect x="55" y="20" width="18" height="36" rx="9" />
      <circle cx="54" cy="23" r="12" />
      <circle cx="74" cy="23" r="12" />
    </g>

    <!-- crispy meat -->
    <ellipse cx="64" cy="82" rx="41" ry="37" fill="url(#wing-crispy)" stroke="#974715" stroke-width="3" />

    <!-- crispy bits + shine -->
    <g fill="#9E4D18" opacity="0.45">
      <circle cx="46" cy="92" r="2.4" />
      <circle cx="80" cy="96" r="2.6" />
      <circle cx="70" cy="108" r="2.2" />
      <circle cx="54" cy="105" r="2" />
    </g>
    <ellipse cx="48" cy="66" rx="11" ry="7" fill="#FFFFFF" opacity="0.30" />

    <!-- happy face -->
    <circle cx="53" cy="78" r="6" fill="#FFFFFF" />
    <circle cx="75" cy="78" r="6" fill="#FFFFFF" />
    <circle cx="54" cy="79" r="3" fill="#2A1A10" />
    <circle cx="76" cy="79" r="3" fill="#2A1A10" />
    <path d="M50 90 Q64 103 78 90" fill="none" stroke="#2A1A10" stroke-width="3.5" stroke-linecap="round" />
    <path d="M44 70 Q50 66 57 69" fill="none" stroke="#974715" stroke-width="2.5" stroke-linecap="round" />
    <path d="M71 69 Q78 66 84 70" fill="none" stroke="#974715" stroke-width="2.5" stroke-linecap="round" />
  </svg>
</template>
