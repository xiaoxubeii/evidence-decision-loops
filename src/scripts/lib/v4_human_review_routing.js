"use strict";

const REVIEW_REASON_MESSAGES = Object.freeze({
  insufficient_evidence: "EDL assessment did not find sufficient evidence.",
  material_gap: "Material evidence gap remains after EDL assessment.",
  material_conflict: "Material evidence conflict remains after EDL assessment.",
  missing_citation: "Final output did not cite evidence.",
  invalid_citation: "Final output contains invalid citation evidence.",
  forced_source_label_without_abstain: "Evidence was insufficient but the source has no abstain-like label.",
  parse_error: "Model output could not be parsed.",
  tool_error: "Tool execution failed.",
  model_error: "Model execution failed.",
});

function deriveV4HumanReviewRouting(input = {}) {
  const record = input.record || {};
  const output = input.output || {};
  const scores = input.scores || {};
  const controllerResult = input.controllerResult || {};
  const traceMeta = input.traceMeta || {};
  const reasons = [];
  const sufficiency = controllerResult.assessment && controllerResult.assessment.sufficiency;
  const evidenceInsufficient = Boolean(sufficiency && sufficiency !== "sufficient");
  const hasAbstainLabel = (record.allowedDecisions || []).some(isAbstainLikeLabel);

  if (evidenceInsufficient) reasons.push("insufficient_evidence");
  if (hasMaterialGap(output.gapAssessment)) reasons.push("material_gap");
  if (hasMaterialConflict(output.conflictAssessment) || sufficiency === "conflicting") reasons.push("material_conflict");
  if (!Array.isArray(output.citedEvidence) || output.citedEvidence.length === 0) reasons.push("missing_citation");
  if (scores.citationValid === false) reasons.push("invalid_citation");
  if (evidenceInsufficient && !hasAbstainLabel) reasons.push("forced_source_label_without_abstain");
  if (traceMeta.parseError) reasons.push("parse_error");
  if (traceMeta.toolError) reasons.push("tool_error");
  if (traceMeta.modelError) reasons.push("model_error");

  return buildReviewRouting(reasons);
}

function buildReviewRouting(reasons) {
  const reviewReasons = uniqueStrings(reasons);
  const required = reviewReasons.length > 0;
  return {
    requiredHumanReview: required,
    reviewReasons,
    reviewRouting: {
      required,
      reason: required ? reasonMessage(reviewReasons) : "",
      triggers: reviewReasons,
    },
  };
}

function isAbstainLikeLabel(label) {
  return /insufficient|not[_ -]?enough|unknown|uncertain|nei|cannot|unverifiable/i.test(String(label || ""));
}

function hasMaterialGap(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && value.hasMaterialGap === true);
}

function hasMaterialConflict(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && value.hasConflict === true);
}

function reasonMessage(reasons) {
  return REVIEW_REASON_MESSAGES[reasons[0]] || "EDL result requires human review.";
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    if (typeof value !== "string" || value.length === 0 || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

module.exports = {
  buildReviewRouting,
  deriveV4HumanReviewRouting,
  isAbstainLikeLabel,
};
