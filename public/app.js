const appState = {
  role: "model_owner",
  bootstrap: null,
  selectedJobId: null
};

const els = {
  currentUserPill: document.getElementById("current-user-pill"),
  modelName: document.getElementById("model-name"),
  pageTitle: document.getElementById("page-title"),
  modelDescription: document.getElementById("model-description"),
  projectName: document.getElementById("project-name"),
  modelRegion: document.getElementById("model-region"),
  modelOwner: document.getElementById("model-owner"),
  modelStatus: document.getElementById("model-status"),
  approvalStatus: document.getElementById("approval-status"),
  jobCount: document.getElementById("job-count"),
  queueCount: document.getElementById("queue-count"),
  queueList: document.getElementById("queue-list"),
  jobsTable: document.getElementById("jobs-table"),
  jobTitle: document.getElementById("job-title"),
  workflowBadge: document.getElementById("workflow-badge"),
  driftBadge: document.getElementById("drift-badge"),
  jobSummary: document.getElementById("job-summary"),
  metricsTable: document.getElementById("metrics-table"),
  featuresTable: document.getElementById("features-table"),
  actionBanner: document.getElementById("action-banner"),
  auditTimeline: document.getElementById("audit-timeline"),
  decisionForm: document.getElementById("decision-form"),
  decisionSelect: document.getElementById("decision-select"),
  justificationInput: document.getElementById("justification-input"),
  decisionHint: document.getElementById("decision-hint")
};

document.querySelectorAll(".role-button").forEach((button) => {
  button.addEventListener("click", async () => {
    document.querySelectorAll(".role-button").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    appState.role = button.dataset.role;
    await loadBootstrap();
  });
});

els.decisionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!appState.selectedJobId) return;

  const currentJob = await fetchJson(`/api/jobs/${appState.selectedJobId}`);
  const endpoint =
    currentJob.workflowState === "pending_owner_review" && appState.role === "model_owner"
      ? `/api/jobs/${appState.selectedJobId}/owner-review`
      : currentJob.workflowState === "pending_approver_review" && appState.role === "model_approver"
        ? `/api/jobs/${appState.selectedJobId}/approver-review`
        : null;

  if (!endpoint) {
    els.decisionHint.textContent = "The current role cannot act on this job in its present state.";
    return;
  }

  try {
    await fetchJson(endpoint, {
      method: "POST",
      body: JSON.stringify({
        decision: els.decisionSelect.value,
        justificationText: els.justificationInput.value
      })
    });
    els.justificationInput.value = "";
    els.decisionHint.textContent = "Review submitted.";
    await loadBootstrap();
    await selectJob(appState.selectedJobId);
  } catch (error) {
    els.decisionHint.textContent = error.message;
  }
});

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-user-role": appState.role,
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || "Request failed.");
  }
  return payload;
}

async function loadBootstrap() {
  appState.bootstrap = await fetchJson("/api/bootstrap");
  renderShell();
  renderQueue();
  renderJobsTable();

  const fallbackJobId =
    appState.selectedJobId ||
    appState.bootstrap.pendingQueue[0]?.jobId ||
    appState.bootstrap.jobs[0]?.jobId;

  if (fallbackJobId) {
    await selectJob(fallbackJobId);
  }
}

function renderShell() {
  const model = appState.bootstrap.models[0];
  els.currentUserPill.textContent = labelize(appState.bootstrap.currentUser.role);
  els.modelName.textContent = model.name;
  els.pageTitle.textContent = model.name;
  els.modelDescription.textContent = model.description;
  els.projectName.textContent = appState.bootstrap.projects[0].name;
  els.modelRegion.textContent = model.region;
  els.modelOwner.textContent = model.owner.name;
  els.modelStatus.textContent = model.lifecycleStatus;
  els.modelStatus.className = `badge ${statusTone(model.lifecycleStatus)}`;
  els.approvalStatus.textContent = model.managementApprovalStatus;
  els.approvalStatus.className = `badge ${statusTone(model.managementApprovalStatus)}`;
  els.jobCount.textContent = String(model.jobCount);
  els.queueCount.textContent = `${appState.bootstrap.pendingQueue.length} pending`;
}

function renderQueue() {
  if (!appState.bootstrap.pendingQueue.length) {
    els.queueList.innerHTML = `<div class="queue-item"><strong>No pending reviews</strong><span class="small">All flagged jobs have been processed.</span></div>`;
    return;
  }

  els.queueList.innerHTML = appState.bootstrap.pendingQueue
    .map(
      (job) => `
        <button class="queue-item" data-job-id="${job.jobId}">
          <strong>Run ${job.jobRunNumber}</strong>
          <div class="small">${labelize(job.workflowState)} • ${job.driftSeverity}</div>
        </button>
      `
    )
    .join("");

  els.queueList.querySelectorAll("[data-job-id]").forEach((button) => {
    button.addEventListener("click", () => selectJob(button.dataset.jobId));
  });
}

function renderJobsTable() {
  els.jobsTable.innerHTML = appState.bootstrap.jobs
    .map(
      (job) => `
        <button class="job-row ${job.jobId === appState.selectedJobId ? "selected" : ""}" data-job-id="${job.jobId}">
          <div>
            <strong>Run ${job.jobRunNumber}</strong>
            <div class="small">${formatDate(job.submittedAt)}</div>
          </div>
          <div><span class="badge ${statusTone(job.workflowState)}">${labelize(job.workflowState)}</span></div>
          <div><span class="badge ${statusTone(job.driftSeverity)}">${job.driftSeverity}</span></div>
          <div class="mono">${job.driftDetected ? "Drift" : "Stable"}</div>
        </button>
      `
    )
    .join("");

  els.jobsTable.querySelectorAll("[data-job-id]").forEach((button) => {
    button.addEventListener("click", () => selectJob(button.dataset.jobId));
  });
}

async function selectJob(jobId) {
  appState.selectedJobId = jobId;
  renderJobsTable();
  const [job, audit] = await Promise.all([
    fetchJson(`/api/jobs/${jobId}`),
    fetchJson(`/api/jobs/${jobId}/audit-events`)
  ]);
  renderJob(job, audit);
}

function renderJob(job, audit) {
  els.jobTitle.textContent = `Run ${job.jobRunNumber} Dashboard`;
  els.workflowBadge.textContent = labelize(job.workflowState);
  els.workflowBadge.className = `badge ${statusTone(job.workflowState)}`;
  els.driftBadge.textContent = job.driftSeverity;
  els.driftBadge.className = `badge ${statusTone(job.driftSeverity)}`;

  els.jobSummary.innerHTML = [
    summaryCard("Dataset", job.trainingDatasetReference),
    summaryCard("Window", `${job.trainingWindowStart} to ${job.trainingWindowEnd}`),
    summaryCard("Submitted", formatDate(job.submittedAt)),
    summaryCard("Baseline", job.baselineReferenceVersion || "pending"),
    summaryCard("Drifted Metrics", String(job.driftSummary?.driftedMetricCount ?? 0)),
    summaryCard("Drifted Features", String((job.driftSummary?.driftedFeatureMeanCount ?? 0) + (job.driftSummary?.driftedFeatureMissingCount ?? 0)))
  ].join("");

  const actionableByOwner = appState.role === "model_owner" && job.workflowState === "pending_owner_review";
  const actionableByApprover = appState.role === "model_approver" && job.workflowState === "pending_approver_review";
  const lowSample = job.driftSummary?.lowSampleSize;

  els.actionBanner.className = `action-banner ${job.driftDetected ? "warning" : "success"}`;
  els.actionBanner.innerHTML = job.driftDetected
    ? `<strong>Manual review required.</strong> ${
        actionableByOwner
          ? "Owner justification is required before final approver review."
          : actionableByApprover
            ? "Approver final consent is required to release this job."
            : "This job is waiting on another role."
      }${lowSample ? " Baseline confidence is reduced because fewer than six approved jobs were available." : ""}`
    : "<strong>Auto-approved.</strong> No metric or feature exceeded the 6 sigma threshold.";

  els.metricsTable.innerHTML = Object.entries(job.metricDrift)
    .map(([metric, detail]) => {
      const width = Number.isFinite(detail.sigmaDistance) ? Math.min(detail.sigmaDistance * 10, 100) : 100;
      return `
        <div class="metric-row ${detail.isDrifted ? "drifted" : ""}">
          <div><strong>${metric}</strong><div class="small">${detail.reason}</div></div>
          <div class="mono">${formatDecimal(detail.value)}</div>
          <div class="mono">${formatDecimal(detail.baselineMean)}</div>
          <div class="mono">${formatDecimal(detail.sigmaDistance)}</div>
          <div class="progress-shell"><div class="progress-bar" style="width:${width}%"></div></div>
        </div>
      `;
    })
    .join("");

  const maxShap = Math.max(...job.featureDrift.map((item) => item.shapImportance), 0.0001);
  els.featuresTable.innerHTML = job.featureDrift
    .map((item) => {
      const shapWidth = (item.shapImportance / maxShap) * 100;
      const drifted = item.mean.isDrifted || item.missing.isDrifted;
      return `
        <div class="feature-row ${drifted ? "drifted" : ""}">
          <div>
            <strong>${item.featureName}</strong>
            <div class="small">${drifted ? "Drift highlighted" : "Within threshold"}</div>
          </div>
          <div>
            <div class="progress-shell"><div class="progress-bar" style="width:${shapWidth}%"></div></div>
            <div class="small mono">${formatDecimal(item.shapImportance)}</div>
          </div>
          <div class="mono">${formatDecimal(item.meanValue)}</div>
          <div class="mono">${formatDecimal(item.mean.sigmaDistance)}</div>
          <div class="mono">${formatDecimal(item.missing.sigmaDistance)}</div>
        </div>
      `;
    })
    .join("");

  renderDecisionConsole(job);
  renderTimeline(audit, job.approvals);
}

function renderDecisionConsole(job) {
  const ownerStep = job.workflowState === "pending_owner_review";
  const approverStep = job.workflowState === "pending_approver_review";
  const canAct = (ownerStep && appState.role === "model_owner") || (approverStep && appState.role === "model_approver");

  els.decisionSelect.disabled = !canAct;
  els.justificationInput.disabled = !canAct;
  els.decisionForm.querySelector("button").disabled = !canAct;
  els.decisionHint.textContent = canAct
    ? ownerStep
      ? "Owner review is active. Approval requires a justification."
      : "Approver review is active. Final decision will close the workflow."
    : "Switch role or choose a pending job to submit a review.";
}

function renderTimeline(audit, approvals) {
  const approvalByStage = Object.fromEntries(approvals.map((item) => [item.stage, item]));
  const chain = [
    timelineBlock("System Evaluation", audit[0] ? labelize(audit[0].eventType) : "Completed", null),
    timelineBlock(
      "Model Owner Review",
      approvalByStage.owner_review ? `${labelize(approvalByStage.owner_review.decision)} by ${labelize(approvalByStage.owner_review.actorRole)}` : "Pending",
      approvalByStage.owner_review?.justificationText
    ),
    timelineBlock(
      "Model Approver Final Review",
      approvalByStage.approver_review ? `${labelize(approvalByStage.approver_review.decision)} by ${labelize(approvalByStage.approver_review.actorRole)}` : "Pending",
      approvalByStage.approver_review?.justificationText
    )
  ];

  const forensic = audit
    .map(
      (event) => `
        <div class="timeline-item">
          <strong>${labelize(event.eventType)}</strong>
          <div class="small">${event.actor.name} • ${labelize(event.actor.role)} • ${formatDate(event.occurredAt)}</div>
          ${event.metadata?.justificationText ? `<p>${event.metadata.justificationText}</p>` : ""}
        </div>
      `
    )
    .join("");

  els.auditTimeline.innerHTML = `${chain.join("")}${forensic}`;
}

function timelineBlock(title, status, text) {
  return `
    <div class="timeline-item">
      <strong>${title}</strong>
      <div class="small">${status}</div>
      ${text ? `<p>${text}</p>` : ""}
    </div>
  `;
}

function summaryCard(label, value) {
  return `<div class="summary-card"><span class="meta-label">${label}</span><strong>${value}</strong></div>`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-SG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDecimal(value) {
  if (value === null || value === undefined) return "n/a";
  if (value === Infinity) return "inf";
  return Number(value).toFixed(3);
}

function labelize(value) {
  return String(value).replace(/_/g, " ");
}

function statusTone(value) {
  if (["approved_auto", "approved_final", "verified", "active", "none"].includes(value)) return "success";
  if (["pending_owner_review", "pending_approver_review", "high", "medium", "warning"].includes(value)) return "warning";
  if (["critical", "rejected", "danger"].includes(value)) return "danger";
  return "info";
}

loadBootstrap().catch((error) => {
  els.actionBanner.textContent = error.message;
});
