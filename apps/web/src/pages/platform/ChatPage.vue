<script setup lang="ts">
import { ref } from 'vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwField from '../../components/MwField.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { usePlatformChatThreads, useSendPlatformChatMessage } from '../../api/platform-org';
import type { PlatformChatThreadRecord } from '../../api/types';
import { formatDateTime } from '../../lib/format';
import PlatformPageHeader from './PlatformPageHeader.vue';
import { useToastStore } from '../../stores/toast';

const threadsQuery = usePlatformChatThreads();
const sendMessage = useSendPlatformChatMessage();
const toast = useToastStore();

const selectedThread = ref<PlatformChatThreadRecord | null>(null);
const replyBody = ref('');

function selectThread(thread: PlatformChatThreadRecord): void {
  selectedThread.value = thread;
  replyBody.value = '';
}

function submitReply(): void {
  if (!selectedThread.value || !replyBody.value.trim()) return;
  sendMessage.mutate(
    { threadId: selectedThread.value.id, body: replyBody.value.trim() },
    {
      onSuccess: () => {
        replyBody.value = '';
        toast.success('Antwoord verzonden');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Verzenden mislukt'),
    },
  );
}
</script>

<template>
  <PlatformPageHeader
    title="Chat"
    description="Support-inbox voor gesprekken met klantorganisaties."
  >
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <MwCard :padding="false">
        <template #header>
          <h2 class="px-5 py-4 text-base font-semibold text-text">Inbox</h2>
        </template>
        <div v-if="threadsQuery.isLoading.value" class="p-4">
          <SkeletonBlock height="10rem" />
        </div>
        <ul v-else-if="(threadsQuery.data.value ?? []).length > 0" class="divide-y divide-border">
          <li v-for="thread in threadsQuery.data.value" :key="thread.id">
            <button
              type="button"
              class="w-full px-5 py-3 text-left transition-colors hover:bg-surface-muted/60"
              :class="selectedThread?.id === thread.id && 'bg-accent-soft/30'"
              @click="selectThread(thread)"
            >
              <p class="truncate text-sm font-medium text-text">{{ thread.subject }}</p>
              <p class="mt-0.5 truncate text-xs text-text-muted">{{ thread.organizationName }}</p>
              <div class="mt-1 flex items-center gap-2">
                <StatusBadge :label="`${thread.messageCount} berichten`" tone="neutral" />
                <span class="text-xs text-text-muted">{{ formatDateTime(thread.updatedAt) }}</span>
              </div>
            </button>
          </li>
        </ul>
        <p v-else class="px-5 py-8 text-center text-sm text-text-muted">Geen open gesprekken.</p>
      </MwCard>

      <MwCard>
        <template v-if="!selectedThread">
          <p class="text-sm text-text-muted">Selecteer een gesprek om te antwoorden.</p>
        </template>
        <template v-else>
          <h2 class="text-base font-semibold text-text">{{ selectedThread.subject }}</h2>
          <p class="mt-1 text-sm text-text-muted">{{ selectedThread.organizationName }}</p>
          <div class="mt-2 flex items-center gap-2">
            <StatusBadge :label="selectedThread.status === 'open' ? 'Open' : 'Gesloten'" :tone="selectedThread.status === 'open' ? 'success' : 'neutral'" />
            <span class="text-xs text-text-muted">{{ selectedThread.messageCount }} berichten in thread</span>
          </div>
          <form class="mt-6 space-y-4" @submit.prevent="submitReply">
            <MwField label="Antwoord" for-id="platform-reply">
              <textarea
                id="platform-reply"
                v-model="replyBody"
                rows="5"
                required
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                placeholder="Typ uw antwoord aan de klant…"
              />
            </MwField>
            <MwButton type="submit" variant="primary" :disabled="!replyBody.trim()" :loading="sendMessage.isPending.value">
              Antwoord versturen
            </MwButton>
          </form>
        </template>
      </MwCard>
    </div>
  </PlatformPageHeader>
</template>
