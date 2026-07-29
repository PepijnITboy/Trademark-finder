<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import {
  FEATURE_LABELS_NL,
  PLAN_ORDER,
  SUBSCRIPTION_STATUS_LABELS_NL,
  SUPPORT_TIER_LABELS_NL,
  useCancelAtPeriodEnd,
  useChangePlan,
  useSubscription,
  useSubscriptionPlans,
  useUndoCancelAtPeriodEnd,
} from '../../api/subscription';
import type { FeatureFlag, PlanCatalogRecord, SubscriptionPlan } from '../../api/types';
import { useNotificationRecipients } from '../../api/notification-recipients';
import { useWatchedTrademarks } from '../../api/watched-trademarks';
import { formatDate } from '../../lib/format';
import { useToastStore } from '../../stores/toast';

const subscriptionQuery = useSubscription();
const plansQuery = useSubscriptionPlans();
const watchedQuery = useWatchedTrademarks();
const recipientsQuery = useNotificationRecipients();
const changePlan = useChangePlan();
const cancelAtEnd = useCancelAtPeriodEnd();
const undoCancel = useUndoCancelAtPeriodEnd();
const toast = useToastStore();

const subscription = computed(() => subscriptionQuery.data.value?.subscription);
const entitlements = computed(() => subscriptionQuery.data.value?.entitlements);

const activeWatchCount = computed(
  () => (watchedQuery.data.value ?? []).filter((w) => w.status === 'active').length,
);
const recipientCount = computed(() => recipientsQuery.data.value?.length ?? 0);

const currentPlanCode = computed(() => subscription.value?.plan ?? entitlements.value?.plan);

const sortedPlans = computed(() => {
  const plans = plansQuery.data.value ?? [];
  return [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.code) - PLAN_ORDER.indexOf(b.code));
});

const enabledFeatures = computed(() => {
  const features = entitlements.value?.features;
  if (!features) return [];
  return (Object.entries(features) as [FeatureFlag, boolean][])
    .filter(([, enabled]) => enabled)
    .map(([flag]) => flag);
});

function planActionLabel(plan: PlanCatalogRecord): string | null {
  const current = currentPlanCode.value;
  if (!current || plan.code === current) return null;
  const currentIdx = PLAN_ORDER.indexOf(current);
  const planIdx = PLAN_ORDER.indexOf(plan.code);
  if (planIdx > currentIdx) return 'Upgraden';
  return 'Downgraden';
}

function changeToPlan(plan: SubscriptionPlan): void {
  changePlan.mutate(plan, {
    onSuccess: () => toast.success('Abonnement bijgewerkt'),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Planwijziging mislukt'),
  });
}

const showCancelConfirm = ref(false);

function confirmCancel(): void {
  cancelAtEnd.mutate(undefined, {
    onSuccess: () => {
      showCancelConfirm.value = false;
      toast.success('Opzegging gepland aan einde periode');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Opzeggen mislukt'),
  });
}

function undoCancelRequest(): void {
  undoCancel.mutate(undefined, {
    onSuccess: () => toast.success('Opzegging ingetrokken'),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Intrekken mislukt'),
  });
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
</script>

<template>
  <MwPage title="Abonnement en verbruik" description="Inzicht in uw huidige abonnement, verbruik en beschikbare plannen.">
    <template #actions>
      <RouterLink
        :to="{ name: 'app-betalingen' }"
        class="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface-muted"
      >
        Naar betalingen
      </RouterLink>
    </template>

    <SkeletonBlock v-if="subscriptionQuery.isLoading.value" height="12rem" />

    <MwBanner v-else-if="subscriptionQuery.isError.value" tone="danger" title="Abonnement kon niet worden geladen">
      Probeer de pagina te verversen.
    </MwBanner>

    <template v-else-if="subscription && entitlements">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MwCard title="Huidig abonnement">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-2xl font-semibold capitalize text-text">{{ subscription.plan }}</span>
              <StatusBadge
                :label="SUBSCRIPTION_STATUS_LABELS_NL[subscription.status]"
                :tone="subscription.status === 'active' || subscription.status === 'trialing' ? 'success' : 'warning'"
              />
            </div>
            <p v-if="subscription.pendingPlan" class="text-sm text-text-muted">
              Geplande wijziging naar <strong>{{ subscription.pendingPlan }}</strong>
            </p>
            <p class="text-sm text-text-muted">
              Periode eindigt op {{ formatDate(subscription.currentPeriodEnd) }}
            </p>
            <p v-if="subscription.nextInvoiceAt" class="text-sm text-text-muted">
              Volgende factuur: {{ formatDate(subscription.nextInvoiceAt) }} (excl. 21% BTW op factuur)
            </p>
            <p v-if="subscription.cancelAtPeriodEnd" class="text-sm text-warning">
              Opzegging gepland — toegang tot {{ formatDate(subscription.currentPeriodEnd) }}
            </p>
            <div class="pt-2">
              <MwButton
                v-if="!subscription.cancelAtPeriodEnd"
                variant="danger"
                size="sm"
                @click="showCancelConfirm = true"
              >
                Opzeggen per einde periode
              </MwButton>
              <MwButton
                v-else
                variant="secondary"
                size="sm"
                :loading="undoCancel.isPending.value"
                @click="undoCancelRequest"
              >
                Opzegging intrekken
              </MwButton>
            </div>
            <p class="text-sm text-text-muted">
              Support: {{ SUPPORT_TIER_LABELS_NL[entitlements.supportTier] }}
            </p>
          </div>
        </MwCard>

        <MwCard title="Verbruik">
          <dl class="space-y-4">
            <div>
              <dt class="text-xs font-medium text-text-muted">Bewaakte merken</dt>
              <dd class="mt-1 text-2xl font-semibold tabular-nums text-text">
                {{ activeWatchCount }} / {{ entitlements.maxWatchedTrademarks }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-text-muted">Meldingsadressen</dt>
              <dd class="mt-1 text-2xl font-semibold tabular-nums text-text">
                {{ recipientCount }} / {{ entitlements.maxNotificationEmails }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-text-muted">Merkonderzoek</dt>
              <dd class="mt-1 text-sm text-text-muted">
                Pre-filing rapporten worden per aanvraag gefactureerd (zie Betalingen).
              </dd>
            </div>
          </dl>
        </MwCard>
      </div>

      <MwCard v-if="enabledFeatures.length > 0" title="Inbegrepen functies">
        <div class="flex flex-wrap gap-2">
          <StatusBadge v-for="flag in enabledFeatures" :key="flag" :label="FEATURE_LABELS_NL[flag]" tone="accent" />
        </div>
      </MwCard>

      <MwCard title="Beschikbare plannen">
        <SkeletonBlock v-if="plansQuery.isLoading.value" height="8rem" />
        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="plan in sortedPlans"
            :key="plan.code"
            class="flex flex-col rounded-lg border border-border p-5"
            :class="plan.code === currentPlanCode && 'border-accent bg-accent-soft/20'"
          >
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-lg font-semibold text-text">{{ plan.displayNameNl }}</h3>
              <StatusBadge v-if="plan.code === currentPlanCode" label="Huidig" tone="accent" />
            </div>
            <p class="mt-1 text-2xl font-semibold tabular-nums text-text">{{ formatPrice(plan.priceMonthlyCents) }}<span class="text-sm font-normal text-text-muted">/mnd</span></p>
            <ul class="mt-4 flex-1 space-y-1 text-sm text-text-muted">
              <li>{{ plan.maxWatchedTrademarks }} bewaakte merken</li>
              <li>{{ plan.maxNotificationEmails }} meldingsadressen</li>
              <li>Support: {{ SUPPORT_TIER_LABELS_NL[plan.supportTier] }}</li>
            </ul>
            <MwButton
              v-if="planActionLabel(plan)"
              class="mt-4"
              :variant="planActionLabel(plan) === 'Upgraden' ? 'primary' : 'secondary'"
              block
              :loading="changePlan.isPending.value"
              @click="changeToPlan(plan.code)"
            >
              {{ planActionLabel(plan) }}
            </MwButton>
          </div>
        </div>
      </MwCard>
    </template>

    <ConfirmDialog
      :open="showCancelConfirm"
      title="Abonnement opzeggen"
      :description="subscription ? `Uw abonnement blijft actief tot ${formatDate(subscription.currentPeriodEnd)}. Daarna wordt er geen nieuwe factuur meer aangemaakt.` : undefined"
      tone="danger"
      confirm-label="Opzeggen"
      :busy="cancelAtEnd.isPending.value"
      @confirm="confirmCancel"
      @cancel="showCancelConfirm = false"
    />
  </MwPage>
</template>
