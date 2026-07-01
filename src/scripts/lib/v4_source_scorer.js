"use strict";

function scoreV4Output(record, output) {
  const normalizedOutput = output && typeof output === "object" ? output : {};
  const decision = normalizedOutput.decision;
  const allowedDecisions = Array.isArray(record.allowedDecisions) ? record.allowedDecisions : [];
  const invalidDecision = !allowedDecisions.includes(decision);
  const decisionCorrect = !invalidDecision && decision === record.goldDecision;
  const citationParseErrors = Array.isArray(normalizedOutput.citationParseErrors)
    ? normalizedOutput.citationParseErrors.filter((error) => typeof error === "string" && error.length > 0)
    : [];
  const citationValidation = validateCitations(record, normalizedOutput.citedEvidence);
  const citationErrors = [...citationParseErrors, ...citationValidation.errors];
  const citationValid = citationErrors.length === 0 && citationValidation.valid;
  const requiredEvidenceStats = requiredEvidenceRecall(record, citationValidation.validCitations);
  const requiredEvidencePrecisionStats = requiredEvidencePrecision(record, citationValidation.validCitations);
  const citationGranularityMatched = requiredEvidenceStats.requiredTotal === 0
    ? true
    : requiredEvidenceStats.recall === 1;
  const primaryMetricName = primaryMetricNameFor(record);
  const primaryMetric = decisionCorrect && citationValid && requiredEvidenceStats.recall === 1 ? 1 : 0;

  return {
    decision,
    decisionCorrect,
    invalidDecision,
    citationValid,
    citationErrors,
    requiredEvidenceRecall: requiredEvidenceStats.recall,
    requiredEvidenceMatched: requiredEvidenceStats.matched,
    requiredEvidenceTotal: requiredEvidenceStats.requiredTotal,
    requiredEvidencePrecision: requiredEvidencePrecisionStats.precision,
    requiredEvidenceCitationMatched: requiredEvidencePrecisionStats.matched,
    citedEvidenceTotal: requiredEvidencePrecisionStats.citedTotal,
    citationGranularityMatched,
    primaryMetric,
    primaryMetricName,
  };
}

function validateCitations(record, citedEvidence) {
  const errors = [];
  const documents = documentIndex(record);
  if (!Array.isArray(citedEvidence) || citedEvidence.length === 0) {
    return { valid: false, errors: ["missing_citation"], validCitations: [] };
  }

  const validCitations = [];
  for (const [index, citation] of citedEvidence.entries()) {
    if (!citation || typeof citation !== "object") {
      errors.push(`citation_${index}_not_object`);
      continue;
    }
    if (typeof citation.documentId !== "string" || citation.documentId.length === 0) {
      errors.push(`citation_${index}_missing_documentId`);
      continue;
    }
    const document = documents.get(citation.documentId);
    if (!document) {
      errors.push(`citation_${index}_unknown_document`);
      continue;
    }
    if (typeof citation.segmentId !== "string" || citation.segmentId.length === 0) {
      errors.push(`citation_${index}_missing_segmentId`);
      continue;
    }
    if (!segmentExists(document, citation.segmentId)) {
      errors.push(`citation_${index}_unknown_segment`);
      continue;
    }
    validCitations.push({ documentId: citation.documentId, segmentId: citation.segmentId });
  }

  return {
    valid: errors.length === 0,
    errors,
    validCitations,
  };
}

function requiredEvidenceRecall(record, validCitations) {
  const requiredEvidence = Array.isArray(record.requiredEvidence) ? record.requiredEvidence : [];
  if (requiredEvidence.length === 0) {
    return { recall: null, matched: 0, requiredTotal: 0 };
  }

  const matched = requiredEvidence.filter((required) => evidenceSatisfied(required, validCitations)).length;
  return {
    recall: matched / requiredEvidence.length,
    matched,
    requiredTotal: requiredEvidence.length,
  };
}

function requiredEvidencePrecision(record, validCitations) {
  const requiredEvidence = Array.isArray(record.requiredEvidence) ? record.requiredEvidence : [];
  if (validCitations.length === 0) {
    return { precision: null, matched: 0, citedTotal: 0 };
  }

  const matched = validCitations.filter((citation) => (
    requiredEvidence.some((required) => evidenceSatisfied(required, [citation]))
  )).length;
  return {
    precision: matched / validCitations.length,
    matched,
    citedTotal: validCitations.length,
  };
}

function evidenceSatisfied(required, validCitations) {
  if (!required || typeof required.documentId !== "string") return false;
  if (!required.granularity || required.granularity === "segment") {
    return validCitations.some((citation) => (
      citation.documentId === required.documentId && citation.segmentId === required.segmentId
    ));
  }
  return false;
}

function primaryMetricNameFor(record) {
  if (record.source === "scifact") {
    return "scifact_decision_segment_recall";
  }
  if (record.source === "pubmedqa") return "pubmedqa_answer_abstract_recall";
  if (record.source === "nli4ct") return "nli4ct_statement_section_recall";
  return "source_specific_primary_metric";
}

function documentIndex(record) {
  return (record.documents || []).reduce((index, document) => {
    index.set(document.documentId, document);
    return index;
  }, new Map());
}

function segmentExists(document, segmentId) {
  return (document.segments || []).some((segment) => segment.segmentId === segmentId);
}

module.exports = {
  scoreV4Output,
};
