"use strict";

function scoreV4TraceProcess(record, trace) {
  const steps = Array.isArray(trace.steps) ? trace.steps : [];
  const submitIndex = firstActionIndex(steps, "submit_decision");
  const beforeSubmit = submitIndex >= 0 ? steps.slice(0, submitIndex) : steps;
  const searchStats = searchRequiredEvidenceRecall(record, steps);
  const readStats = readRequiredEvidenceRecall(record, trace, steps);
  const isEdl = trace.method === "edl";
  const searchedBeforeDecision = beforeSubmit.some((step) => step.action === "search_segments");
  const readBeforeDecision = beforeSubmit.some((step) => step.action === "read_segment")
    || readStats.observedTotal > 0;
  const assessedBeforeSubmit = isEdl ? beforeSubmit.some((step) => step.action === "assess_evidence") : null;
  const validatedBeforeSubmit = isEdl ? steps.some((step) => step.action === "edl_validate") : null;
  const humanReviewRequired = trace.requiredHumanReview === true;
  const reviewReasonCount = Array.isArray(trace.reviewReasons) ? trace.reviewReasons.length : 0;

  return {
    searchRequiredEvidenceRecall: searchStats.recall,
    searchRequiredEvidenceMatched: searchStats.matched,
    searchRequiredEvidenceTotal: searchStats.total,
    readRequiredEvidenceRecall: readStats.recall,
    readRequiredEvidenceMatched: readStats.matched,
    readRequiredEvidenceTotal: readStats.total,
    evidenceFailureStage: classifyEvidenceFailure(searchStats, readStats, trace),
    searchedBeforeDecision,
    readBeforeDecision,
    assessedBeforeSubmit,
    validatedBeforeSubmit,
    processValid: isEdl
      ? (readBeforeDecision && assessedBeforeSubmit && validatedBeforeSubmit)
      : (searchedBeforeDecision && readBeforeDecision),
    humanReviewRequired,
    reviewReasonCount,
    missedRequiredReview: Boolean(record.expectedReviewRequired && !humanReviewRequired),
    unnecessaryReview: Boolean(humanReviewRequired && !record.expectedReviewRequired),
  };
}

function searchRequiredEvidenceRecall(record, steps) {
  const requiredEvidence = Array.isArray(record.requiredEvidence) ? record.requiredEvidence : [];
  if (requiredEvidence.length === 0) return { recall: null, matched: 0, total: 0 };

  const returnedKeys = new Set();
  for (const step of steps) {
    if (step.action !== "search_segments") continue;
    for (const returned of step.returned || []) {
      const parsed = parseReturnedKey(returned);
      if (parsed) returnedKeys.add(evidenceKey(parsed));
    }
  }

  const requiredKeys = new Set(requiredEvidence.filter(hasEvidenceIds).map(evidenceKey));
  const matched = [...requiredKeys].filter((key) => returnedKeys.has(key)).length;
  return {
    recall: requiredKeys.size === 0 ? null : matched / requiredKeys.size,
    matched,
    total: requiredKeys.size,
  };
}

function readRequiredEvidenceRecall(record, trace, steps) {
  const requiredEvidence = Array.isArray(record.requiredEvidence) ? record.requiredEvidence : [];
  if (requiredEvidence.length === 0) return { recall: null, matched: 0, total: 0, observedTotal: 0 };

  const readKeys = new Set([
    ...readEvidenceValues(steps).map(evidenceKey),
    ...viewedEvidenceValues(trace).map(evidenceKey),
  ]);
  const matched = requiredEvidence.filter((required) => readKeys.has(evidenceKey(required))).length;
  return {
    recall: matched / requiredEvidence.length,
    matched,
    total: requiredEvidence.length,
    observedTotal: readKeys.size,
  };
}

function readEvidenceValues(steps) {
  return steps
    .filter((step) => step.action === "read_segment")
    .map((step) => step.output || step.result || step.input || {})
    .filter(hasEvidenceIds);
}

function viewedEvidenceValues(trace) {
  const viewedSegments = Array.isArray(trace.viewedSegments) ? trace.viewedSegments : [];
  return viewedSegments.filter(hasEvidenceIds);
}

function classifyEvidenceFailure(searchStats, readStats, trace) {
  const scores = trace.scores || {};
  const requiredRecall = scores.requiredEvidenceRecall;
  const decisionCorrect = scores.decisionCorrect;

  if (searchStats.total === 0) return null;
  if (searchStats.matched === 0) return "retrieval_miss";
  if (readStats.matched === 0) return "read_miss";
  if (typeof requiredRecall === "number" && requiredRecall < 1) return "citation_miss";
  if (decisionCorrect === false) return "decision_miss_after_evidence";
  return "none";
}

function firstActionIndex(steps, action) {
  return steps.findIndex((step) => step.action === action);
}

function hasEvidenceIds(value) {
  return value && typeof value.documentId === "string" && typeof value.segmentId === "string";
}

function evidenceKey(value) {
  return `${value.documentId}::${value.segmentId}`;
}

function parseReturnedKey(value) {
  if (typeof value !== "string") return null;
  const parts = value.split("\t");
  if (parts.length !== 2) return null;
  return { documentId: parts[0], segmentId: parts[1] };
}

module.exports = {
  scoreV4TraceProcess,
};
