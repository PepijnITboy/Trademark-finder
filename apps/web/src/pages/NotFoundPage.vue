<script setup lang="ts"></script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background text-text">
    <div class="space-y-2 text-center">
      <h1 class="text-2xl font-semibold">Pagina niet gevonden</h1>
      <p class="text-text-muted">De opgevraagde pagina bestaat niet.</p>
      <RouterLink to="/app/dashboard" class="text-accent underline">Terug naar dashboard</RouterLink>
    </div>
  </div>
</template>
