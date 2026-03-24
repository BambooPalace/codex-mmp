# Model Management Platform Technical Design

## 1. Purpose and Scope
This document translates the current MMP specification into an implementation-ready blueprint. It assumes the product scope defined in [README.md](/Users/claire_gong/ocbc/codex/mmp/README.md) and focuses on:

- scalable system architecture
- domain and persistence model
- approval and drift state behavior
- frontend-backend service contracts
- premium, dark-first enterprise UI/UX system

No implementation code is included.

## 2. Product Goals
MMP is a governed platform for ML model registration, training-job review, and auditability. The primary operating goals are:

- enforce model governance and management approval prerequisites
- surface performance and feature drift clearly and quickly
- automate low-risk approvals and route anomalous jobs into a four-eyes review
- provide a durable audit trail across users, roles, evidence, and approval decisions
- support data-dense workflows without sacrificing readability

## 3. Architectural Style
Recommended architecture: `Layered Hexagonal Architecture` with strong domain boundaries.

Why this fits:

- governance rules are domain-heavy and should not be coupled to transport or UI concerns
- drift evaluation and approval workflow are policy-driven and need testable, isolated services
- auditability benefits from explicit domain events and append-only history
- the platform can begin as a modular monolith and evolve into services without changing the core domain contracts

## 4. High-Level System Architecture

### 4.1 Logical Modules
1. `MMP Web App`
   - React-based SPA for admin, model owner, and approver workflows
   - data grids, dashboards, forms, evidence viewers, audit trail

2. `Application API`
   - authenticated REST or BFF-style API
   - orchestrates use cases, validation, authorization, and DTO mapping

3. `Domain Core`
   - Projects, Models, Jobs, Approvals, Drift Evaluation, Audit policies
   - workflow engine for state transitions

4. `Analytics / Evaluation Services`
   - computes drift baselines from approved jobs
   - scores sigma deviations and anomaly flags
   - prepares dashboard aggregates

5. `Persistence Layer`
   - relational database for transactional entities
   - object storage for uploaded management approvals and supporting evidence
   - append-only audit/event store table for traceability

6. `Identity / Access Integration`
   - SSO/OIDC or enterprise identity provider
   - role resolution and authorization claims

### 4.2 Deployment Recommendation
Start as a modular monolith:

- one frontend application
- one backend service
- one relational database
- one object storage bucket/container

This keeps delivery fast while preserving clean boundaries. Extract services later only if job volume, analytics throughput, or organization boundaries justify it.

### 4.3 Hexagonal View
- `Inbound adapters`: HTTP controllers, auth middleware, scheduled jobs, admin console actions
- `Application layer`: use cases such as `CreateProject`, `RegisterModel`, `SubmitJobMetrics`, `EvaluateDrift`, `ApproveJob`, `RejectJob`
- `Domain layer`: aggregates, value objects, policies, state machine, domain events
- `Outbound ports`: repositories, object storage, notification service, identity provider, metrics engine
- `Outbound adapters`: SQL repositories, blob storage adapter, event publisher, email/notification integration

## 5. Suggested Technology Direction
The existing repo does not prescribe implementation frameworks beyond a UI-first platform requirement. For delivery speed and maintainability, the practical stack is:

- Frontend: React + TypeScript
- State/query layer: TanStack Query plus server-driven filtering/sorting
- Data visualization: ECharts or Plotly for dense analytical views
- Design system: custom token layer over a headless component foundation
- Backend: TypeScript/NestJS or Java/Spring Boot
- Database: PostgreSQL
- File storage: S3-compatible object storage
- Auth: OIDC/SSO with RBAC claims

These are recommendations, not current repository facts.

## 6. Domain Model

### 6.1 Core Aggregates

#### Project
Represents a business domain or parent grouping.

Key fields:

- `project_id`
- `project_code`
- `name`
- `description`
- `status` (`active`, `inactive`, `archived`)
- `created_by`
- `created_at`
- `updated_at`

Rules:

- only Admin can create and configure projects
- a project can contain many models

#### Model
Represents a deployable business model instance under a project.

Key fields:

- `model_id`
- `project_id`
- `model_code`
- `name`
- `region`
- `business_function`
- `description`
- `owner_user_id`
- `lifecycle_status` (`draft`, `pending_activation`, `active`, `inactive`, `retired`)
- `management_approval_required` (boolean, default true)
- `management_approval_status` (`missing`, `uploaded`, `verified`, `rejected`)
- `management_approval_document_id`
- `created_at`
- `updated_at`

Rules:

- a model cannot move to `active` without verified management approval evidence
- a model has many jobs
- a model’s approved jobs form the baseline pool for drift logic

#### Job
Represents one model training iteration and its governance outcome.

Key fields:

- `job_id`
- `model_id`
- `job_run_number`
- `training_dataset_reference`
- `training_window_start`
- `training_window_end`
- `submitted_by`
- `submitted_at`
- `workflow_state`
- `evaluation_state`
- `baseline_reference_version`
- `auto_approved` (boolean)
- `final_decision_at`
- `final_decision_by`

Performance metrics:

- `f1_score`
- `accuracy`
- `auc_roc`
- `precision`
- `recall`

Aggregated drift outcomes:

- `drift_detected` (boolean)
- `drift_severity` (`none`, `low`, `medium`, `high`, `critical`)
- `drift_summary_json`

Rules:

- each job belongs to one model
- each job stores the metrics submitted at training time
- each job gets evaluated against the latest 6 approved jobs for that same model

#### JobFeatureStatistic
Stores per-feature technical metrics for a single job.

Key fields:

- `job_feature_stat_id`
- `job_id`
- `feature_name`
- `feature_order`
- `mean_value`
- `missing_pct`
- `shap_importance`
- `is_drifted_mean`
- `is_drifted_missing`
- `mean_sigma_distance`
- `missing_sigma_distance`

Rules:

- features are rendered sorted by `shap_importance` descending by default
- drift flags are computed, not manually entered

#### ApprovalDecision
Captures each review decision in the workflow.

Key fields:

- `approval_decision_id`
- `job_id`
- `stage` (`owner_review`, `approver_review`)
- `actor_user_id`
- `actor_role`
- `decision` (`approved`, `rejected`)
- `justification_text`
- `created_at`

Rules:

- `owner_review` justification is mandatory when drift exists
- approver decision is mandatory for all drifted jobs to reach final approval
- if any stage rejects, the job becomes rejected

#### AuditEvent
Immutable trace of important actions.

Key fields:

- `audit_event_id`
- `entity_type`
- `entity_id`
- `event_type`
- `actor_user_id`
- `actor_role`
- `occurred_at`
- `before_json`
- `after_json`
- `metadata_json`

Typical events:

- project created
- model registered
- management approval uploaded
- management approval verified
- job submitted
- drift evaluated
- auto-approved
- owner approved with justification
- approver approved
- rejected

#### Document
Metadata for evidence files.

Key fields:

- `document_id`
- `entity_type`
- `entity_id`
- `document_category` (`management_approval`, `supporting_evidence`)
- `file_name`
- `mime_type`
- `storage_key`
- `uploaded_by`
- `uploaded_at`
- `virus_scan_status`

## 7. Data Relationships
- one `Project` to many `Model`
- one `Model` to many `Job`
- one `Job` to many `JobFeatureStatistic`
- one `Job` to many `ApprovalDecision`
- one `Model` to zero or one active `management_approval` document reference
- any core entity to many `AuditEvent`

## 8. Drift Logic Design

### 8.1 Baseline Definition
For a new job, compute baselines from the latest 6 approved jobs of the same model.

Baseline sets:

- performance metrics: F1, Accuracy, AUC_ROC, Precision, Recall
- feature mean values
- feature missing percentages

If fewer than 6 approved jobs exist:

- system still computes against available approved jobs
- dashboard labels baseline confidence as `low sample size`
- governance policy may optionally disable auto-approval until a minimum sample threshold is reached

### 8.2 Calculation
For each monitored metric:

- `baseline_mean = mean(values from latest 6 approved jobs)`
- `baseline_std_dev = stddev(values from latest 6 approved jobs)`
- `sigma_distance = abs(current_value - baseline_mean) / baseline_std_dev`

Alert condition:

- drift is highlighted when `current_value` deviates by more than `6 sigma`
- equivalent rule: `sigma_distance > 6`

### 8.3 Zero-Variance Handling
If `baseline_std_dev = 0`:

- if current value equals baseline mean, mark `no drift`
- if current value differs from baseline mean, mark as `critical drift_zero_variance`

This avoids division-by-zero ambiguity and reflects the fact that any deviation from a perfectly stable baseline is suspicious.

### 8.4 Drift Outcomes
The evaluator outputs:

- metric-level status per performance metric
- feature-level status for mean and missing percentage
- sigma distance values for every monitored measure
- overall `drift_detected` boolean
- overall `drift_severity`
- human-readable summary for the review UI

### 8.5 Severity Model
Recommended severity tiers:

- `none`: no anomalies
- `low`: one or two moderate outliers below governance threshold
- `medium`: multiple concerning deviations but no hard breach
- `high`: at least one major outlier approaching threshold
- `critical`: any `> 6 sigma` breach or zero-variance deviation

Only `critical` needs to hard-trigger manual review under the current spec. The lower tiers are useful for future UX and analytics.

## 9. Approval Workflow State Machine

### 9.1 Canonical States
- `draft`
- `submitted`
- `evaluating`
- `approved_auto`
- `pending_owner_review`
- `pending_approver_review`
- `approved_final`
- `rejected`
- `cancelled`

### 9.2 Transition Rules

1. `draft -> submitted`
   - triggered when Model Owner submits a completed job payload

2. `submitted -> evaluating`
   - triggered by evaluation service

3. `evaluating -> approved_auto`
   - condition: no drift detected
   - system records automatic approval event

4. `evaluating -> pending_owner_review`
   - condition: drift detected

5. `pending_owner_review -> pending_approver_review`
   - condition: Model Owner approves and provides mandatory justification

6. `pending_owner_review -> rejected`
   - condition: Model Owner rejects

7. `pending_approver_review -> approved_final`
   - condition: Model Approver approves

8. `pending_approver_review -> rejected`
   - condition: Model Approver rejects

9. `draft|submitted -> cancelled`
   - optional administrative cancellation path

### 9.3 State Machine Notes
- `approved_auto` and `approved_final` are both considered governance-approved and eligible for future baseline calculations
- `rejected` jobs never contribute to drift baseline
- owner self-approval is local only; it is not the final state for drifted jobs
- the approver must be a different authorized role than the model owner in the final review stage

### 9.4 Workflow Diagram
```text
draft
  -> submitted
  -> evaluating
     -> approved_auto                if no drift
     -> pending_owner_review         if drift detected
        -> rejected                  if owner rejects
        -> pending_approver_review   if owner approves with justification
           -> rejected               if approver rejects
           -> approved_final         if approver approves
```

## 10. Service Layer and API Contract
The API should expose task-oriented resources rather than thin table CRUD. This keeps the frontend aligned to governance actions instead of persistence internals.

### 10.1 Authentication and Authorization
- SSO/OIDC bearer token
- backend resolves role claims: `admin`, `model_owner`, `model_approver`
- every mutating endpoint writes audit events

### 10.2 Core API Areas

#### Projects
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{projectId}`
- `PATCH /api/projects/{projectId}`

Response shape:

```json
{
  "projectId": "prj_123",
  "projectCode": "NAME_SCREENING",
  "name": "Name Screening",
  "description": "Regional screening models",
  "status": "active",
  "modelCount": 12,
  "createdAt": "2026-03-24T09:00:00Z"
}
```

#### Models
- `GET /api/projects/{projectId}/models`
- `POST /api/projects/{projectId}/models`
- `GET /api/models/{modelId}`
- `PATCH /api/models/{modelId}`
- `POST /api/models/{modelId}/management-approval-documents`
- `POST /api/models/{modelId}/activate`

Model detail response should include:

- parent project summary
- owner
- management approval status
- latest job summary
- approval document metadata

#### Jobs
- `GET /api/models/{modelId}/jobs`
- `POST /api/models/{modelId}/jobs`
- `GET /api/jobs/{jobId}`
- `POST /api/jobs/{jobId}/evaluate`

Job submission payload:

```json
{
  "trainingDatasetReference": "s3://bucket/model_a/run_42.parquet",
  "trainingWindowStart": "2026-02-01",
  "trainingWindowEnd": "2026-02-29",
  "metrics": {
    "f1Score": 0.94,
    "accuracy": 0.96,
    "aucRoc": 0.98,
    "precision": 0.91,
    "recall": 0.95
  },
  "features": [
    {
      "featureName": "customer_age",
      "meanValue": 34.2,
      "missingPct": 0.012,
      "shapImportance": 0.184
    }
  ]
}
```

Job detail response:

```json
{
  "jobId": "job_456",
  "modelId": "mdl_123",
  "workflowState": "pending_owner_review",
  "evaluationState": "completed",
  "autoApproved": false,
  "driftDetected": true,
  "driftSeverity": "critical",
  "baselineReferenceVersion": "baseline_2026_03_24_001",
  "metrics": {
    "f1Score": {
      "value": 0.91,
      "baselineMean": 0.96,
      "baselineStdDev": 0.004,
      "sigmaDistance": 12.5,
      "isDrifted": true
    }
  },
  "featureSummary": {
    "totalFeatures": 48,
    "driftedMeanCount": 3,
    "driftedMissingCount": 2
  }
}
```

#### Approvals
- `POST /api/jobs/{jobId}/owner-review`
- `POST /api/jobs/{jobId}/approver-review`

Owner review request:

```json
{
  "decision": "approved",
  "justificationText": "Population shift due to new onboarding channel launched in MY on 2026-02-15."
}
```

Approver review request:

```json
{
  "decision": "approved",
  "justificationText": "Optional final reviewer note"
}
```

Validation rules:

- owner `justificationText` required when job is drifted
- approver can optionally add note, but decision is mandatory
- stage endpoint rejects invalid transitions with `409 Conflict`

#### Audit Trail
- `GET /api/jobs/{jobId}/audit-events`
- `GET /api/models/{modelId}/audit-events`

Audit event response:

```json
{
  "auditEventId": "aud_789",
  "eventType": "owner_approved_with_justification",
  "actor": {
    "userId": "u_001",
    "name": "Jane Tan",
    "role": "model_owner"
  },
  "occurredAt": "2026-03-24T10:12:00Z",
  "metadata": {
    "workflowStateFrom": "pending_owner_review",
    "workflowStateTo": "pending_approver_review"
  }
}
```

### 10.3 Error Handling
Use consistent error envelopes:

```json
{
  "error": {
    "code": "INVALID_WORKFLOW_TRANSITION",
    "message": "Approver review is only allowed after owner review approval.",
    "details": {}
  }
}
```

Recommended status mapping:

- `400` validation failure
- `401` unauthenticated
- `403` unauthorized
- `404` not found
- `409` invalid workflow transition or stale version conflict
- `422` semantic business-rule violation

### 10.4 Frontend Service Requirements
The frontend needs the backend to provide:

- server-side pagination, sorting, and filtering for lists
- pre-aggregated dashboard summaries to avoid heavy client-side transforms
- sigma-distance and drift flags already computed server-side
- audit events in chronological and grouped modes
- optimistic locking version fields for approval actions
- signed URLs or protected file streams for document viewing

## 11. Non-Functional Requirements

### 11.1 Security
- RBAC enforced on every endpoint
- object storage access only through signed URLs or proxy endpoints
- document malware scanning before verification
- field-level auditability for all approval actions

### 11.2 Reliability
- append-only audit event writing inside the same transaction as workflow mutations where possible
- idempotent evaluation endpoint keyed by job version
- clear retry strategy for async notifications

### 11.3 Performance
- target sub-2 second list and dashboard loads for normal enterprise usage
- precompute or cache dashboard aggregates for heavily viewed models
- index by `model_id`, `workflow_state`, `submitted_at`, `occurred_at`

### 11.4 Observability
- structured logs with correlation ids
- metrics for job submissions, approval latency, rejection rate, drift frequency
- alerts for evaluation failures and document scanning failures

## 12. UI/UX Direction

### 12.1 Visual Language
Theme: `Modern Enterprise, Dark-First, Analytical Premium`

Design principles:

- dense information, but anchored by strong spacing rhythm
- restrained color palette with high-contrast semantic highlights
- strong hierarchy through typography and panel elevation rather than heavy borders
- red is reserved for real risk, not decorative emphasis
- every analytical surface should answer: status, change, cause, action

The experience should feel closer to a premium trading or observability console than a generic admin dashboard.

### 12.2 Layout System
- app shell with left rail navigation, top command bar, and contextual page toolbar
- 12-column desktop grid
- stacked card grid on tablet/mobile
- sticky summary bars for long analytical pages

### 12.3 Primary Screens
- Project Directory
- Model Registry
- Model Detail
- Job Detail / Training Dashboard
- Approval Workbench
- Audit Trail

## 13. Design Tokens

### 13.1 Color Tokens
```text
bg.canvas = #081018
bg.surface = #0E1722
bg.elevated = #13202E
bg.overlay = rgba(5, 10, 15, 0.82)

text.primary = #F3F7FB
text.secondary = #A9B7C6
text.muted = #7D8A98

border.subtle = rgba(190, 210, 230, 0.10)
border.strong = rgba(190, 210, 230, 0.18)

accent.primary = #5BC0EB
accent.secondary = #8EF6D1
accent.warning = #FFB84D
accent.danger = #FF5D73
accent.success = #4FD1A1
accent.info = #74A7FF

chart.blue = #5BC0EB
chart.teal = #5DE2C1
chart.gold = #F5C76A
chart.coral = #FF7A90
chart.violet = #9C8CFF
```

Usage guidance:

- use `accent.danger` only for drift breaches, rejected states, and destructive actions
- use `accent.warning` for pending review, low confidence baseline, or cautionary anomalies
- use `accent.primary` for primary actions and selected navigation

### 13.2 Typography Tokens
Recommended font direction:

- display/headings: `Sora` or `Manrope`
- UI/body/data: `IBM Plex Sans`
- tabular metrics/code-like values: `IBM Plex Mono`

Token scale:

```text
font.size.12 = 12px
font.size.14 = 14px
font.size.16 = 16px
font.size.20 = 20px
font.size.24 = 24px
font.size.32 = 32px

font.weight.regular = 400
font.weight.medium = 500
font.weight.semibold = 600
font.weight.bold = 700
```

### 13.3 Spacing Tokens
```text
space.4 = 4px
space.8 = 8px
space.12 = 12px
space.16 = 16px
space.20 = 20px
space.24 = 24px
space.32 = 32px
space.40 = 40px
```

Rules:

- dense tables use 12 to 16px internal padding
- analytical panels use 20 to 24px padding
- page gutters use 24 to 32px on desktop

### 13.4 Radius and Shadow Tokens
```text
radius.sm = 8px
radius.md = 12px
radius.lg = 16px
radius.xl = 24px

shadow.panel = 0 10px 30px rgba(0, 0, 0, 0.28)
shadow.overlay = 0 18px 48px rgba(0, 0, 0, 0.40)
shadow.focus = 0 0 0 3px rgba(91, 192, 235, 0.28)
```

## 14. Component Tree

### 14.1 App Shell
```text
AppShell
  LeftNav
    ProjectSwitcher
    NavSection
  TopBar
    Breadcrumbs
    GlobalSearch
    RoleBadge
    UserMenu
  PageContainer
```

### 14.2 Project Directory
```text
ProjectDirectoryPage
  PageHeader
  FilterToolbar
  ProjectGrid
    ProjectCard
      StatusBadge
      MetaRow
      ModelCountPill
```

### 14.3 Model Registry
```text
ModelRegistryPage
  PageHeader
  ModelFilters
  ModelTable
    ModelRow
      ManagementApprovalStatusBadge
      LatestJobStatusCell
      OwnerCell
```

### 14.4 Model Detail
```text
ModelDetailPage
  ModelHero
    StatusCluster
    ApprovalDocumentCard
    ActionsBar
  MetricsStrip
  JobsTable
  SidePanel
    ModelMetadataCard
    AuditSummaryCard
```

### 14.5 Job Detail / Training Dashboard
```text
JobDetailPage
  JobHeader
    WorkflowStateBadge
    DriftSeverityBadge
    JobMetaCluster
    ReviewActionBar
  SummaryKPIGrid
    MetricDeltaCard
  DriftOverviewPanel
    DriftDecisionBanner
    BaselineConfidencePill
    DriftCountsSummary
  PerformanceMetricsPanel
    MetricDriftTable
    SigmaDeviationSparkBars
  FeatureAnalyticsPanel
    ShapImportanceTable
    FeatureDriftHeatmap
    MissingnessTrendTable
  JustificationPanel
    OwnerNarrativeCard
    ApproverDecisionCard
  AuditRail
    TimelineEvent
```

### 14.6 Approval Workbench
```text
ApprovalWorkbenchPage
  QueueHeader
  QueueFilters
  ReviewQueueTable
  ReviewDrawer
    DriftSummary
    EvidencePanel
    DecisionForm
```

### 14.7 Audit Trail
```text
AuditTrailPage
  AuditHeader
  AuditFilters
  TimelineList
    TimelineGroup
      AuditEventCard
        ActorBadge
        StateTransitionTag
        DiffViewer
        AttachmentLink
```

## 15. Model Training Dashboard Design

### 15.1 Dashboard Objectives
The training dashboard should answer four questions within one screen:

- did this training run pass governance?
- which metrics or features drifted?
- how severe is the deviation against the approved baseline?
- what action is required from the current role?

### 15.2 Layout Strategy
Top to bottom:

1. sticky header with state, owner, run timestamp, and action controls
2. compact KPI band for core metrics and sigma deltas
3. drift summary banner with explicit breach count
4. split analytical zone:
   - left: performance metric table and deviation bars
   - right: SHAP-ranked feature table with drift markers
5. lower section for narrative review and audit

### 15.3 SHAP Visualization
Use a ranked horizontal bar table:

- feature name left-aligned
- SHAP magnitude bar centered
- mean drift indicator and missing drift indicator on the right
- rows sorted descending by SHAP importance
- allow pinning top 10, 20, or all features

Why this is better than a pure chart:

- preserves analytical density
- supports exact values and sorting
- allows risk badges inline with interpretability data

### 15.4 Feature Drift Highlighting
Recommended patterns:

- row-level soft red tint if either mean or missing drift breached threshold
- separate compact badges: `Mean Drift`, `Missing Drift`
- sigma values shown as mono text for exact review
- hover or expand row for baseline mean, std dev, and prior approved job trend

### 15.5 Performance Metrics Visualization
For each performance metric:

- current value
- baseline mean
- sigma distance
- directional delta arrow
- drift status chip

Best visual form:

- dense analytical table plus mini spark bar per metric
- use color sparingly; default neutral, only escalate to danger when threshold breached

## 16. Audit Trail UI Design

### 16.1 Interaction Model
The audit trail should be readable in both summary and forensic modes.

Summary mode:

- grouped by date and workflow stage
- emphasizes approvals, rejections, uploads, and state transitions

Forensic mode:

- full chronological timeline
- exposes actor, exact timestamp, before/after state, and attached documents

### 16.2 Justification Display
Owner and approver justifications should appear as signed narrative blocks:

- actor name and role
- timestamp
- decision chip
- free text
- linked evidence, if any

This should feel formal and durable, similar to approval sign-offs rather than chat comments.

### 16.3 Multi-Role Approval Presentation
Use a horizontal approval chain near the top of the page:

- `System Evaluation`
- `Model Owner Review`
- `Model Approver Final Review`

Each node shows:

- status
- actor
- time
- decision

Rejected nodes remain red and terminal; approved nodes remain green; pending nodes remain muted amber.

## 17. Page-by-Page UX Notes

### 17.1 Project Directory
- emphasize project purpose, number of models, and risk posture
- allow admins to scan active vs inactive projects quickly

### 17.2 Model Registry
- table-first design with rich status chips
- key visible columns: model, project, owner, management approval, latest approved job, latest drift flag

### 17.3 Model Detail
- the management approval card should be prominent because activation depends on it
- recent jobs table should support direct drill-in to drifted runs

### 17.4 Approval Workbench
- optimized for throughput
- keyboard-friendly queue navigation
- right-side review drawer prevents losing queue context

## 18. Recommended Implementation Sequence
1. establish domain schema and workflow engine
2. implement job submission plus drift evaluation service
3. implement approval endpoints and audit event persistence
4. build model registry and job dashboard UI shell
5. layer in premium data visualization and approval workbench

## 19. Key Risks and Design Decisions

### Risks
- ambiguous baseline behavior when there are fewer than 6 approved jobs
- very wide feature sets can overwhelm the dashboard without progressive disclosure
- approval latency may increase if reviewer queue management is weak
- document verification can become a governance bottleneck without clear status handling

### Decisions
- prefer modular monolith first
- keep drift evaluation server-side
- persist exact baseline snapshots used at evaluation time
- separate final approval state from owner local approval
- treat audit trail as first-class product surface, not a backend afterthought

## 20. Definition of Ready for Build Phase
Implementation can start once the team aligns on:

- exact API style: pure REST versus BFF-leaning REST
- chosen backend framework and auth integration path
- baseline policy for low sample size scenarios
- document verification operating model
- charting library and design-system foundation

With those decisions confirmed, this design is sufficient to proceed into schema design, endpoint implementation, and frontend component construction.
