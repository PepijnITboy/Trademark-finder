<script setup lang="ts">
import EmptyState from '../../components/EmptyState.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <div class="space-y-6">
    <PlatformPageHeader
      title="Accounts"
      description="Gebruikersaccounts van klantorganisaties en Merkwacht-medewerkers, inclusief rollen en toegang."
    />
    <EmptyState
      title="Accountbeheer nog niet gekoppeld"
      description="Deze pagina toont straks alle gebruikersaccounts, hun rol (klant, adviseur, platformbeheerder) en laatste inlogmoment. Authenticatie en gebruikersbeheer zijn nog niet aangesloten op deze omgeving — zie docs/security/security-model.md."
    />
  </div>
</template>
