const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const publicDir = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";

const users = {
  admin_1: { userId: "admin_1", name: "Alicia Wong", role: "admin" },
  owner_1: { userId: "owner_1", name: "Daryl Lim", role: "model_owner" },
  approver_1: { userId: "approver_1", name: "Priya Menon", role: "model_approver" }
};

const state = createSeedState();

function nowIso() {
  return new Date().toISOString();
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values) {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createAuditEvent({ entityType, entityId, eventType, actor, before, after, metadata = {} }) {
  return {
    auditEventId: `aud_${state.counters.audit++}`,
    entityType,
    entityId,
    eventType,
    actor: clone(actor),
    occurredAt: nowIso(),
    before: before ? clone(before) : null,
    after: after ? clone(after) : null,
    metadata: clone(metadata)
  };
}

function addAuditEvent(payload) {
  const event = createAuditEvent(payload);
  state.auditEvents.unshift(event);
  return event;
}

function createSeedState() {
  const seed = {
    counters: {
      project: 2,
      model: 2,
      job: 8,
      audit: 1,
      approval: 1
    },
    projects: [
      {
        projectId: "prj_1",
        projectCode: "NAME_SCREENING",
        name: "Name Screening",
        description: "Regional name screening models for onboarding and transaction monitoring.",
        status: "active",
        createdBy: "admin_1",
        createdAt: "2026-03-01T09:00:00.000Z",
        updatedAt: "2026-03-23T11:20:00.000Z"
      }
    ],
    models: [
      {
        modelId: "mdl_1",
        projectId: "prj_1",
        modelCode: "NAME_SCREENING_SG",
        name: "Name Screening - SG",
        region: "SG",
        businessFunction: "Sanctions Screening",
        description: "Production model for Singapore onboarding risk screening.",
        ownerUserId: "owner_1",
        lifecycleStatus: "active",
        managementApprovalRequired: true,
        managementApprovalStatus: "verified",
        managementApprovalDocument: {
          documentId: "doc_1",
          fileName: "sg-management-approval.pdf",
          mimeType: "application/pdf",
          uploadedAt: "2026-02-14T08:00:00.000Z",
          uploadedBy: "owner_1",
          status: "verified"
        },
        createdAt: "2026-02-01T08:00:00.000Z",
        updatedAt: "2026-03-23T11:10:00.000Z"
      }
    ],
    jobs: [],
    auditEvents: [],
    approvalDecisions: []
  };

  const approvedMetricRuns = [
    { f1Score: 0.953, accuracy: 0.966, aucRoc: 0.985, precision: 0.941, recall: 0.958, ageMean: 34.1, ageMissing: 0.010, riskMean: 0.423, riskMissing: 0.017, channelMean: 2.60, channelMissing: 0.000 },
    { f1Score: 0.951, accuracy: 0.965, aucRoc: 0.986, precision: 0.939, recall: 0.957, ageMean: 34.0, ageMissing: 0.011, riskMean: 0.425, riskMissing: 0.018, channelMean: 2.59, channelMissing: 0.000 },
    { f1Score: 0.954, accuracy: 0.967, aucRoc: 0.984, precision: 0.943, recall: 0.960, ageMean: 34.2, ageMissing: 0.012, riskMean: 0.424, riskMissing: 0.018, channelMean: 2.61, channelMissing: 0.000 },
    { f1Score: 0.952, accuracy: 0.966, aucRoc: 0.985, precision: 0.940, recall: 0.959, ageMean: 34.1, ageMissing: 0.011, riskMean: 0.426, riskMissing: 0.017, channelMean: 2.60, channelMissing: 0.000 },
    { f1Score: 0.953, accuracy: 0.965, aucRoc: 0.986, precision: 0.942, recall: 0.958, ageMean: 34.0, ageMissing: 0.010, riskMean: 0.423, riskMissing: 0.018, channelMean: 2.62, channelMissing: 0.000 },
    { f1Score: 0.952, accuracy: 0.966, aucRoc: 0.985, precision: 0.941, recall: 0.959, ageMean: 34.1, ageMissing: 0.011, riskMean: 0.425, riskMissing: 0.017, channelMean: 2.61, channelMissing: 0.000 }
  ];

  approvedMetricRuns.forEach((run, index) => {
    const job = buildJob({
      jobId: `job_${index + 1}`,
      modelId: "mdl_1",
      jobRunNumber: index + 1,
      trainingDatasetReference: `warehouse://sg/name-screening/run-${index + 1}`,
      trainingWindowStart: `2025-0${Math.max(1, index + 1)}-01`,
      trainingWindowEnd: `2025-0${Math.max(1, index + 1)}-28`,
      submittedBy: "owner_1",
      submittedAt: new Date(Date.UTC(2025, index, 28, 8, 0, 0)).toISOString(),
      workflowState: "approved_auto",
      autoApproved: true,
      finalDecisionAt: new Date(Date.UTC(2025, index, 28, 8, 5, 0)).toISOString(),
      finalDecisionBy: "system",
      metrics: {
        f1Score: run.f1Score,
        accuracy: run.accuracy,
        aucRoc: run.aucRoc,
        precision: run.precision,
        recall: run.recall
      },
      features: [
        buildFeature("customer_age", run.ageMean, run.ageMissing, 0.182),
        buildFeature("risk_score", run.riskMean, run.riskMissing, 0.167),
        buildFeature("channel_code", run.channelMean, run.channelMissing, 0.134),
        buildFeature("country_match_score", 0.781, 0.002, 0.121),
        buildFeature("name_embedding_distance", 0.164, 0.000, 0.114),
        buildFeature("pep_screen_hit_rate", 0.051, 0.004, 0.094)
      ]
    });
    job.driftDetected = false;
    job.driftSeverity = "none";
    seed.jobs.push(job);
  });

  const reviewJob = buildJob({
    jobId: "job_7",
    modelId: "mdl_1",
    jobRunNumber: 7,
    trainingDatasetReference: "warehouse://sg/name-screening/run-7",
    trainingWindowStart: "2026-02-01",
    trainingWindowEnd: "2026-02-29",
    submittedBy: "owner_1",
    submittedAt: "2026-03-23T09:18:00.000Z",
    workflowState: "submitted",
    autoApproved: false,
    finalDecisionAt: null,
    finalDecisionBy: null,
    metrics: {
      f1Score: 0.919,
      accuracy: 0.951,
      aucRoc: 0.971,
      precision: 0.903,
      recall: 0.924
    },
    features: [
      buildFeature("customer_age", 38.8, 0.057, 0.182),
      buildFeature("risk_score", 0.478, 0.046, 0.167),
      buildFeature("channel_code", 3.31, 0.003, 0.134),
      buildFeature("country_match_score", 0.761, 0.004, 0.121),
      buildFeature("name_embedding_distance", 0.172, 0.000, 0.114),
      buildFeature("pep_screen_hit_rate", 0.053, 0.006, 0.094)
    ]
  });
  seed.jobs.push(reviewJob);

  return seed;
}

function buildFeature(featureName, meanValue, missingPct, shapImportance) {
  return {
    featureName,
    meanValue,
    missingPct,
    shapImportance
  };
}

function buildJob(input) {
  return {
    jobId: input.jobId,
    modelId: input.modelId,
    jobRunNumber: input.jobRunNumber,
    trainingDatasetReference: input.trainingDatasetReference,
    trainingWindowStart: input.trainingWindowStart,
    trainingWindowEnd: input.trainingWindowEnd,
    submittedBy: input.submittedBy,
    submittedAt: input.submittedAt,
    workflowState: input.workflowState,
    evaluationState: input.workflowState === "submitted" ? "pending" : "completed",
    baselineReferenceVersion: null,
    autoApproved: input.autoApproved,
    finalDecisionAt: input.finalDecisionAt,
    finalDecisionBy: input.finalDecisionBy,
    metrics: input.metrics,
    features: input.features,
    driftDetected: false,
    driftSeverity: "none",
    driftSummary: null,
    metricDrift: {},
    featureDrift: []
  };
}

function getProject(projectId) {
  return state.projects.find((project) => project.projectId === projectId);
}

function getModel(modelId) {
  return state.models.find((model) => model.modelId === modelId);
}

function getJob(jobId) {
  return state.jobs.find((job) => job.jobId === jobId);
}

function getApprovedJobsForModel(modelId, excludeJobId) {
  return state.jobs
    .filter((job) => job.modelId === modelId && ["approved_auto", "approved_final"].includes(job.workflowState) && job.jobId !== excludeJobId)
    .sort((a, b) => new Date(b.finalDecisionAt || b.submittedAt) - new Date(a.finalDecisionAt || a.submittedAt))
    .slice(0, 6);
}

function computeDrift(job) {
  const baselineJobs = getApprovedJobsForModel(job.modelId, job.jobId);
  const baselineVersion = `baseline_${job.modelId}_${baselineJobs.map((item) => item.jobId).join("_") || "empty"}`;
  const metricNames = ["f1Score", "accuracy", "aucRoc", "precision", "recall"];
  const metricDrift = {};
  let criticalCount = 0;

  metricNames.forEach((metricName) => {
    const baselineValues = baselineJobs.map((baselineJob) => baselineJob.metrics[metricName]).filter((value) => typeof value === "number");
    metricDrift[metricName] = computeDeviation(job.metrics[metricName], baselineValues);
    if (metricDrift[metricName].isDrifted) criticalCount += 1;
  });

  const featureDrift = job.features
    .map((feature) => {
      const matchingFeatures = baselineJobs
        .map((baselineJob) => baselineJob.features.find((item) => item.featureName === feature.featureName))
        .filter(Boolean);
      const meanValues = matchingFeatures.map((item) => item.meanValue);
      const missingValues = matchingFeatures.map((item) => item.missingPct);
      const meanDrift = computeDeviation(feature.meanValue, meanValues);
      const missingDrift = computeDeviation(feature.missingPct, missingValues);

      if (meanDrift.isDrifted) criticalCount += 1;
      if (missingDrift.isDrifted) criticalCount += 1;

      return {
        featureName: feature.featureName,
        shapImportance: feature.shapImportance,
        meanValue: feature.meanValue,
        missingPct: feature.missingPct,
        mean: meanDrift,
        missing: missingDrift
      };
    })
    .sort((a, b) => b.shapImportance - a.shapImportance);

  const driftDetected = criticalCount > 0;
  const driftSeverity = !driftDetected ? "none" : criticalCount >= 4 ? "critical" : criticalCount >= 2 ? "high" : "medium";
  const driftSummary = {
    driftedMetricCount: Object.values(metricDrift).filter((item) => item.isDrifted).length,
    driftedFeatureMeanCount: featureDrift.filter((item) => item.mean.isDrifted).length,
    driftedFeatureMissingCount: featureDrift.filter((item) => item.missing.isDrifted).length,
    lowSampleSize: baselineJobs.length < 6
  };

  return {
    baselineJobs,
    baselineReferenceVersion: baselineVersion,
    metricDrift,
    featureDrift,
    driftDetected,
    driftSeverity,
    driftSummary
  };
}

function computeDeviation(currentValue, baselineValues) {
  if (baselineValues.length === 0) {
    return {
      value: currentValue,
      baselineMean: null,
      baselineStdDev: null,
      sigmaDistance: null,
      isDrifted: false,
      reason: "No approved baseline jobs available"
    };
  }

  const baselineMean = mean(baselineValues);
  const baselineStdDev = stddev(baselineValues);

  if (baselineStdDev === 0) {
    const changed = currentValue !== baselineMean;
    return {
      value: currentValue,
      baselineMean,
      baselineStdDev,
      sigmaDistance: changed ? Number.POSITIVE_INFINITY : 0,
      isDrifted: changed,
      reason: changed ? "Zero variance baseline changed" : "Stable baseline"
    };
  }

  const sigmaDistance = Math.abs(currentValue - baselineMean) / baselineStdDev;
  return {
    value: currentValue,
    baselineMean,
    baselineStdDev,
    sigmaDistance,
    isDrifted: sigmaDistance > 6,
    reason: sigmaDistance > 6 ? "Exceeded 6 sigma threshold" : "Within threshold"
  };
}

function evaluateJob(job, actor) {
  const before = clone(job);
  const result = computeDrift(job);
  job.evaluationState = "completed";
  job.baselineReferenceVersion = result.baselineReferenceVersion;
  job.metricDrift = result.metricDrift;
  job.featureDrift = result.featureDrift;
  job.driftDetected = result.driftDetected;
  job.driftSeverity = result.driftSeverity;
  job.driftSummary = result.driftSummary;

  if (result.driftDetected) {
    job.workflowState = "pending_owner_review";
  } else {
    job.workflowState = "approved_auto";
    job.autoApproved = true;
    job.finalDecisionAt = nowIso();
    job.finalDecisionBy = "system";
  }

  addAuditEvent({
    entityType: "job",
    entityId: job.jobId,
    eventType: result.driftDetected ? "job_flagged_for_owner_review" : "job_auto_approved",
    actor,
    before,
    after: job,
    metadata: {
      baselineReferenceVersion: job.baselineReferenceVersion,
      driftSummary: job.driftSummary
    }
  });

  return job;
}

function serializeProject(project) {
  const projectModels = state.models.filter((model) => model.projectId === project.projectId);
  const pendingReviewCount = state.jobs.filter((job) => projectModels.some((model) => model.modelId === job.modelId) && ["pending_owner_review", "pending_approver_review"].includes(job.workflowState)).length;
  return {
    ...project,
    modelCount: projectModels.length,
    pendingReviewCount
  };
}

function serializeModel(model) {
  const jobs = state.jobs.filter((job) => job.modelId === model.modelId).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const latestJob = jobs[0] ? serializeJobSummary(jobs[0]) : null;
  return {
    ...model,
    owner: users[model.ownerUserId],
    latestJob,
    jobCount: jobs.length
  };
}

function serializeJobSummary(job) {
  return {
    jobId: job.jobId,
    jobRunNumber: job.jobRunNumber,
    submittedAt: job.submittedAt,
    workflowState: job.workflowState,
    driftDetected: job.driftDetected,
    driftSeverity: job.driftSeverity
  };
}

function serializeJob(job) {
  const model = getModel(job.modelId);
  const project = getProject(model.projectId);
  const approvals = state.approvalDecisions.filter((decision) => decision.jobId === job.jobId);
  return {
    ...clone(job),
    model: { modelId: model.modelId, name: model.name, modelCode: model.modelCode, region: model.region },
    project: { projectId: project.projectId, name: project.name },
    approvals,
    submittedByUser: users[job.submittedBy]
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendError(res, statusCode, code, message) {
  sendJson(res, statusCode, { error: { code, message, details: {} } });
}

function getActorFromRequest(req) {
  const roleHeader = String(req.headers["x-user-role"] || "model_owner");
  if (roleHeader === "admin") return users.admin_1;
  if (roleHeader === "model_approver") return users.approver_1;
  return users.owner_1;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function notFound(res) {
  sendError(res, 404, "NOT_FOUND", "The requested resource was not found.");
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir)) {
    sendError(res, 403, "FORBIDDEN", "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        notFound(res);
        return;
      }
      sendError(res, 500, "STATIC_READ_FAILED", "Unable to read static asset.");
      return;
    }

    const ext = path.extname(filePath);
    const contentType = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8"
    }[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

function handleApi(req, res, pathname) {
  const actor = getActorFromRequest(req);

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    const projects = state.projects.map(serializeProject);
    const models = state.models.map(serializeModel);
    const jobs = state.jobs
      .slice()
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .map(serializeJobSummary);
    const pendingQueue = state.jobs
      .filter((job) => ["pending_owner_review", "pending_approver_review"].includes(job.workflowState))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .map(serializeJob);

    sendJson(res, 200, {
      currentUser: actor,
      projects,
      models,
      jobs,
      pendingQueue
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/projects") {
    sendJson(res, 200, state.projects.map(serializeProject));
    return;
  }

  const modelJobsMatch = pathname.match(/^\/api\/models\/([^/]+)\/jobs$/);
  if (req.method === "GET" && modelJobsMatch) {
    const modelId = modelJobsMatch[1];
    const model = getModel(modelId);
    if (!model) {
      notFound(res);
      return;
    }
    const jobs = state.jobs
      .filter((job) => job.modelId === modelId)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .map(serializeJobSummary);
    sendJson(res, 200, jobs);
    return;
  }

  const modelDetailMatch = pathname.match(/^\/api\/models\/([^/]+)$/);
  if (req.method === "GET" && modelDetailMatch) {
    const model = getModel(modelDetailMatch[1]);
    if (!model) {
      notFound(res);
      return;
    }
    sendJson(res, 200, serializeModel(model));
    return;
  }

  const jobDetailMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (req.method === "GET" && jobDetailMatch) {
    const job = getJob(jobDetailMatch[1]);
    if (!job) {
      notFound(res);
      return;
    }
    sendJson(res, 200, serializeJob(job));
    return;
  }

  const evaluateMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/evaluate$/);
  if (req.method === "POST" && evaluateMatch) {
    const job = getJob(evaluateMatch[1]);
    if (!job) {
      notFound(res);
      return;
    }
    const evaluated = evaluateJob(job, actor);
    sendJson(res, 200, serializeJob(evaluated));
    return;
  }

  const ownerReviewMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/owner-review$/);
  if (req.method === "POST" && ownerReviewMatch) {
    const job = getJob(ownerReviewMatch[1]);
    if (!job) {
      notFound(res);
      return;
    }
    if (actor.role !== "model_owner") {
      sendError(res, 403, "FORBIDDEN", "Only a model owner can perform owner review.");
      return;
    }
    if (job.workflowState !== "pending_owner_review") {
      sendError(res, 409, "INVALID_WORKFLOW_TRANSITION", "Owner review is only allowed when the job is pending owner review.");
      return;
    }
    parseBody(req)
      .then((body) => {
        if (!body.decision || !["approved", "rejected"].includes(body.decision)) {
          sendError(res, 400, "INVALID_DECISION", "Decision must be approved or rejected.");
          return;
        }
        if (job.driftDetected && body.decision === "approved" && !String(body.justificationText || "").trim()) {
          sendError(res, 422, "JUSTIFICATION_REQUIRED", "A justification is required for drifted jobs.");
          return;
        }

        const before = clone(job);
        const decision = {
          approvalDecisionId: `appr_${state.counters.approval++}`,
          jobId: job.jobId,
          stage: "owner_review",
          actorUserId: actor.userId,
          actorRole: actor.role,
          decision: body.decision,
          justificationText: String(body.justificationText || "").trim(),
          createdAt: nowIso()
        };
        state.approvalDecisions.push(decision);

        if (body.decision === "approved") {
          job.workflowState = "pending_approver_review";
        } else {
          job.workflowState = "rejected";
          job.finalDecisionAt = nowIso();
          job.finalDecisionBy = actor.userId;
        }

        addAuditEvent({
          entityType: "job",
          entityId: job.jobId,
          eventType: body.decision === "approved" ? "owner_approved_with_justification" : "owner_rejected",
          actor,
          before,
          after: job,
          metadata: { stage: "owner_review", justificationText: decision.justificationText }
        });

        sendJson(res, 200, serializeJob(job));
      })
      .catch(() => sendError(res, 400, "INVALID_JSON", "Request body must be valid JSON."));
    return;
  }

  const approverReviewMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/approver-review$/);
  if (req.method === "POST" && approverReviewMatch) {
    const job = getJob(approverReviewMatch[1]);
    if (!job) {
      notFound(res);
      return;
    }
    if (actor.role !== "model_approver") {
      sendError(res, 403, "FORBIDDEN", "Only a model approver can perform final review.");
      return;
    }
    if (job.workflowState !== "pending_approver_review") {
      sendError(res, 409, "INVALID_WORKFLOW_TRANSITION", "Approver review is only allowed after owner approval.");
      return;
    }
    parseBody(req)
      .then((body) => {
        if (!body.decision || !["approved", "rejected"].includes(body.decision)) {
          sendError(res, 400, "INVALID_DECISION", "Decision must be approved or rejected.");
          return;
        }
        const before = clone(job);
        const decision = {
          approvalDecisionId: `appr_${state.counters.approval++}`,
          jobId: job.jobId,
          stage: "approver_review",
          actorUserId: actor.userId,
          actorRole: actor.role,
          decision: body.decision,
          justificationText: String(body.justificationText || "").trim(),
          createdAt: nowIso()
        };
        state.approvalDecisions.push(decision);
        job.workflowState = body.decision === "approved" ? "approved_final" : "rejected";
        job.finalDecisionAt = nowIso();
        job.finalDecisionBy = actor.userId;

        addAuditEvent({
          entityType: "job",
          entityId: job.jobId,
          eventType: body.decision === "approved" ? "approver_approved" : "approver_rejected",
          actor,
          before,
          after: job,
          metadata: { stage: "approver_review", justificationText: decision.justificationText }
        });

        sendJson(res, 200, serializeJob(job));
      })
      .catch(() => sendError(res, 400, "INVALID_JSON", "Request body must be valid JSON."));
    return;
  }

  const auditMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/audit-events$/);
  if (req.method === "GET" && auditMatch) {
    const job = getJob(auditMatch[1]);
    if (!job) {
      notFound(res);
      return;
    }
    const events = state.auditEvents.filter((event) => event.entityType === "job" && event.entityId === job.jobId);
    sendJson(res, 200, events);
    return;
  }

  notFound(res);
}

function bootstrapPendingEvaluation() {
  state.jobs
    .filter((job) => job.evaluationState !== "completed")
    .forEach((job) => evaluateJob(job, { userId: "system", name: "System Evaluation", role: "system" }));
}

bootstrapPendingEvaluation();

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname);
    return;
  }

  serveStatic(req, res, pathname);
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`MMP prototype running at http://${HOST}:${PORT}`);
  });
}

module.exports = {
  handleRequest,
  server,
  state,
  users,
  computeDeviation,
  computeDrift,
  evaluateJob,
  serializeJob,
  serializeModel,
  serializeProject
};
