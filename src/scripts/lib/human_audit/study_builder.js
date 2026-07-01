"use strict";

const crypto = require("crypto");
const path = require("path");
const {
  DEFAULT_RATERS_PER_FORMAT_PER_CASE,
  DEFAULT_RATER_IDS,
  DEFAULT_SEED,
  DEFAULT_SOURCE_TARGETS,
  FORMAT_LABEL_BY_METHOD,
  SCHEMA_VERSION,
} = require("./constants");
const { ensureDir, readJsonl, touchFile, writeJsonAtomic } = require("./io");
const { shuffleStable } = require("./random");
const { buildAllRatersBalancedAssignments } = require("./assignment_builder");
const { formatStimulusReport } = require("./stimulus_formatter");

function buildStudyBundle(options) {
  const seed = options.seed || DEFAULT_SEED;
  const createdAt = options.createdAt || new Date().toISOString();
  const raterIds = options.raterIds || DEFAULT_RATER_IDS.slice();
  const sourceFilters = normalizeSourceFilters(options.sourceFilters);
  const recordsById = new Map(options.records.map((record) => [record.id, record]));
  const pairs = filterPairsBySource(buildTracePairs(options.traces, recordsById), sourceFilters);
  const sourceTargets = options.sourceTargets || DEFAULT_SOURCE_TARGETS.map((target) => ({ ...target }));
  const sampledCases = sampleCasesBySourceTargets({ pairs, seed, sourceTargets });
  const mainStimuli = sampledCases.flatMap((pair) => buildStimuliForPair(pair, "main"));
  const stimuli = mainStimuli;
  const ratersPerFormatPerCase = options.ratersPerFormatPerCase || DEFAULT_RATERS_PER_FORMAT_PER_CASE;
  const assignments = buildAllRatersBalancedAssignments({
    stimuli: mainStimuli,
    raterIds,
    seed,
    ratersPerFormatPerCase,
  });
  const study = {
    schemaVersion: SCHEMA_VERSION,
    createdAt,
    seed,
    sampleSize: sampledCases.length,
    calibrationSize: 0,
    raterCount: raterIds.length,
    assignmentMode: "all_raters_balanced",
    ratersPerFormatPerCase,
    sourceTargets,
    sourceRecordPath: options.sourceRecordPath || null,
    tracePath: options.tracePath || null,
    sourceFilters,
    caseIds: sampledCases.map((pair) => pair.record.id),
    calibrationCaseIds: [],
  };
  return {
    study,
    stimuli,
    assignments,
    raters: buildRaters(raterIds, seed),
    admin: { adminToken: tokenFor(`${seed}:ADMIN`) },
  };
}

function buildTracePairs(traces, recordsById) {
  const byRecord = new Map();
  for (const trace of traces) {
    if (trace.method !== "react" && trace.method !== "edl") continue;
    if (!byRecord.has(trace.recordId)) byRecord.set(trace.recordId, {});
    byRecord.get(trace.recordId)[trace.method] = trace;
  }
  const pairs = [];
  for (const [recordId, pair] of byRecord) {
    const record = recordsById.get(recordId);
    if (!record || !pair.react || !pair.edl) continue;
    pairs.push({ record, react: pair.react, edl: pair.edl, correctnessClass: classifyPair(pair.react, pair.edl) });
  }
  return pairs;
}

function classifyPair(reactTrace, edlTrace) {
  const reactSafe = Boolean(reactTrace.scores && reactTrace.scores.decisionCorrect && reactTrace.scores.primaryMetric === 1);
  const edlSafe = Boolean(edlTrace.scores && edlTrace.scores.decisionCorrect && edlTrace.scores.primaryMetric === 1);
  if (reactSafe && edlSafe) return "safe_correct";
  return "trap_error";
}

function sampleCasesBySourceTargets({ pairs, seed, sourceTargets }) {
  const selected = [];
  for (const target of sourceTargets) {
    const source = String(target.source || "").toLowerCase();
    const sourcePairs = pairs.filter((pair) => String(pair.record.source || "").toLowerCase() === source);
    const correctTarget = Number(target.correctTarget || target.safeTarget || 0);
    const errorTarget = Number(target.errorTarget || target.trapTarget || 0);
    const correct = selectStratifiedByKey(
      sourcePairs.filter((pair) => pair.correctnessClass === "safe_correct"),
      correctTarget,
      `${seed}:${source}:correct`,
      stratificationKey
    );
    const error = selectStratifiedByKey(
      sourcePairs.filter((pair) => pair.correctnessClass === "trap_error"),
      errorTarget,
      `${seed}:${source}:error`,
      trapStratificationKey
    );
    if (correct.length < correctTarget || error.length < errorTarget) {
      throw new Error(
        `Insufficient ${source} candidates: safe ${correct.length}/${correctTarget}, trap ${error.length}/${errorTarget}`
      );
    }
    selected.push(...correct, ...error);
  }
  return shuffleStable(selected, `${seed}:source-targets-final`);
}

function normalizeSourceFilters(sourceFilters) {
  if (sourceFilters == null) return null;
  const normalized = sourceFilters.map((source) => String(source).trim().toLowerCase()).filter(Boolean);
  return normalized.length === 0 ? null : Array.from(new Set(normalized)).sort();
}

function filterPairsBySource(pairs, sourceFilters) {
  if (!sourceFilters) return pairs;
  const allowed = new Set(sourceFilters);
  return pairs.filter((pair) => allowed.has(String(pair.record.source || "").toLowerCase()));
}

function selectStratifiedByKey(pairs, target, seed, keyFn) {
  if (target <= 0) return [];
  const byKey = groupBy(pairs, keyFn);
  const keys = Object.keys(byKey).sort();
  const buckets = new Map(keys.map((key) => [key, shuffleStable(byKey[key], `${seed}:${key}`)]));
  const selected = [];
  let cursor = 0;
  while (selected.length < target && Array.from(buckets.values()).some((bucket) => bucket.length > 0)) {
    const key = keys[cursor % keys.length];
    const bucket = buckets.get(key);
    if (bucket.length > 0) selected.push(bucket.shift());
    cursor += 1;
  }
  return selected;
}

function stratificationKey(pair) {
  return [
    pair.record.goldDecision || "unknown_label",
    evidenceComplexityBin(pair.record),
  ].join("|");
}

function trapStratificationKey(pair) {
  return [
    stratificationKey(pair),
    failurePattern(pair),
  ].join("|");
}

function evidenceComplexityBin(record) {
  const count = Array.isArray(record.requiredEvidence) ? record.requiredEvidence.length : 0;
  if (count <= 1) return "1";
  if (count === 2) return "2";
  if (count <= 5) return "3-5";
  return "6+";
}

function failurePattern(pair) {
  const reactSafe = traceSafe(pair.react);
  const edlSafe = traceSafe(pair.edl);
  if (!reactSafe && !edlSafe) return "both_trap";
  if (!reactSafe) return "react_trap";
  if (!edlSafe) return "edl_trap";
  return "none";
}

function traceSafe(trace) {
  return Boolean(trace.scores && trace.scores.decisionCorrect && trace.scores.primaryMetric === 1);
}

function buildStimuliForPair(pair, phase) {
  return ["react", "edl"].map((method) => buildStimulusForPair(pair, method, phase, "stim"));
}

function buildStimulusForPair(pair, method, phase, prefix) {
    const trace = pair[method];
    const formatLabel = FORMAT_LABEL_BY_METHOD[method];
    return {
      stimulusId: `${prefix}_${pair.record.id}_${formatLabel.toLowerCase()}`,
      caseId: pair.record.id,
      phase,
      source: pair.record.source,
      formatLabel,
      hiddenMethod: method,
      correctnessClass: pair.correctnessClass,
      goldDecision: pair.record.goldDecision,
      systemDecision: trace.output && trace.output.decision,
      primaryMetric: trace.scores && trace.scores.primaryMetric,
      decisionCorrect: trace.scores && trace.scores.decisionCorrect,
      failureStage: trace.processScores && trace.processScores.evidenceFailureStage ? trace.processScores.evidenceFailureStage : "unknown",
      taskText: pair.record.task && pair.record.task.input ? pair.record.task.input : "",
      allowedDecisions: pair.record.allowedDecisions || [],
      referenceEvidence: referenceEvidence(pair.record),
      reportText: formatStimulusReport(trace, formatLabel),
    };
}

function referenceEvidence(record) {
  const segments = new Map();
  for (const document of record.documents || []) {
    for (const segment of document.segments || []) {
      segments.set(`${document.documentId}:${segment.segmentId}`, segment.text);
    }
  }
  return (record.requiredEvidence || []).map((item) => ({
    documentId: item.documentId,
    segmentId: item.segmentId,
    text: segments.get(`${item.documentId}:${item.segmentId}`) || "",
  }));
}

function buildRaters(raterIds, seed) {
  return raterIds.map((raterId) => ({ raterId, token: tokenFor(`${seed}:${raterId}`) }));
}

function tokenFor(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function writeStudyBundle(outDir, bundle) {
  ensureDir(outDir);
  ensureDir(path.join(outDir, "private"));
  writeJsonAtomic(path.join(outDir, "study.json"), bundle.study);
  writeJsonAtomic(path.join(outDir, "stimuli.json"), bundle.stimuli);
  writeJsonAtomic(path.join(outDir, "assignments.json"), bundle.assignments);
  writeJsonAtomic(path.join(outDir, "private", "raters.json"), bundle.raters);
  writeJsonAtomic(path.join(outDir, "private", "admin.json"), bundle.admin);
  touchFile(path.join(outDir, "private", "responses.jsonl"));
  touchFile(path.join(outDir, "private", "events.jsonl"));
}

function buildStudyBundleFromFiles(options) {
  const records = readJsonl(options.sourceRecordPath);
  const traces = readJsonl(options.tracePath);
  return buildStudyBundle({ ...options, records, traces });
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

module.exports = {
  buildStudyBundle,
  buildStudyBundleFromFiles,
  buildTracePairs,
  classifyPair,
  filterPairsBySource,
  sampleCasesBySourceTargets,
  writeStudyBundle,
};
