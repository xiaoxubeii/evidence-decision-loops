"use strict";

function parseDecisionRecord(reportText) {
  const text = String(reportText || "");
  const decision = matchLine(text, "Decision");
  const citedEvidence = splitEvidenceIds(matchLine(text, "Cited evidence"));
  const evidenceSufficiency = matchLine(text, "Evidence sufficiency");
  const evidenceGaps = matchLine(text, "Evidence gaps");
  const conflictStatus = matchLine(text, "Conflict status");
  const reviewRecommendation = parseReviewRecommendation(text);
  const rationale = parseRationale(text);
  const workflow = parseWorkflow(text);
  const evidenceAssessments = extractEvidenceAssessments(workflow);
  return {
    decision,
    citedEvidence,
    evidenceSufficiency,
    evidenceGaps,
    conflictStatus,
    reviewRecommendation,
    rationale,
    workflow,
    workflowSummary: summarizeWorkflow(workflow),
    evidenceAssessments,
    auditFlags: deriveAuditFlags({ citedEvidence, workflow, evidenceAssessments, reviewRecommendation, evidenceGaps, conflictStatus }),
  };
}

function matchLine(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^${escaped}:\\s*(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

function parseRationale(text) {
  const match = text.match(/^Rationale:\s*([\s\S]*?)(?:\n\nRecorded evidence workflow:|\nRecorded evidence workflow:|$)/m);
  return match ? match[1].trim() : "";
}

function parseReviewRecommendation(text) {
  return {
    label: matchLine(text, "Review recommendation") || "Not explicitly recorded",
    reason: matchLine(text, "Review reason"),
  };
}

function parseWorkflow(text) {
  const marker = "Recorded evidence workflow:";
  const start = text.indexOf(marker);
  if (start < 0) return [];
  return text
    .slice(start + marker.length)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseWorkflowLine)
    .filter(Boolean);
}

function parseWorkflowLine(line) {
  const match = line.match(/^(\d+)\.\s+action=([^;]+);\s+input=(.*?);\s+returned=(.*?)(?:\s+content=(.*))?$/);
  if (!match) return null;
  const action = match[2].trim();
  const inputRaw = match[3].trim();
  const returnedRaw = match[4].trim();
  return {
    index: Number(match[1]),
    action,
    inputSummary: summarizeInput(action, inputRaw),
    returnedSummary: summarizeReturned(action, returnedRaw),
  };
}

function summarizeInput(action, raw) {
  const parsed = parseJsonLoose(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    if (action === "submit_decision") return summarizeMalformedSubmitDecision(raw);
    return compact(raw);
  }
  if (action === "search_segments") {
    const pieces = [];
    if (parsed.query) pieces.push(`query: ${parsed.query}`);
    if (parsed.topK) pieces.push(`topK: ${parsed.topK}`);
    if (parsed.searchMode) pieces.push(`mode: ${parsed.searchMode}`);
    return pieces.join("; ");
  }
  if (action === "read_segment") {
    return [parsed.documentId, parsed.segmentId].filter(Boolean).join(":");
  }
  if (action === "submit_decision") {
    const evidence = Array.isArray(parsed.citedEvidence)
      ? parsed.citedEvidence.map((item) => [item.documentId, item.segmentId].filter(Boolean).join(":")).filter(Boolean)
      : [];
    return [
      `decision: ${parsed.decision || ""}`,
      evidence.length ? `cited: ${evidence.join(", ")}` : "",
      parsed.rationale ? `rationale: ${parsed.rationale}` : "",
    ].filter(Boolean).join("\n");
  }
  return summarizeObject(parsed);
}

function summarizeMalformedSubmitDecision(raw) {
  const decision = raw.match(/"decision"\s*:\s*"([^"]*)"/);
  const rationale = raw.match(/"rationale"\s*:\s*"([\s\S]*?)"\s*,/);
  const evidence = Array.from(raw.matchAll(/"documentId"\s*:\s*"([^"]+)"\s*,\s*"segmentId"\s*:\s*"([^"]+)"/g))
    .map((match) => `${match[1]}:${match[2]}`);
  const lines = [
    decision ? `decision: ${decodeJsonString(decision[1])}` : "",
    evidence.length ? `cited: ${evidence.join(", ")}` : "",
    rationale ? `rationale: ${decodeJsonString(rationale[1])}` : compact(raw),
  ].filter(Boolean);
  return lines.join("\n");
}

function decodeJsonString(value) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch (_error) {
    return value;
  }
}

function summarizeReturned(action, raw) {
  if (raw === "null") return action === "read_segment" ? "read" : "recorded";
  const parsed = parseJsonLoose(raw);
  if (Array.isArray(parsed)) return parsed.map(normalizeReturnedId).join(", ");
  if (parsed && typeof parsed === "object") return summarizeObject(parsed);
  return compact(raw);
}

function summarizeObject(value) {
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${formatValue(item)}`)
    .join("\n");
}

function formatValue(value) {
  if (Array.isArray(value)) {
    if (value.every((item) => item && typeof item === "object" && (item.documentId || item.segmentId))) {
      return value.map((item) => [item.documentId, item.segmentId].filter(Boolean).join(":")).join(", ");
    }
    return JSON.stringify(value);
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value == null ? "" : value);
}

function normalizeReturnedId(value) {
  return String(value).replace(/\t/g, ":");
}

function splitEvidenceIds(value) {
  if (!value || value.toLowerCase() === "none") return [];
  return value.split(/,\s*/).map((item) => item.trim()).filter(Boolean);
}

function parseJsonLoose(value) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function summarizeWorkflow(workflow) {
  return {
    totalSteps: workflow.length,
    searches: countActions(workflow, "search_segments"),
    segmentsRead: countActions(workflow, "read_segment"),
    evidenceAssessments: countActions(workflow, "assess_evidence"),
    requestsMoreEvidence: countActions(workflow, "request_more_evidence"),
    submissions: countActions(workflow, "submit_decision"),
  };
}

function countActions(workflow, action) {
  return workflow.filter((step) => step.action === action).length;
}

function extractEvidenceAssessments(workflow) {
  return workflow
    .filter((step) => step.action === "assess_evidence")
    .map((step) => ({
      index: step.index,
      summary: step.inputSummary,
    }));
}

function deriveAuditFlags({ citedEvidence, workflow, evidenceAssessments, reviewRecommendation, evidenceGaps, conflictStatus }) {
  const flags = [];
  if (!citedEvidence.length) flags.push("No cited evidence recorded");
  if (reviewRecommendation && reviewRecommendation.label === "Human review required") {
    flags.push("Human review required by decision record");
  }
  if (evidenceGaps && !/^not explicitly recorded$/i.test(evidenceGaps) && !/^none recorded$/i.test(evidenceGaps)) {
    flags.push("Evidence gap status recorded");
  }
  if (conflictStatus && !/^not explicitly recorded$/i.test(conflictStatus) && !/^none recorded$/i.test(conflictStatus)) {
    flags.push("Conflict status recorded");
  }
  if (evidenceAssessments.some((item) => /sufficiency:\s*insufficient/i.test(item.summary))) {
    flags.push("Evidence marked insufficient during workflow");
  }
  if (workflow.some((step) => step.action === "request_more_evidence")) {
    flags.push("Workflow requested more evidence");
  }
  if (countActions(workflow, "submit_decision") > 1) {
    flags.push("Multiple final submissions recorded");
  }
  return flags;
}

function compact(value, maxLength = 180) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}

module.exports = { parseDecisionRecord };
