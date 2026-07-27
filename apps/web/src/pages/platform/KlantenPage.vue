<script setup lang="ts">
import MwBanner from '../../components/MwBanner.vue';
import MwCard from '../../components/MwCard.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { useOrganizationMembers, useOrganizationProfile } from '../../api/organization';
import {
  formatScopeSummary,
  usePlatformNameResearchOrders,
  useNameResearchCredits,
} from '../../api/name-research';
import { useSubscription } from '../../api/subscription';
import { useWatchedTrademarks } from '../../api/watched-trademarks';
import PlatformPageHeader from './PlatformPageHeader.vue';

const profileQuery = useOrganizationProfile();
const membersQuery = useOrganizationMembers();
const subscriptionQuery = useSubscription();
const watchedQuery = useWatchedTrademarks();
const researchOrdersQuery = usePlatformNameResearchOrders();
const researchCreditsQuery = useNameResearchCredits();

const activeWatches = () =>
  (watchedQuery.data.value ?? []).filter((w) => w.status === 'active').length;
</script>

<template>
  <PlatformPageHeader
    title="Klanten"
    description="Klantorganisatie met doorgespeelde gegevens uit de klantomgeving (demo: één org)."
  >
    <MwCard title="Organisatieprofiel">
      <SkeletonBlock v-if="profileQuery.isLoading.value" height="6rem" />
      <MwBanner v-else-if="profileQuery.isError.value" tone="danger" title="Organisatie kon niet worden geladen" />
      <dl v-else-if="profileQuery.data.value" class="grid gap-3 sm:grid-cols-2">
        <div>
          <dt class="text-xs font-medium text-text-muted">Naam</dt>
          <dd class="mt-0.5 font-medium text-text">{{ profileQuery.data.value.legalName }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-text-muted">KVK</dt>
          <dd class="mt-0.5 text-sm text-text">{{ profileQuery.data.value.kvkNumber || '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-text-muted">Contact-e-mail</dt>
          <dd class="mt-0.5 text-sm text-text">{{ profileQuery.data.value.contactEmail || '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-text-muted">Facturatie-e-mail</dt>
          <dd class="mt-0.5 text-sm text-text">{{ profileQuery.data.value.billingEmail || '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-text-muted">Telefoon</dt>
          <dd class="mt-0.5 text-sm text-text">{{ profileQuery.data.value.phone || '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-text-muted">Adres</dt>
          <dd class="mt-0.5 text-sm text-text">
            {{
              [profileQuery.data.value.addressLine, profileQuery.data.value.postalCode, profileQuery.data.value.city]
                .filter(Boolean)
                .join(', ') || '—'
            }}
          </dd>
        </div>
      </dl>
    </MwCard>

    <div class="grid gap-4 lg:grid-cols-2">
      <MwCard title="Abonnement">
        <SkeletonBlock v-if="subscriptionQuery.isLoading.value" height="3rem" />
        <template v-else-if="subscriptionQuery.data.value">
          <p class="text-sm text-text">
            Plan:
            <span class="font-semibold capitalize">{{ subscriptionQuery.data.value.subscription.plan }}</span>
          </p>
          <p class="mt-1 text-sm text-text-muted">Status: {{ subscriptionQuery.data.value.subscription.status }}</p>
          <p class="mt-2 text-xs text-text-muted">
            Limiet merken: {{ subscriptionQuery.data.value.entitlements.maxWatchedTrademarks }} · Actief:
            {{ activeWatches() }}
          </p>
          <p v-if="watchedQuery.data.value?.[0]?.watchSettings" class="mt-2 text-xs text-text-muted">
            Voorbeeld drempel:
            {{ watchedQuery.data.value[0].watchSettings.minScoreThreshold }}% · Registers:
            {{ watchedQuery.data.value[0].watchSettings.watchedRegisters?.join(', ') || 'BOIP' }}
          </p>
        </template>
      </MwCard>

      <MwCard title="Gebruikers">
        <ul v-if="membersQuery.data.value?.length" class="divide-y divide-border">
          <li
            v-for="m in membersQuery.data.value"
            :key="m.id"
            class="flex items-center justify-between gap-2 py-2 text-sm"
          >
            <span>
              <span class="font-medium text-text">{{ m.displayName }}</span>
              <span class="block text-xs text-text-muted">{{ m.email }}</span>
            </span>
            <StatusBadge :label="m.role" tone="neutral" />
          </li>
        </ul>
        <p v-else class="text-sm text-text-muted">Geen leden geladen.</p>
      </MwCard>
    </div>

    <MwCard title="Merkonderzoek (deze klant)">
      <p class="text-sm text-text">
        Credits:
        <span class="font-semibold tabular-nums">{{ researchCreditsQuery.data.value?.balance ?? '—' }}</span>
        · gebruikt: {{ researchCreditsQuery.data.value?.usedThisPeriod ?? 0 }}
      </p>
      <ul
        v-if="researchOrdersQuery.data.value?.length"
        class="mt-3 divide-y divide-border"
      >
        <li
          v-for="order in researchOrdersQuery.data.value.slice(0, 8)"
          :key="order.id"
          class="flex items-center justify-between gap-2 py-2 text-sm"
        >
          <span>
            <span class="font-medium">{{ order.markText }}</span>
            <span class="block text-xs text-text-muted">
              {{ formatScopeSummary(order.scopes) }} · {{ order.status }}
            </span>
          </span>
          <StatusBadge
            :label="order.creditUsed ? 'credit' : `${(order.priceCents / 100).toFixed(0)}€`"
            tone="neutral"
          />
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-text-muted">Nog geen merkonderzoek-orders.</p>
    </MwCard>
  </PlatformPageHeader>
</template>
