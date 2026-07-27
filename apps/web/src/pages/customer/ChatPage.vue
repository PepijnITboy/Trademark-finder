<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import EmptyState from '../../components/EmptyState.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwField from '../../components/MwField.vue';
import MwPage from '../../components/MwPage.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { useChatThread, useChatThreads, useCreateChatThread, useSendChatMessage } from '../../api/chat';
import { useSubscription } from '../../api/subscription';
import { formatDateTime } from '../../lib/format';
import { useToastStore } from '../../stores/toast';

const subscriptionQuery = useSubscription();
const threadsQuery = useChatThreads();
const createThread = useCreateChatThread();
const sendMessage = useSendChatMessage();
const toast = useToastStore();

const chatEnabled = computed(() => subscriptionQuery.data.value?.entitlements.features.merkrechten_chat ?? false);

const selectedThreadId = ref<string | null>(null);
const threadDetailQuery = useChatThread(selectedThreadId);

const newMessage = ref('');
const showCreateThread = ref(false);
const threadForm = reactive({ subject: '', body: '' });

function selectThread(id: string): void {
  selectedThreadId.value = id;
}

function submitCreateThread(): void {
  createThread.mutate(
    { subject: threadForm.subject, body: threadForm.body },
    {
      onSuccess: ({ thread }) => {
        showCreateThread.value = false;
        threadForm.subject = '';
        threadForm.body = '';
        selectedThreadId.value = thread.id;
        toast.success('Gesprek gestart');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Gesprek starten mislukt'),
    },
  );
}

function submitMessage(): void {
  if (!selectedThreadId.value || !newMessage.value.trim()) return;
  sendMessage.mutate(
    { threadId: selectedThreadId.value, body: newMessage.value.trim() },
    {
      onSuccess: () => {
        newMessage.value = '';
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Bericht verzenden mislukt'),
    },
  );
}

function participantName(participantId: string): string {
  const participants = threadDetailQuery.data.value?.participants ?? [];
  return participants.find((p) => p.id === participantId)?.displayName ?? 'Onbekend';
}
</script>

<template>
  <MwPage title="Merkrechten-chat" description="Stel vragen aan Merkwacht over merkrecht en matches.">
    <SkeletonBlock v-if="subscriptionQuery.isLoading.value" height="16rem" />

    <EmptyState
      v-else-if="!chatEnabled"
      title="Chat niet beschikbaar in uw abonnement"
      description="Upgrade naar Pro of Enterprise om direct met Merkwacht te chatten over merkrechtelijke vragen."
    >
      <RouterLink
        :to="{ name: 'app-abonnement' }"
        class="inline-flex items-center justify-center rounded-md bg-accent-strong px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent"
      >
        Bekijk abonnementen
      </RouterLink>
    </EmptyState>

    <template v-else>
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <MwCard :padding="false">
          <template #header>
            <div class="flex items-center justify-between gap-2 px-5 py-4">
              <h2 class="text-base font-semibold text-text">Gesprekken</h2>
              <MwButton variant="primary" size="sm" @click="showCreateThread = true">Nieuw</MwButton>
            </div>
          </template>
          <div v-if="threadsQuery.isLoading.value" class="p-4">
            <SkeletonBlock height="8rem" />
          </div>
          <ul v-else-if="(threadsQuery.data.value ?? []).length > 0" class="divide-y divide-border">
            <li v-for="thread in threadsQuery.data.value" :key="thread.id">
              <button
                type="button"
                class="w-full px-5 py-3 text-left transition-colors hover:bg-surface-muted/60"
                :class="selectedThreadId === thread.id && 'bg-accent-soft/30'"
                @click="selectThread(thread.id)"
              >
                <p class="truncate text-sm font-medium text-text">{{ thread.subject }}</p>
                <div class="mt-1 flex items-center gap-2">
                  <StatusBadge :label="thread.status === 'open' ? 'Open' : 'Gesloten'" :tone="thread.status === 'open' ? 'success' : 'neutral'" />
                  <span class="text-xs text-text-muted">{{ formatDateTime(thread.updatedAt) }}</span>
                </div>
              </button>
            </li>
          </ul>
          <p v-else class="px-5 py-8 text-center text-sm text-text-muted">Nog geen gesprekken. Start een nieuw gesprek.</p>
        </MwCard>

        <MwCard>
          <template v-if="!selectedThreadId">
            <p class="text-sm text-text-muted">Selecteer een gesprek of start een nieuw gesprek.</p>
          </template>
          <template v-else-if="threadDetailQuery.isLoading.value">
            <SkeletonBlock height="12rem" />
          </template>
          <template v-else-if="threadDetailQuery.data.value">
            <h2 class="text-base font-semibold text-text">{{ threadDetailQuery.data.value.thread.subject }}</h2>
            <div class="mt-4 max-h-[24rem] space-y-3 overflow-y-auto">
              <div
                v-for="message in threadDetailQuery.data.value.messages"
                :key="message.id"
                class="rounded-md border border-border bg-surface-muted/40 px-4 py-3"
              >
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-xs font-medium text-text">{{ participantName(message.participantId) }}</span>
                  <span class="text-xs text-text-muted">{{ formatDateTime(message.createdAt) }}</span>
                </div>
                <p class="mt-1 whitespace-pre-wrap text-sm text-text">{{ message.body }}</p>
              </div>
            </div>
            <form class="mt-4 flex gap-2" @submit.prevent="submitMessage">
              <input
                v-model="newMessage"
                type="text"
                placeholder="Typ uw bericht…"
                class="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
              <MwButton type="submit" variant="primary" :disabled="!newMessage.trim()" :loading="sendMessage.isPending.value">
                Versturen
              </MwButton>
            </form>
          </template>
        </MwCard>
      </div>
    </template>

    <ConfirmDialog
      :open="showCreateThread"
      title="Nieuw gesprek"
      confirm-label="Starten"
      :busy="createThread.isPending.value"
      @confirm="submitCreateThread"
      @cancel="showCreateThread = false"
    >
      <div class="space-y-4">
        <MwField label="Onderwerp" for-id="thread-subject" required>
          <input
            id="thread-subject"
            v-model="threadForm.subject"
            type="text"
            required
            minlength="3"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </MwField>
        <MwField label="Bericht" for-id="thread-body" required>
          <textarea
            id="thread-body"
            v-model="threadForm.body"
            required
            rows="4"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </MwField>
      </div>
    </ConfirmDialog>
  </MwPage>
</template>
