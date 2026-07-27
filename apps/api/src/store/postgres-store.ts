import type { createSupabaseAdminClient } from '@merkwacht/database';
import type { MatchStatus as DomainMatchStatus, WatchedTrademarkStatus } from '@merkwacht/domain';
import { AppError, createId } from '@merkwacht/shared';
import type {
  AppStore,
  CreateWatchedTrademarkRecordInput,
  ListMatchesFilter,
  MatchNoteRecord,
  NotificationRecord,
  OrganizationSettingsRecord,
  RegisterSourceStatusRecord,
  TrademarkMatchRecord,
  UpdateOrganizationSettingsInput,
  UpdateWatchedTrademarkSettingsInput,
  WatchedTrademarkRecord,
} from './types.js';

/**
 * Postgres-backed `AppStore`, using `@merkwacht/database`'s admin
 * (service-role) Supabase client. Table/column names follow
 * `docs/database/schema.md`, with one deliberate simplification: matches
 * carry `organization_id` directly (denormalized from their watched
 * trademark) so this read-heavy API doesn't need a join for every list
 * query - revisit once real query performance data exists.
 *
 * NOTE: `supabase/migrations` does not yet define these tables in this
 * repository snapshot, so every call here will fail with a Postgres
 * "relation does not exist" error until that migration lands. That failure
 * is exactly what `create-store.ts`'s reachability check is meant to catch
 * (falling back to `DemoStore`) - see the "no fake data" rule in
 * `docs/connectors/connector-contract.md`, which applies equally to "don't
 * silently swallow a real database error and return an empty list".
 */
type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type Row = Record<string, unknown>;
type PostgrestError = { message: string };
type QueryResult = { data: Row[] | Row | null; error: PostgrestError | null };

/**
 * Loosely-typed query builder surface used instead of supabase-js's own
 * generated (per-table) builder types. `Database['public']['Tables']`
 * (`packages/database/src/types.ts`) is currently a structural placeholder
 * keyed by a generic `Record<string, ...>` index signature rather than
 * literal table names, which defeats supabase-js's usual per-table
 * `Insert`/`Update` type inference (every `.insert()`/`.update()` call
 * resolves to `never`). This interface restores a usable surface for the
 * handful of query-builder methods this store needs, at the cost of a
 * single documented `any` cast at the `.from()` boundary. Delete this
 * indirection once `packages/database/src/types.ts` is replaced with real
 * generated types.
 */
interface QueryBuilder {
  select(columns: string): QueryBuilder;
  insert(row: Row): QueryBuilder;
  update(row: Row): QueryBuilder;
  upsert(row: Row): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
  maybeSingle(): Promise<{ data: Row | null; error: PostgrestError | null }>;
  single(): Promise<{ data: Row; error: PostgrestError | null }>;
}

function table(client: SupabaseAdminClient, name: string): QueryBuilder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client.from as any)(name) as QueryBuilder;
}

/**
 * Resolves a `QueryBuilder` chain that ends without `.single()`/
 * `.maybeSingle()`. The cast is safe: at runtime every supabase-js query
 * builder is itself a thenable resolving to exactly this shape - the cast
 * only works around `QueryBuilder` not itself extending `PromiseLike`
 * (kept simple deliberately; see the comment on `QueryBuilder` above).
 */
function run(builder: QueryBuilder): Promise<QueryResult> {
  return builder as unknown as Promise<QueryResult>;
}

/** Normalizes a list-query's `data` (which may be `null`) into an array of rows. */
function toRowArray(data: Row[] | Row | null): Row[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

export class PostgresStore implements AppStore {
  readonly kind = 'postgres' as const;

  constructor(private readonly client: SupabaseAdminClient) {}

  /** Cheap reachability probe used by `createAppStore`. Throws if the database cannot be reached at all. */
  async ping(): Promise<void> {
    const { error } = await run(table(this.client, 'organization').select('id').limit(1));
    // A missing-table error still proves the *connection* itself works;
    // only a network/connection-level failure should trigger fallback.
    if (error && isConnectionError(error)) {
      throw new AppError({
        code: 'DATABASE_UNREACHABLE',
        messageNl: 'Kon geen verbinding maken met de database.',
        category: 'EXTERNAL_SERVICE',
        cause: error,
      });
    }
  }

  async listWatchedTrademarks(organizationId: string): Promise<readonly WatchedTrademarkRecord[]> {
    const { data, error } = await run(
      table(this.client, 'watched_trademark').select('*').eq('organization_id', organizationId),
    );
    throwOnError(error, 'watched-merken ophalen');
    return toRowArray(data).map(rowToWatchedTrademark);
  }

  async getWatchedTrademark(organizationId: string, id: string): Promise<WatchedTrademarkRecord | null> {
    const { data, error } = await table(this.client, 'watched_trademark')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();
    throwOnError(error, 'watched-merk ophalen');
    return data ? rowToWatchedTrademark(data) : null;
  }

  async createWatchedTrademark(
    organizationId: string,
    input: CreateWatchedTrademarkRecordInput,
  ): Promise<WatchedTrademarkRecord> {
    const now = new Date().toISOString();
    const row = {
      id: createId(),
      organization_id: organizationId,
      label: input.label,
      notes: input.notes ?? null,
      status: 'active' satisfies WatchedTrademarkStatus,
      registry_code: input.registryCode,
      registration_number: input.registrationNumber,
      mark_text: input.markText,
      nice_classes: input.niceClasses,
      eligibility: input.eligibility,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await table(this.client, 'watched_trademark').insert(row).select('*').single();
    throwOnError(error, 'watched-merk aanmaken');
    return rowToWatchedTrademark(data);
  }

  async updateWatchedTrademarkSettings(
    organizationId: string,
    id: string,
    patch: UpdateWatchedTrademarkSettingsInput,
  ): Promise<WatchedTrademarkRecord | null> {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.label !== undefined) update['label'] = patch.label;
    if (patch.notes !== undefined) update['notes'] = patch.notes;

    const { data, error } = await table(this.client, 'watched_trademark')
      .update(update)
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwOnError(error, 'watched-merk instellingen bijwerken');
    if (!data) return null;

    if (
      patch.minScoreThreshold !== undefined ||
      patch.classMode !== undefined ||
      patch.selectedNiceClasses !== undefined ||
      patch.watchedRegisters !== undefined
    ) {
      const settingsUpdate: Record<string, unknown> = {
        watched_trademark_id: id,
        updated_at: new Date().toISOString(),
      };
      if (patch.minScoreThreshold !== undefined) settingsUpdate['min_score_threshold'] = patch.minScoreThreshold;
      if (patch.classMode !== undefined) settingsUpdate['class_mode'] = patch.classMode;
      if (patch.selectedNiceClasses !== undefined) {
        settingsUpdate['selected_nice_classes'] = patch.selectedNiceClasses;
      }
      if (patch.watchedRegisters !== undefined) {
        settingsUpdate['watched_registers'] = patch.watchedRegisters;
      }
      try {
        await table(this.client, 'watch_settings').upsert(settingsUpdate);
      } catch {
        // Best-effort: older schemas may lack watched_registers / class_mode.
      }
    }

    return rowToWatchedTrademark(data);
  }

  async setWatchedTrademarkStatus(
    organizationId: string,
    id: string,
    status: WatchedTrademarkStatus,
  ): Promise<WatchedTrademarkRecord | null> {
    const { data, error } = await table(this.client, 'watched_trademark')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwOnError(error, 'status van watched-merk bijwerken');
    return data ? rowToWatchedTrademark(data) : null;
  }

  async listMatches(
    organizationId: string,
    filter: ListMatchesFilter = {},
  ): Promise<readonly TrademarkMatchRecord[]> {
    let query = table(this.client, 'trademark_match')
      .select('*')
      .eq('organization_id', organizationId)
      .order('total_score', { ascending: false });
    if (filter.status) query = query.eq('status', filter.status);

    const { data, error } = await run(query);
    throwOnError(error, 'matches ophalen');
    return toRowArray(data).map(rowToMatch);
  }

  async getMatch(organizationId: string, id: string): Promise<TrademarkMatchRecord | null> {
    const { data, error } = await table(this.client, 'trademark_match')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();
    throwOnError(error, 'match ophalen');
    return data ? rowToMatch(data) : null;
  }

  async updateMatchStatus(
    organizationId: string,
    id: string,
    status: DomainMatchStatus,
    reviewedBy: string,
  ): Promise<TrademarkMatchRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await table(this.client, 'trademark_match')
      .update({ status, reviewed_by: reviewedBy, reviewed_at: now, updated_at: now })
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwOnError(error, 'matchstatus bijwerken');
    return data ? rowToMatch(data) : null;
  }

  async addMatchNote(organizationId: string, id: string, note: string): Promise<MatchNoteRecord | null> {
    const existing = await this.getMatch(organizationId, id);
    if (!existing) return null;

    const noteRecord: MatchNoteRecord = { id: createId(), matchId: id, note, createdAt: new Date().toISOString() };
    const { error } = await run(
      table(this.client, 'trademark_match')
        .update({ notes: [...existing.notes, noteRecord], updated_at: noteRecord.createdAt })
        .eq('organization_id', organizationId)
        .eq('id', id),
    );
    throwOnError(error, 'notitie toevoegen aan match');
    return noteRecord;
  }

  async requestAdvisorReview(organizationId: string, id: string): Promise<TrademarkMatchRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await table(this.client, 'trademark_match')
      .update({ advisor_requested_at: now, updated_at: now })
      .eq('organization_id', organizationId)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwOnError(error, 'adviesaanvraag registreren');
    return data ? rowToMatch(data) : null;
  }

  async listRegisterSources(): Promise<readonly RegisterSourceStatusRecord[]> {
    return [];
  }

  async listNotifications(organizationId: string): Promise<readonly NotificationRecord[]> {
    const { data, error } = await run(
      table(this.client, 'notification')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false }),
    );
    throwOnError(error, 'notificaties ophalen');
    return toRowArray(data).map(rowToNotification);
  }

  async getOrganizationSettings(organizationId: string): Promise<OrganizationSettingsRecord> {
    const { data, error } = await table(this.client, 'organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();
    throwOnError(error, 'organisatie-instellingen ophalen');
    if (data) return rowToSettings(data);

    const now = new Date().toISOString();
    const defaults = {
      organization_id: organizationId,
      locale: 'nl-NL',
      timezone: 'Europe/Amsterdam',
      notification_email: 'onbekend@voorbeeld.nl',
      digest_frequency: 'DAILY',
      updated_at: now,
    };
    const { data: inserted, error: insertError } = await table(this.client, 'organization_settings')
      .upsert(defaults)
      .select('*')
      .single();
    throwOnError(insertError, 'organisatie-instellingen initialiseren');
    return rowToSettings(inserted);
  }

  async updateOrganizationSettings(
    organizationId: string,
    patch: UpdateOrganizationSettingsInput,
  ): Promise<OrganizationSettingsRecord> {
    await this.getOrganizationSettings(organizationId);
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.locale !== undefined) update['locale'] = patch.locale;
    if (patch.timezone !== undefined) update['timezone'] = patch.timezone;
    if (patch.notificationEmail !== undefined) update['notification_email'] = patch.notificationEmail;
    if (patch.digestFrequency !== undefined) update['digest_frequency'] = patch.digestFrequency;

    const { data, error } = await table(this.client, 'organization_settings')
      .update(update)
      .eq('organization_id', organizationId)
      .select('*')
      .single();
    throwOnError(error, 'organisatie-instellingen bijwerken');
    return rowToSettings(data);
  }
}

function throwOnError(error: { message: string } | null, actionNl: string): void {
  if (error) {
    throw new AppError({
      code: 'DATABASE_ERROR',
      messageNl: `Databasefout bij ${actionNl}.`,
      category: 'EXTERNAL_SERVICE',
      cause: error,
    });
  }
}

function isConnectionError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('econnrefused') ||
    message.includes('network') ||
    message.includes('timeout')
  );
}

function rowToWatchedTrademark(row: Record<string, unknown>): WatchedTrademarkRecord {
  const niceClasses = (row['nice_classes'] as number[]) ?? [];
  return {
    id: String(row['id']),
    organizationId: String(row['organization_id']),
    label: String(row['label']),
    notes: (row['notes'] as string | null) ?? null,
    status: row['status'] as WatchedTrademarkRecord['status'],
    registryCode: String(row['registry_code']),
    registrationNumber: String(row['registration_number']),
    markText: String(row['mark_text']),
    niceClasses,
    eligibility: row['eligibility'] as WatchedTrademarkRecord['eligibility'],
    watchSettings: {
      minScoreThreshold: Number(row['min_score_threshold'] ?? 25),
      classMode: (row['class_mode'] as 'eigen' | 'custom' | 'all') ?? 'eigen',
      selectedNiceClasses: (row['selected_nice_classes'] as number[]) ?? niceClasses,
      watchedRegisters: (row['watched_registers'] as string[]) ?? [String(row['registry_code'])],
    },
    createdAt: String(row['created_at']),
    updatedAt: String(row['updated_at']),
  };
}

function rowToMatch(row: Record<string, unknown>): TrademarkMatchRecord {
  return {
    id: String(row['id']),
    organizationId: String(row['organization_id']),
    watchedTrademarkId: String(row['watched_trademark_id']),
    watchedTrademarkLabel: String(row['watched_trademark_label']),
    candidate: row['candidate'] as TrademarkMatchRecord['candidate'],
    status: row['status'] as DomainMatchStatus,
    scores: row['scores'] as TrademarkMatchRecord['scores'],
    totalScore: Number(row['total_score']),
    weightProfileId: String(row['weight_profile_id']),
    reviewedBy: (row['reviewed_by'] as string | null) ?? null,
    reviewedAt: (row['reviewed_at'] as string | null) ?? null,
    advisorRequestedAt: (row['advisor_requested_at'] as string | null) ?? null,
    notes: (row['notes'] as MatchNoteRecord[]) ?? [],
    createdAt: String(row['created_at']),
    updatedAt: String(row['updated_at']),
  };
}

function rowToNotification(row: Record<string, unknown>): NotificationRecord {
  return {
    id: String(row['id']),
    organizationId: String(row['organization_id']),
    payload: row['payload'] as NotificationRecord['payload'],
    channel: String(row['channel']),
    sentAt: (row['sent_at'] as string | null) ?? null,
    createdAt: String(row['created_at']),
  };
}

function rowToSettings(row: Record<string, unknown>): OrganizationSettingsRecord {
  return {
    organizationId: String(row['organization_id']),
    locale: String(row['locale']),
    timezone: String(row['timezone']),
    notificationEmail: String(row['notification_email']),
    digestFrequency: row['digest_frequency'] as OrganizationSettingsRecord['digestFrequency'],
    updatedAt: String(row['updated_at']),
  };
}
