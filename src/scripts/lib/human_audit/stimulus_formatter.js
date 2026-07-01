"use strict";

function formatStimulusReport(trace, formatLabel) {
  const lines = [];
  lines.push(`Report format: ${formatLabel}`);
  lines.push(`System final decision: ${trace.output && trace.output.decision ? trace.output.decision : "UNKNOWN"}`);
  lines.push("");
  lines.push("Decision record:");
  lines.push(formatOutput(trace));
  if (Array.isArray(trace.steps) && trace.steps.length > 0) {
    lines.push("");
    lines.push("Recorded evidence workflow:");
    trace.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${formatStep(step)}`);
    });
  }
  return blindMethodNames(lines.join("\n"));
}

function formatOutput(trace) {
  const output = trace && trace.output;
  if (!output || typeof output !== "object") return "No structured output was available.";
  const cited = Array.isArray(output.citedEvidence)
    ? output.citedEvidence.map((item) => `${item.documentId || "unknown-doc"}:${item.segmentId || "unknown-seg"}`).join(", ")
    : "none";
  const review = summarizeReviewRecommendation(trace, output);
  return [
    `Decision: ${output.decision || "UNKNOWN"}`,
    `Cited evidence: ${cited}`,
    `Evidence sufficiency: ${summarizeEvidenceSufficiency(trace, output, review)}`,
    `Evidence gaps: ${summarizeGapAssessment(output)}`,
    `Conflict status: ${summarizeConflictAssessment(output)}`,
    `Review recommendation: ${review.label}`,
    review.reason ? `Review reason: ${review.reason}` : "",
    `Rationale: ${output.rationale || "No rationale provided."}`,
  ].filter(Boolean).join("\n");
}

function summarizeReviewRecommendation(trace, output) {
  const outputRequired = firstBoolean(
    output.requiredHumanReview,
    output.requireHumanReview,
    output.humanReviewRequired,
    output.require_human_review
  );
  const structuredRecord = isStructuredDecisionRecord(trace, output) || outputRequired != null;
  const routing = structuredRecord ? (output.reviewRouting || trace.reviewRouting || null) : null;
  const required = outputRequired != null ? outputRequired : routing && typeof routing.required === "boolean" ? routing.required : null;
  if (required == null) return { label: "Not explicitly recorded", reason: "" };
  const reason = reviewReason(output, trace, routing);
  return {
    label: required ? "Human review required" : "Proceed without additional review",
    reason,
  };
}

function isStructuredDecisionRecord(trace, output) {
  return (
    String(trace && trace.method || "").toLowerCase() === "edl" ||
    Array.isArray(output.evidenceAssessments) ||
    output.gapAssessment != null ||
    output.conflictAssessment != null ||
    output.reviewRouting != null
  );
}

function reviewReason(output, trace, routing) {
  if (routing && routing.reason) return String(routing.reason);
  if (Array.isArray(output.reviewReasons) && output.reviewReasons.length) return output.reviewReasons.join("; ");
  if (Array.isArray(trace.reviewReasons) && trace.reviewReasons.length) return trace.reviewReasons.join("; ");
  if (routing && Array.isArray(routing.triggers) && routing.triggers.length) return `Triggers: ${routing.triggers.join(", ")}`;
  return "";
}

function summarizeEvidenceSufficiency(trace, output, review) {
  const explicit = output.evidenceSufficiency || output.sufficiency || output.evidence_sufficiency;
  if (explicit) return String(explicit);
  if (review.label === "Human review required") return "Requires review";
  if (review.label === "Proceed without additional review") return "No insufficiency recorded";
  return "Not explicitly recorded";
}

function summarizeGapAssessment(output) {
  const value = output.gapAssessment || output.gap_assessment || output.evidenceGaps || output.unsupportedGaps || output.gaps;
  return summarizeAssessmentValue(value);
}

function summarizeConflictAssessment(output) {
  const value = output.conflictAssessment || output.conflict_assessment || output.conflictStatus || output.conflicts;
  return summarizeAssessmentValue(value);
}

function summarizeAssessmentValue(value) {
  if (Array.isArray(value)) {
    if (!value.length) return "None recorded";
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("; ");
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  if (value == null || value === "") return "Not explicitly recorded";
  return String(value);
}

function firstBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return null;
}

function formatStep(step) {
  const action = step.action || step.type || "recorded_step";
  const input = compactJson(step.input);
  const returned = compactJson(step.returned);
  const content = step.content ? ` content=${truncate(String(step.content), 500)}` : "";
  return `action=${action}; input=${input}; returned=${returned}${content}`;
}

function compactJson(value) {
  if (value == null) return "null";
  return truncate(JSON.stringify(value), 500);
}

function truncate(value, maxLength) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function blindMethodNames(value) {
  return String(value)
    .replace(/ReAct/gi, "Format X")
    .replace(/react(?=[_/-])/gi, "format_x")
    .replace(/\breact\b/gi, "format_x")
    .replace(/\bEDL\b/g, "Format Y")
    .replace(/edl(?=[_/-])/gi, "format_y")
    .replace(/\bedl\b/gi, "format_y");
}

module.exports = {
  blindMethodNames,
  formatStimulusReport,
};
