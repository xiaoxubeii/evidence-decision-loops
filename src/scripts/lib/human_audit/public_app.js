"use strict";

const { normalizeBasePath } = require("./base_path");

function renderAppHtml(options = {}) {
  const basePath = normalizeBasePath(options.basePath || "");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EviAgent Human Audit Study</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #17202a; background: #f6f8fb; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    .panel { background: #fff; border: 1px solid #d9e0ea; border-radius: 8px; padding: 18px; margin-bottom: 16px; }
    .muted { color: #65758b; }
    .topline { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 14px; }
    .question-nav { display: grid; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); gap: 8px; margin-bottom: 16px; }
    .nav-item { min-width: 38px; height: 34px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; border-radius: 6px; padding: 0; font-size: 13px; }
    .nav-item.completed { background: #1f2937; border-color: #1f2937; color: #fff; }
    .nav-item.current { outline: 3px solid #60a5fa; outline-offset: 1px; }
    .report { max-width: 100%; box-sizing: border-box; overflow-x: auto; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.45; background: #f9fbfd; border: 1px solid #d9e0ea; padding: 14px; border-radius: 6px; }
    .decision-brief { border: 1px solid #d9e0ea; background: #fff; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
    .decision-summary-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .decision-status { border: 1px solid #d9e0ea; background: #f8fafc; border-radius: 6px; padding: 10px; min-width: 0; }
    .decision-status-label { display: block; color: #65758b; font-size: 12px; margin-bottom: 5px; }
    .decision-status-value { display: block; font-size: 17px; font-weight: 700; overflow-wrap: anywhere; }
    .decision-status-note { margin: 6px 0 0; color: #65758b; font-size: 13px; line-height: 1.35; }
    .decision-rationale { border-top: 1px solid #d9e0ea; border-bottom: 1px solid #d9e0ea; padding: 14px 0; margin-bottom: 14px; }
    .decision-rationale h3 { margin: 0 0 8px; font-size: 16px; }
    .decision-rationale p { margin: 0; font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; }
    .decision-evidence-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr); gap: 12px; }
    .decision-evidence-grid + .record-block { margin-top: 12px; }
    .decision-record-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
    .record-block { min-width: 0; border: 1px solid #d9e0ea; background: #fbfdff; border-radius: 6px; padding: 12px; }
    .record-block + .record-block { margin-top: 12px; }
    .decision-evidence-grid > .record-block { margin-top: 0; }
    .record-block h3 { margin: 0 0 8px; font-size: 15px; }
    .record-block h4 { margin: 12px 0 6px; font-size: 13px; color: #334155; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { display: inline-flex; align-items: center; border: 1px solid #cbd5e1; background: #eef4ff; border-radius: 999px; padding: 4px 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    .summary-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .metric { border: 1px solid #d9e0ea; border-radius: 6px; background: #fff; padding: 8px; }
    .metric-value { display: block; font-size: 18px; font-weight: 700; }
    .metric-label { display: block; color: #65758b; font-size: 12px; }
    .evidence-list { display: grid; gap: 10px; }
    .evidence-item { border-top: 1px solid #d9e0ea; padding-top: 10px; }
    .evidence-item:first-child { border-top: 0; padding-top: 0; }
    .evidence-text { margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5; }
    .assessment-list { margin: 0; padding-left: 20px; }
    .assessment-list li { margin: 8px 0; white-space: pre-wrap; }
    .workflow-details { min-width: 0; overflow-x: auto; margin-top: 12px; border: 1px solid #d9e0ea; border-radius: 6px; background: #fbfdff; padding: 12px; }
    .workflow-details summary { cursor: pointer; font-weight: 700; }
    .workflow-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; table-layout: fixed; }
    .workflow-table th, .workflow-table td { border: 1px solid #d9e0ea; padding: 8px; vertical-align: top; text-align: left; word-break: break-word; white-space: pre-wrap; }
    .workflow-table th { background: #f1f5f9; }
    details.raw-record { min-width: 0; overflow-x: auto; margin-top: 12px; border: 1px solid #d9e0ea; border-radius: 6px; background: #fbfdff; padding: 12px; }
    details.raw-record summary { cursor: pointer; font-weight: 700; }
    .choices label { display: block; margin: 10px 0; }
    .range-row { display: grid; grid-template-columns: 150px 1fr 90px; gap: 12px; align-items: center; margin: 12px 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    button { border: 1px solid #1f6feb; background: #1f6feb; color: #fff; padding: 10px 14px; border-radius: 6px; cursor: pointer; }
    button.secondary { border-color: #cbd5e1; background: #fff; color: #17202a; }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    textarea { width: 100%; min-height: 70px; box-sizing: border-box; }
    @media (max-width: 720px) {
      main { padding: 14px; }
      .topline { display: block; }
      .range-row { grid-template-columns: 1fr; gap: 6px; }
      .decision-summary-strip { grid-template-columns: 1fr; }
      .decision-evidence-grid { grid-template-columns: 1fr; }
      .decision-record-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
<main>
  <h1>Human Audit Study</h1>
  <div id="app" class="panel">Loading...</div>
</main>
<script>
const params = new URLSearchParams(location.search);
const rater = params.get("rater");
const token = params.get("token");
const basePath = ${JSON.stringify(basePath)};
let startedAt = null;
let lastSession = null;

async function loadSession(assignmentId) {
  const query = new URLSearchParams({ rater: rater || "", token: token || "" });
  if (assignmentId) query.set("assignment", assignmentId);
  const data = await fetchJson(appUrl("/api/session?") + query.toString());
  lastSession = data;
  render(data);
}

function appUrl(path) {
  return basePath + path;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function render(data) {
  const root = document.getElementById("app");
  const completed = (data.assignments || []).filter(item => item.completed).length;
  const total = (data.assignments || []).length;
  const nav = renderQuestionNav(data.assignments || [], data.current && data.current.assignment.assignmentId);
  if (!data.current || !data.current.assignment) {
    root.innerHTML = \`
      <div class="topline">
        <p class="muted">Rater: \${escapeHtml(data.raterId)} | Completed \${completed} / \${total}</p>
      </div>
      \${nav}
      <h2>Complete</h2>
      <p>All assigned records have been submitted.</p>
    \`;
    bindNav();
    return;
  }

  startedAt = new Date();
  const a = data.current.assignment;
  const s = data.current.stimulus;
  const response = data.current.response || {};
  const previousId = adjacentAssignmentId(data.assignments || [], a.assignmentId, -1);
  const nextId = adjacentAssignmentId(data.assignments || [], a.assignmentId, 1);

  root.innerHTML = \`
    <div class="topline">
      <p class="muted">Rater: \${escapeHtml(data.raterId)} | Item \${a.order} | Completed \${completed} / \${total}</p>
      <p class="muted">\${response.responseId ? "Saved revision " + escapeHtml(response.revision || 1) : "Unsaved"}</p>
    </div>
    \${nav}
    <h2>Case</h2>
    <p><strong>Task:</strong> \${escapeHtml(s.taskText)}</p>
    <p><strong>Allowed decisions:</strong> \${escapeHtml((s.allowedDecisions || []).join(", "))}</p>
    <p><strong>System decision:</strong> \${escapeHtml(s.systemDecision || "")}</p>
    <h2>Audit Evidence Materials</h2>
    <div class="report">\${escapeHtml((s.referenceEvidence || []).map(e => e.documentId + ":" + e.segmentId + "\\n" + e.text).join("\\n\\n"))}</div>
    <h2>Decision Record</h2>
    \${renderDecisionRecord(s)}
    <h2>Your Audit</h2>
    <form id="response-form">
      <input type="hidden" name="assignmentId" value="\${escapeHtml(a.assignmentId)}">
      <input type="hidden" name="stimulusId" value="\${escapeHtml(a.stimulusId)}">
      <div class="choices">
        <label><input type="radio" name="acceptability" value="accept" \${checked(response.acceptability, "accept")} required> Accept as safe/correct</label>
        <label><input type="radio" name="acceptability" value="intercept" \${checked(response.acceptability, "intercept")} required> Intercept as unsafe/incorrect</label>
        <label><input type="radio" name="acceptability" value="return" \${checked(response.acceptability, "return")} required> Return for rework because evidence is insufficient</label>
      </div>
      <label class="range-row"><span>Confidence</span><input type="range" name="confidence" min="1" max="5" value="\${escapeHtml(response.confidence || 3)}"><span>1 low - 5 high</span></label>
      <label class="range-row"><span>Cognitive load</span><input type="range" name="cognitiveLoad" min="1" max="5" value="\${escapeHtml(response.cognitiveLoad || 3)}"><span>1 low - 5 high</span></label>
      <label>Notes: <textarea name="notes">\${escapeHtml(response.notes || "")}</textarea></label>
      <div class="actions">
        <button type="button" class="secondary" id="previous-item" \${previousId ? "" : "disabled"}>Previous</button>
        <button type="submit" name="intent" value="save">Save</button>
        <button type="submit" name="intent" value="save-next">Save & Next</button>
        <button type="button" class="secondary" id="next-item" \${nextId ? "" : "disabled"}>Next</button>
      </div>
    </form>
  \`;
  bindNav();
  document.getElementById("response-form").addEventListener("submit", submitResponse);
  document.getElementById("previous-item").addEventListener("click", () => loadSession(previousId));
  document.getElementById("next-item").addEventListener("click", () => loadSession(nextId));
}

function renderDecisionRecord(stimulus) {
  const record = stimulus.decisionRecord || {};
  return \`
    <section class="decision-brief">
      <div class="decision-summary-strip">
        <div class="decision-status">
          <span class="decision-status-label">System Decision</span>
          <span class="decision-status-value">\${escapeHtml(stimulus.systemDecision || record.decision || "Not recorded")}</span>
          <p class="decision-status-note">Report format: \${escapeHtml(stimulus.formatLabel || "Not recorded")}</p>
        </div>
        <div class="decision-status">
          <span class="decision-status-label">Review Recommendation</span>
          <span class="decision-status-value">\${escapeHtml(reviewRecommendationLabel(record.reviewRecommendation))}</span>
          <p class="decision-status-note">\${escapeHtml(reviewRecommendationReason(record.reviewRecommendation) || "No review reason recorded")}</p>
        </div>
        <div class="decision-status">
          <span class="decision-status-label">Evidence Check</span>
          <span class="decision-status-value">\${escapeHtml(displayEvidenceStateValue(record.evidenceSufficiency))}</span>
          <p class="decision-status-note">\${escapeHtml(evidenceStateSummary(record))}</p>
        </div>
      </div>
      <section class="decision-rationale">
        <h3>Rationale</h3>
        <p>\${escapeHtml(record.rationale || "Not recorded")}</p>
      </section>
      <div class="decision-evidence-grid">
        <section class="record-block">
          <h3>Key Evidence</h3>
          \${renderCitedEvidenceDetails(record.citedEvidenceDetails || [], record.citedEvidence || [])}
        </section>
        <section class="record-block">
          <h3>Audit Cues</h3>
          <h4>Evidence State Details</h4>
          \${renderEvidenceState(record)}
        </section>
      </div>
      <section class="record-block">
        <h3>Workflow Summary</h3>
        \${renderWorkflowSummary(record.workflowSummary)}
      </section>
      \${renderWorkflowDetails(record.workflow || [], record.workflowSummary)}
      <details class="raw-record">
        <summary>Raw decision record</summary>
        <div class="report">\${escapeHtml(stimulus.reportText || "")}</div>
      </details>
    </section>
  \`;
}

function renderReviewRecommendation(recommendation) {
  const label = reviewRecommendationLabel(recommendation);
  const reason = reviewRecommendationReason(recommendation);
  return \`
    <p><strong>\${escapeHtml(label)}</strong></p>
    \${reason ? \`<p>\${escapeHtml(reason)}</p>\` : '<p class="muted">No review reason recorded</p>'}
  \`;
}

function reviewRecommendationLabel(recommendation) {
  return recommendation && recommendation.label ? recommendation.label : "Not explicitly recorded";
}

function reviewRecommendationReason(recommendation) {
  return recommendation && recommendation.reason ? recommendation.reason : "";
}

function renderChips(values) {
  if (!values.length) return '<span class="muted">Not recorded</span>';
  return \`<div class="chips">\${values.map(value => \`<span class="chip">\${escapeHtml(value)}</span>\`).join("")}</div>\`;
}

function renderCitedEvidenceDetails(details, fallbackEvidenceIds) {
  const rows = details.length ? details : fallbackEvidenceIds.map(evidenceId => ({ evidenceId, text: "" }));
  if (!rows.length) return '<span class="muted">Not recorded</span>';
  return \`
    <div class="evidence-list">\${rows.map(item => \`
      <div class="evidence-item">
        <span class="chip">\${escapeHtml(item.evidenceId)}</span>
        <p class="evidence-text">\${item.text ? escapeHtml(item.text) : '<span class="muted">Segment text unavailable</span>'}</p>
      </div>
    \`).join("")}</div>
  \`;
}

function renderWorkflowSummary(summary) {
  if (!summary || !summary.totalSteps) return '<p class="muted">No workflow recorded</p>';
  const metrics = [
    ["Steps", summary.totalSteps],
    ["Searches", summary.searches],
    ["Segments read", summary.segmentsRead],
    ["Assessments", summary.evidenceAssessments],
    ["More evidence", summary.requestsMoreEvidence],
    ["Submissions", summary.submissions],
  ];
  return \`
    <div class="summary-metrics">\${metrics.map(([label, value]) => \`
      <div class="metric">
        <span class="metric-value">\${escapeHtml(value)}</span>
        <span class="metric-label">\${escapeHtml(label)}</span>
      </div>
    \`).join("")}</div>
  \`;
}

function renderEvidenceState(record) {
  if (!hasExplicitEvidenceState(record)) {
    return '<p class="muted">No structured evidence-state fields were recorded for this item.</p>';
  }
  const detailItems = [
    isRecordedEvidenceStateValue(record.evidenceGaps)
      ? ["Gap rationale", displayEvidenceStateValue(record.evidenceGaps)]
      : null,
    isRecordedEvidenceStateValue(record.conflictStatus)
      ? ["Conflict rationale", displayEvidenceStateValue(record.conflictStatus)]
      : null,
  ].filter(Boolean);
  return \`
    \${detailItems.length ? \`
      <div class="decision-record-grid">\${detailItems.map(([label, value]) => \`
        <div>
          <h4>\${escapeHtml(label)}</h4>
          <p>\${escapeHtml(value)}</p>
        </div>
      \`).join("")}</div>
    \` : '<p class="muted">No gap or conflict rationale was recorded.</p>'}
    \${renderEvidenceAssessments(record.evidenceAssessments || [], record.auditFlags || [])}
  \`;
}

function hasExplicitEvidenceState(record) {
  return Boolean(
    isRecordedEvidenceStateValue(record.evidenceSufficiency)
    || isRecordedEvidenceStateValue(record.evidenceGaps)
    || isRecordedEvidenceStateValue(record.conflictStatus)
  );
}

function evidenceStateSummary(record) {
  if (!hasExplicitEvidenceState(record)) return "No sufficiency, gap, or conflict fields in the source record.";
  return "Gap: " + compactEvidenceStateStatus(record.evidenceGaps, "gap") + " | Conflict: " + compactEvidenceStateStatus(record.conflictStatus, "conflict");
}

function displayEvidenceStateValue(value) {
  if (!isRecordedEvidenceStateValue(value)) return "Not recorded";
  const parsed = parseEvidenceStateJson(value);
  if (!parsed) return value;
  return evidenceStateObjectLabel(parsed, "detail");
}

function isRecordedEvidenceStateValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized && normalized !== "not explicitly recorded" && normalized !== "none recorded");
}

function compactEvidenceStateStatus(value, type) {
  if (!isRecordedEvidenceStateValue(value)) return "Not recorded";
  const parsed = parseEvidenceStateJson(value);
  if (!parsed) return truncateDisplay(value, 80);
  return evidenceStateObjectLabel(parsed, type);
}

function parseEvidenceStateJson(value) {
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function evidenceStateObjectLabel(value, type) {
  if (type === "gap" && typeof value.hasMaterialGap === "boolean") {
    return value.hasMaterialGap ? "Material gap" : "No material gap";
  }
  if (type === "conflict" && typeof value.hasConflict === "boolean") {
    return value.hasConflict ? "Conflict" : "No conflict";
  }
  const reason = value.reason || value.rationale || "";
  if (type === "detail" && reason) return reason;
  return JSON.stringify(value);
}

function truncateDisplay(value, maxLength) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength - 3) + "...";
}

function renderEvidenceAssessments(assessments, auditFlags) {
  const flags = auditFlags.length ? renderChips(auditFlags) : '<span class="muted">No workflow flags recorded</span>';
  const assessmentList = assessments.length
    ? \`<ol class="assessment-list">\${assessments.map(item => \`<li><strong>Step \${escapeHtml(item.index)}:</strong> \${escapeHtml(item.summary)}</li>\`).join("")}</ol>\`
    : '<p class="muted">No structured evidence assessment recorded</p>';
  return \`
    <h4>Audit cues</h4>
    \${flags}
    <h4>Structured evidence assessments</h4>
    \${assessmentList}
  \`;
}

function renderWorkflowDetails(steps, summary) {
  if (!steps.length) return "";
  return \`
    <details class="workflow-details">
      <summary>Evidence workflow / tool trace (optional): \${escapeHtml(formatWorkflowSummaryLine(summary))}</summary>
      \${renderWorkflow(steps)}
    </details>
  \`;
}

function formatWorkflowSummaryLine(summary) {
  if (!summary || !summary.totalSteps) return "no workflow recorded";
  return [
    \`\${summary.totalSteps} steps\`,
    \`\${summary.searches} searches\`,
    \`\${summary.segmentsRead} segments read\`,
    \`\${summary.evidenceAssessments} assessments\`,
    \`\${summary.submissions} submissions\`,
  ].join(", ");
}

function renderWorkflow(steps) {
  if (!steps.length) return '<p class="muted">Not recorded</p>';
  return \`
    <table class="workflow-table">
      <thead><tr><th style="width:44px">#</th><th style="width:145px">Action</th><th>Key input</th><th>Returned / notes</th></tr></thead>
      <tbody>\${steps.map(step => \`
        <tr>
          <td>\${escapeHtml(step.index)}</td>
          <td>\${escapeHtml(step.action)}</td>
          <td>\${escapeHtml(step.inputSummary)}</td>
          <td>\${escapeHtml(step.returnedSummary)}</td>
        </tr>
      \`).join("")}</tbody>
    </table>
  \`;
}

function renderQuestionNav(assignments, currentAssignmentId) {
  return \`<div class="question-nav">\${assignments.map(item => \`
    <button type="button" class="nav-item \${item.completed ? "completed" : ""} \${item.assignmentId === currentAssignmentId ? "current" : ""}" data-assignment-id="\${escapeHtml(item.assignmentId)}">\${escapeHtml(item.order)}</button>
  \`).join("")}</div>\`;
}

function bindNav() {
  for (const button of document.querySelectorAll("[data-assignment-id]")) {
    button.addEventListener("click", () => loadSession(button.getAttribute("data-assignment-id")));
  }
}

async function submitResponse(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const submittedAt = new Date();
  const body = {
    raterId: rater,
    token,
    assignmentId: form.get("assignmentId"),
    stimulusId: form.get("stimulusId"),
    startedAt: startedAt.toISOString(),
    submittedAt: submittedAt.toISOString(),
    clientElapsedMs: submittedAt.getTime() - startedAt.getTime(),
    acceptability: form.get("acceptability"),
    confidence: Number(form.get("confidence")),
    cognitiveLoad: Number(form.get("cognitiveLoad")),
    notes: form.get("notes") || ""
  };
  await fetchJson(appUrl("/api/response"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const intent = event.submitter && event.submitter.value;
  if (intent === "save-next") {
    const nextId = adjacentAssignmentId(lastSession.assignments || [], body.assignmentId, 1);
    await loadSession(nextId);
  } else {
    await loadSession(body.assignmentId);
  }
}

function adjacentAssignmentId(assignments, assignmentId, offset) {
  const index = assignments.findIndex(item => item.assignmentId === assignmentId);
  const next = index < 0 ? null : assignments[index + offset];
  return next ? next.assignmentId : null;
}

function checked(actual, expected) {
  return actual === expected ? "checked" : "";
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

loadSession().catch((error) => {
  document.getElementById("app").innerHTML = "<h2>Error</h2><pre>" + escapeHtml(error.message) + "</pre>";
});
</script>
</body>
</html>`;
}

module.exports = { renderAppHtml };
