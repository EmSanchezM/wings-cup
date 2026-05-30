<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <SessionExpiredToast />
  </ClientOnly>
</template>
