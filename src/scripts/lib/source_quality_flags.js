#!/usr/bin/env node
"use strict";

const riskFlagRegistry = Object.freeze({
  claim_evidence_entity_mismatch: Object.freeze({
    definition: "Claim entities are not materially covered by the frozen gold evidence excerpt.",
    stress: true,
    relabelsGold: true,
  }),
  gold_relabeled_to_insufficient_evidence: Object.freeze({
    definition: "Source-derived gold label was downgraded because frozen evidence cannot support the original label.",
    stress: true,
    relabelsGold: true,
  }),
  expected_human_review: Object.freeze({
    definition: "Record is expected to require human review under the process policy.",
    stress: true,
    relabelsGold: false,
  }),
  low_claim_evidence_coverage: Object.freeze({
    definition: "Token overlap between claim/question and selected gold evidence is below the coverage threshold.",
    stress: true,
    relabelsGold: false,
  }),
  source_label_semantic_compression: Object.freeze({
    definition: "Source label compresses richer semantics into the benchmark decision label.",
    stress: false,
    relabelsGold: false,
  }),
  question_polarity_sensitive: Object.freeze({
    definition: "Question wording contains negation or polarity terms that can invert yes/no mapping direction.",
    stress: true,
    relabelsGold: false,
  }),
});

const registeredRiskFlags = Object.freeze(Object.keys(riskFlagRegistry));

function riskFlagDefinitions() {
  return registeredRiskFlags.map((flag) => ({
    flag,
    ...riskFlagRegistry[flag],
  }));
}

function assertRegisteredRiskFlags(flags, context = "risk flags") {
  for (const flag of flags || []) {
    if (!riskFlagRegistry[flag]) throw new Error(`${context}: unregistered risk flag ${flag}`);
  }
}

function isStressRiskFlag(flag) {
  return Boolean(riskFlagRegistry[flag]?.stress);
}

module.exports = {
  riskFlagRegistry,
  registeredRiskFlags,
  riskFlagDefinitions,
  assertRegisteredRiskFlags,
  isStressRiskFlag,
};
