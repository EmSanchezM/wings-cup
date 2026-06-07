<script setup lang="ts">
const config = useRuntimeConfig()
const requestUrl = useRequestURL()
// Prefer configured canonical site URL; fall back to the request origin (works in dev + prod).
const origin = (config.public.siteUrl as string) || requestUrl.origin
const ogImage = `${origin}/og-image.jpg`

useHead({
  htmlAttrs: { lang: 'es' },
  titleTemplate: title => (title ? `${title} · Wings Cup` : 'Wings Cup · La quiniela entre amigos'),
  link: [{ rel: 'canonical', href: origin + requestUrl.pathname }],
})

useSeoMeta({
  description: 'Creá tu quiniela, invitá a tus amigos y demostrá quién sabe más de fútbol. Gratis, rápido y en tiempo real.',
  ogSiteName: 'Wings Cup',
  ogType: 'website',
  ogImage,
  ogImageType: 'image/jpeg',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Wings Cup',
  twitterCard: 'summary_large_image',
  twitterImage: ogImage,
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <SessionExpiredToast />
  </ClientOnly>
</template>
