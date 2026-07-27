/**
 * Hand-authored Supabase database types matching the schema introduced by
 * `supabase/migrations`. Covers every enum exactly (kept in sync with
 * `supabase/migrations/20260727120000_extensions_and_enums.sql`) and the
 * most heavily-used tables in full; every other table is still typed
 * structurally via the `Tables` index signature so callers get compile
 * errors for typos in enum values today without blocking on a full,
 * 70-table hand-written definition.
 *
 * Once the local Supabase stack has applied every migration, replace this
 * file with the real generated output for full column-level accuracy:
 *
 *   supabase gen types typescript --local > packages/database/src/types.ts
 */

export type MarkType = 'word' | 'figurative' | 'combined' | 'other';

export type WatchedTrademarkStatus = 'active' | 'paused' | 'expired' | 'archived';

export type RegisterTrademarkStatus =
  | 'pending'
  | 'registered'
  | 'opposed'
  | 'refused'
  | 'withdrawn'
  | 'expired'
  | 'unknown';

export type ProceduralStatusEnum =
  | 'filed'
  | 'published'
  | 'opposition_period'
  | 'registered'
  | 'opposed'
  | 'withdrawn'
  | 'refused'
  | 'expired';

export type MatchWorkflowStatus =
  | 'new'
  | 'under_review'
  | 'confirmed_conflict'
  | 'dismissed'
  | 'opposition_filed'
  | 'opposition_deadline_passed';

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export type JobTypeEnum =
  | 'refresh_watched_snapshot'
  | 'fetch_publications'
  | 'match_candidates'
  | 'score_matches'
  | 'calculate_opposition_deadlines'
  | 'send_notifications'
  | 'ai_enrichment';

export type ConnectorHealthStatusEnum = 'ok' | 'configuration_required' | 'degraded' | 'unavailable';

export type NotificationChannelEnum = 'email' | 'in_app';

export type NotificationTypeEnum =
  | 'new_match'
  | 'opposition_deadline_reminder'
  | 'opposition_deadline_passed'
  | 'connector_down'
  | 'ai_budget_exhausted';

export type FeatureFlagEnum =
  | 'ai_enrichment'
  | 'pdf_export'
  | 'csv_export'
  | 'email_notifications'
  | 'multi_register_watch'
  | 'platform_access'
  | 'merkrechten_chat';

export type SubscriptionPlanCode = 'basis' | 'starter' | 'plus' | 'pro' | 'enterprise' | 'agency';

export type SubscriptionStatusEnum = 'trialing' | 'active' | 'past_due' | 'canceled' | 'pending_downgrade';

export type WorkspaceRole = 'owner' | 'admin' | 'jurist' | 'member';

export type OppositionRuleKind = 'calendar_days' | 'months';

export type OppositionStartsFrom = 'publication_date' | 'filing_date';

export type DeadlineEventType =
  | 'reminder_30d'
  | 'reminder_14d'
  | 'reminder_7d'
  | 'reminder_2d'
  | 'deadline_passed';

export type ScoreComponent =
  | 'textual_similarity'
  | 'phonetic_similarity'
  | 'visual_similarity'
  | 'semantic_similarity'
  | 'nice_class_overlap'
  | 'goods_services_overlap'
  | 'geographic_overlap'
  | 'ai_plausibility_adjustment';

export type ExportTypeEnum = 'pdf' | 'csv';

export type ExportStatusEnum = 'pending' | 'processing' | 'completed' | 'failed';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatusEnum = 'open' | 'monitoring' | 'resolved';

export type ScoringExperimentStatus = 'draft' | 'running' | 'completed' | 'archived';

export type ActorType = 'user' | 'service' | 'platform_operator' | 'system';

interface GenericTable {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
}

interface OrganizationsTable {
  Row: { id: string; name: string; created_at: string; updated_at: string };
  Insert: { id?: string; name: string; created_at?: string; updated_at?: string };
  Update: { id?: string; name?: string; created_at?: string; updated_at?: string };
}

interface WorkspacesTable {
  Row: { id: string; organization_id: string; name: string; created_at: string; updated_at: string };
  Insert: {
    id?: string;
    organization_id: string;
    name: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    organization_id?: string;
    name?: string;
    created_at?: string;
    updated_at?: string;
  };
}

interface WorkspaceMembersTable {
  Row: {
    id: string;
    workspace_id: string;
    user_id: string;
    role: WorkspaceRole;
    created_at: string;
  };
  Insert: {
    id?: string;
    workspace_id: string;
    user_id: string;
    role?: WorkspaceRole;
    created_at?: string;
  };
  Update: {
    id?: string;
    workspace_id?: string;
    user_id?: string;
    role?: WorkspaceRole;
    created_at?: string;
  };
}

interface PlatformUsersTable {
  Row: {
    id: string;
    user_id: string;
    display_name: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    display_name: string;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    display_name?: string;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  };
}

interface RegisterSourcesTable {
  Row: {
    id: string;
    code: string;
    name: string;
    status: ConnectorHealthStatusEnum;
    capabilities: Record<string, unknown>;
    is_enabled: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    code: string;
    name: string;
    status?: ConnectorHealthStatusEnum;
    capabilities?: Record<string, unknown>;
    is_enabled?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    code?: string;
    name?: string;
    status?: ConnectorHealthStatusEnum;
    capabilities?: Record<string, unknown>;
    is_enabled?: boolean;
    created_at?: string;
    updated_at?: string;
  };
}

interface WatchedTrademarksTable {
  Row: {
    id: string;
    workspace_id: string;
    label: string;
    status: WatchedTrademarkStatus;
    register_source_id: string;
    registration_number: string;
    current_snapshot_id: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    workspace_id: string;
    label: string;
    status?: WatchedTrademarkStatus;
    register_source_id: string;
    registration_number: string;
    current_snapshot_id?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    workspace_id?: string;
    label?: string;
    status?: WatchedTrademarkStatus;
    register_source_id?: string;
    registration_number?: string;
    current_snapshot_id?: string | null;
    created_at?: string;
    updated_at?: string;
  };
}

interface WatchedTrademarkSnapshotsTable {
  Row: {
    id: string;
    watched_trademark_id: string;
    workspace_id: string;
    register_source_id: string;
    registration_number: string;
    mark_text: string;
    mark_type: MarkType;
    applicant_name: string | null;
    filing_date: string | null;
    registration_date: string | null;
    register_status: RegisterTrademarkStatus;
    last_checked_at: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    watched_trademark_id: string;
    workspace_id: string;
    register_source_id: string;
    registration_number: string;
    mark_text: string;
    mark_type: MarkType;
    applicant_name?: string | null;
    filing_date?: string | null;
    registration_date?: string | null;
    register_status?: RegisterTrademarkStatus;
    last_checked_at?: string;
    created_at?: string;
  };
  Update: Partial<WatchedTrademarkSnapshotsTable['Insert']>;
}

interface CandidateApplicationsTable {
  Row: {
    id: string;
    register_source_id: string;
    application_number: string;
    mark_text: string;
    mark_type: MarkType;
    applicant_name: string | null;
    filing_date: string | null;
    publication_date: string | null;
    procedural_status: ProceduralStatusEnum;
    raw_source_record_id: string | null;
    fetched_at: string;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    register_source_id: string;
    application_number: string;
    mark_text: string;
    mark_type: MarkType;
    applicant_name?: string | null;
    filing_date?: string | null;
    publication_date?: string | null;
    procedural_status?: ProceduralStatusEnum;
    raw_source_record_id?: string | null;
    fetched_at?: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<CandidateApplicationsTable['Insert']>;
}

interface TrademarkMatchesTable {
  Row: {
    id: string;
    workspace_id: string;
    watched_trademark_id: string;
    candidate_application_id: string;
    status: MatchWorkflowStatus;
    total_score: number;
    weight_profile_id: string;
    opposition_deadline_id: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    workspace_id: string;
    watched_trademark_id: string;
    candidate_application_id: string;
    status?: MatchWorkflowStatus;
    total_score?: number;
    weight_profile_id?: string;
    opposition_deadline_id?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<TrademarkMatchesTable['Insert']>;
}

interface MatchScoreComponentsTable {
  Row: {
    id: string;
    trademark_match_id: string;
    workspace_id: string;
    component: ScoreComponent;
    raw_value: number;
    weight: number;
    weighted_value: number;
    created_at: string;
  };
  Insert: {
    id?: string;
    trademark_match_id: string;
    workspace_id: string;
    component: ScoreComponent;
    raw_value: number;
    weight: number;
    weighted_value: number;
    created_at?: string;
  };
  Update: Partial<MatchScoreComponentsTable['Insert']>;
}

interface OppositionDeadlinesTable {
  Row: {
    id: string;
    candidate_application_id: string;
    opposition_rule_set_id: string;
    start_date: string;
    deadline_date: string;
    calculated_at: string;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    candidate_application_id: string;
    opposition_rule_set_id: string;
    start_date: string;
    deadline_date: string;
    calculated_at?: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<OppositionDeadlinesTable['Insert']>;
}

interface NotificationsTable {
  Row: {
    id: string;
    workspace_id: string;
    watched_trademark_id: string | null;
    trademark_match_id: string | null;
    type: NotificationTypeEnum;
    channel: NotificationChannelEnum;
    payload: Record<string, unknown>;
    sent_at: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    workspace_id: string;
    watched_trademark_id?: string | null;
    trademark_match_id?: string | null;
    type: NotificationTypeEnum;
    channel: NotificationChannelEnum;
    payload?: Record<string, unknown>;
    sent_at?: string | null;
    created_at?: string;
  };
  Update: Partial<NotificationsTable['Insert']>;
}

interface ScoringWeightProfilesTable {
  Row: {
    id: string;
    scoring_model_version_id: string | null;
    profile_id: string;
    textual_similarity: number;
    phonetic_similarity: number;
    visual_similarity: number;
    semantic_similarity: number;
    nice_class_overlap: number;
    goods_services_overlap: number;
    geographic_overlap: number;
    ai_plausibility_adjustment: number;
    is_default: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    scoring_model_version_id?: string | null;
    profile_id: string;
    textual_similarity: number;
    phonetic_similarity: number;
    visual_similarity: number;
    semantic_similarity: number;
    nice_class_overlap: number;
    goods_services_overlap: number;
    geographic_overlap: number;
    ai_plausibility_adjustment: number;
    is_default?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<ScoringWeightProfilesTable['Insert']>;
}

interface SubscriptionPlansTable {
  Row: {
    id: string;
    code: SubscriptionPlanCode;
    name: string;
    price_eur_cents: number;
    max_watched_trademarks: number | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    code: SubscriptionPlanCode;
    name: string;
    price_eur_cents?: number;
    max_watched_trademarks?: number | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<SubscriptionPlansTable['Insert']>;
}

interface WorkspaceSubscriptionsTable {
  Row: {
    id: string;
    workspace_id: string;
    subscription_plan_id: string;
    status: SubscriptionStatusEnum;
    renews_at: string | null;
    started_at: string;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    workspace_id: string;
    subscription_plan_id: string;
    status?: SubscriptionStatusEnum;
    renews_at?: string | null;
    started_at?: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<WorkspaceSubscriptionsTable['Insert']>;
}

interface FeatureEntitlementsTable {
  Row: {
    id: string;
    workspace_id: string;
    feature_flag: FeatureFlagEnum;
    enabled: boolean;
    limit_value: number | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    workspace_id: string;
    feature_flag: FeatureFlagEnum;
    enabled?: boolean;
    limit_value?: number | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<FeatureEntitlementsTable['Insert']>;
}

interface ProcessingJobsTable {
  Row: {
    id: string;
    scan_run_step_id: string | null;
    type: JobTypeEnum;
    status: JobStatus;
    register_source_id: string | null;
    attempt: number;
    started_at: string | null;
    finished_at: string | null;
    error: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    scan_run_step_id?: string | null;
    type: JobTypeEnum;
    status?: JobStatus;
    register_source_id?: string | null;
    attempt?: number;
    started_at?: string | null;
    finished_at?: string | null;
    error?: string | null;
    metadata?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<ProcessingJobsTable['Insert']>;
}

/**
 * Explicitly-typed tables cover the core domain model end-to-end; every
 * other table from `supabase/migrations` (there are 70 in total - see
 * `docs/database/schema.md`) is still accessible through the `[key:
 * string]` index signature below with a permissive `Record<string,
 * unknown>` shape until replaced by real codegen output.
 */
export interface Database {
  public: {
    Tables: {
      organizations: OrganizationsTable;
      workspaces: WorkspacesTable;
      workspace_members: WorkspaceMembersTable;
      platform_users: PlatformUsersTable;
      register_sources: RegisterSourcesTable;
      watched_trademarks: WatchedTrademarksTable;
      watched_trademark_snapshots: WatchedTrademarkSnapshotsTable;
      candidate_applications: CandidateApplicationsTable;
      trademark_matches: TrademarkMatchesTable;
      match_score_components: MatchScoreComponentsTable;
      opposition_deadlines: OppositionDeadlinesTable;
      notifications: NotificationsTable;
      scoring_weight_profiles: ScoringWeightProfilesTable;
      subscription_plans: SubscriptionPlansTable;
      workspace_subscriptions: WorkspaceSubscriptionsTable;
      feature_entitlements: FeatureEntitlementsTable;
      processing_jobs: ProcessingJobsTable;
      [key: string]: GenericTable;
    };
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: {
      mark_type: MarkType;
      watched_trademark_status: WatchedTrademarkStatus;
      register_trademark_status: RegisterTrademarkStatus;
      procedural_status: ProceduralStatusEnum;
      match_workflow_status: MatchWorkflowStatus;
      job_status: JobStatus;
      job_type: JobTypeEnum;
      connector_health_status: ConnectorHealthStatusEnum;
      notification_channel: NotificationChannelEnum;
      notification_type: NotificationTypeEnum;
      workspace_role: WorkspaceRole;
      feature_flag: FeatureFlagEnum;
      subscription_plan_code: SubscriptionPlanCode;
      subscription_status: SubscriptionStatusEnum;
      opposition_rule_kind: OppositionRuleKind;
      opposition_starts_from: OppositionStartsFrom;
      deadline_event_type: DeadlineEventType;
      score_component: ScoreComponent;
      export_type: ExportTypeEnum;
      export_status: ExportStatusEnum;
      incident_severity: IncidentSeverity;
      incident_status: IncidentStatusEnum;
      scoring_experiment_status: ScoringExperimentStatus;
      actor_type: ActorType;
    };
  };
}
