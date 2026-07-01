"use strict";

const DEFAULT_STUDY_DIR = "results/human-audit-scifact-nli4ct-balanced";
const DEFAULT_TRACE_PATH =
  "results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/live-comparison-v4-traces.jsonl";
const DEFAULT_SOURCE_RECORD_PATH = "src/data/react-clinical-source-v4-main-three-source-canonical-nli4ct.jsonl";

const SCHEMA_VERSION = "human-audit-v1";
const RESPONSE_SCHEMA_VERSION = "human-audit-response-v1";
const DEFAULT_SEED = "eviagent-human-audit-scifact-nli4ct-balanced-v1";
const DEFAULT_SOURCE_FILTERS = Object.freeze(["scifact", "nli4ct"]);
const DEFAULT_SOURCE_TARGETS = Object.freeze([
  Object.freeze({ source: "scifact", correctTarget: 15, errorTarget: 15 }),
  Object.freeze({ source: "nli4ct", correctTarget: 15, errorTarget: 15 }),
]);
const DEFAULT_RATER_IDS = Object.freeze([
  "RATER_A",
  "RATER_B",
  "RATER_C",
  "RATER_D",
  "RATER_E",
  "RATER_F",
  "RATER_G",
  "RATER_H",
]);
const DEFAULT_RATERS_PER_FORMAT_PER_CASE = 4;

const METHODS = Object.freeze({
  react: "react",
  edl: "edl",
});

const FORMAT_LABEL_BY_METHOD = Object.freeze({
  react: "X",
  edl: "Y",
});

const ACCEPTABILITY_VALUES = Object.freeze(["accept", "intercept", "return"]);

module.exports = {
  ACCEPTABILITY_VALUES,
  DEFAULT_SEED,
  DEFAULT_RATERS_PER_FORMAT_PER_CASE,
  DEFAULT_RATER_IDS,
  DEFAULT_SOURCE_RECORD_PATH,
  DEFAULT_SOURCE_FILTERS,
  DEFAULT_SOURCE_TARGETS,
  DEFAULT_STUDY_DIR,
  DEFAULT_TRACE_PATH,
  FORMAT_LABEL_BY_METHOD,
  METHODS,
  RESPONSE_SCHEMA_VERSION,
  SCHEMA_VERSION,
};
