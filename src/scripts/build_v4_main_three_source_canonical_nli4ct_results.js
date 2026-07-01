#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { runLiveComparisonV4 } = require("./run_live_comparison_v4");
const { deriveV4HumanReviewRouting } = require("./lib/v4_human_review_routing");

const repoRoot = path.resolve(__dirname, "..", "..");

const OLD_AGREE_DATASET = path.join(repoRoot, "src/data/react-clinical-source-v4-agree.jsonl");
const NLI4CT_CANONICAL_DATASET = path.join(
  repoRoot,
  "src/data/react-clinical-source-v4-nli4ct-fulltrial-rawline-audited-main.jsonl",
);
const OUTPUT_DATASET = path.join(
  repoRoot,
  "src/data/react-clinical-source-v4-main-three-source-canonical-nli4ct.jsonl",
);

const OLD_FROZEN_DIR = path.join(repoRoot, "results/live-comparison-v4-agree-default-frozen-evidence-full");
const OLD_EVIDENCE_SEEKING_DIR = path.join(
  repoRoot,
  "results/live-comparison-v4-agree-default-evidence-seeking-react-edl-bm25-topk5-full",
);
const NLI4CT_FROZEN_DIR = path.join(
  repoRoot,
  "results/live-comparison-v4-nli4ct-fulltrial-rawline-audited-main-frozen-evidence-full",
);
const NLI4CT_EVIDENCE_SEEKING_DIR = path.join(
  repoRoot,
  "results/live-comparison-v4-nli4ct-fulltrial-rawline-audited-main-evidence-seeking-react-forced-submit-edl-full",
);

const OUTPUT_FROZEN_DIR = path.join(
  repoRoot,
  "results/live-comparison-v4-main-three-source-canonical-nli4ct-frozen-evidence-full",
);
const OUTPUT_EVIDENCE_SEEKING_DIR = path.join(
  repoRoot,
  "results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full",
);
const OUTPUT_MANIFEST = path.join(
  repoRoot,
  "results/react-clinical-source-v4-main-three-source-canonical-nli4ct-manifest.json",
);
const OUTPUT_DUAL_SUMMARY = path.join(
  repoRoot,
  "results/live-comparison-v4-main-three-source-canonical-nli4ct-dual-setting-summary.md",
);

const FROZEN_METHODS = Object.freeze(["direct", "cot", "react", "edl"]);
const EVIDENCE_SEEKING_METHODS = Object.freeze(["react", "edl"]);

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

async function main() {
  const result = await buildMainThreeSourceCanonicalNli4ctResults();
  console.log(JSON.stringify({
    dataset: path.relative(repoRoot, OUTPUT_DATASET),
    frozen: path.relative(repoRoot, OUTPUT_FROZEN_DIR),
    evidenceSeeking: path.relative(repoRoot, OUTPUT_EVIDENCE_SEEKING_DIR),
    manifest: path.relative(repoRoot, OUTPUT_MANIFEST),
    dualSettingSummary: path.relative(repoRoot, OUTPUT_DUAL_SUMMARY),
    records: result.records.length,
    frozenTraces: result.frozenTraces,
    evidenceSeekingTraces: result.evidenceSeekingTraces,
  }, null, 2));
}

async function buildMainThreeSourceCanonicalNli4ctResults() {
  const oldAgreeRecords = readJsonl(OLD_AGREE_DATASET);
  const canonicalNli4ctRecords = readJsonl(NLI4CT_CANONICAL_DATASET);
  const nonNli4ctRecords = oldAgreeRecords.filter((record) => record.source !== "nli4ct");
  const records = [...nonNli4ctRecords, ...canonicalNli4ctRecords];
  validateUniqueRecordIds(records);
  writeJsonl(OUTPUT_DATASET, records);

  const frozenTraces = writeCombinedTraces({
    oldDir: OLD_FROZEN_DIR,
    canonicalNli4ctDir: NLI4CT_FROZEN_DIR,
    outDir: OUTPUT_FROZEN_DIR,
    records,
    methods: FROZEN_METHODS,
    setting: "frozen-evidence",
  });
  const evidenceSeekingTraces = writeCombinedTraces({
    oldDir: OLD_EVIDENCE_SEEKING_DIR,
    canonicalNli4ctDir: NLI4CT_EVIDENCE_SEEKING_DIR,
    outDir: OUTPUT_EVIDENCE_SEEKING_DIR,
    records,
    methods: EVIDENCE_SEEKING_METHODS,
    setting: "evidence-seeking",
  });

  const frozenSummary = await summarizeResumeOnlyRun({
    outDir: OUTPUT_FROZEN_DIR,
    records,
    methods: FROZEN_METHODS,
    setting: "frozen-evidence",
  });
  const evidenceSeekingSummary = await summarizeResumeOnlyRun({
    outDir: OUTPUT_EVIDENCE_SEEKING_DIR,
    records,
    methods: EVIDENCE_SEEKING_METHODS,
    setting: "evidence-seeking",
  });

  const manifest = buildManifest({
    records,
    oldAgreeRecords,
    nonNli4ctRecords,
    canonicalNli4ctRecords,
    frozenTraces,
    evidenceSeekingTraces,
    frozenSummary,
    evidenceSeekingSummary,
  });
  fs.writeFileSync(OUTPUT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_DUAL_SUMMARY, buildDualSettingSummary(frozenSummary, evidenceSeekingSummary));

  return {
    records,
    frozenTraces,
    evidenceSeekingTraces,
    frozenSummary,
    evidenceSeekingSummary,
  };
}

function writeCombinedTraces(input) {
  const oldTracePath = path.join(input.oldDir, "live-comparison-v4-traces.jsonl");
  const canonicalNli4ctTracePath = path.join(input.canonicalNli4ctDir, "live-comparison-v4-traces.jsonl");
  const recordsById = new Map(input.records.map((record) => [record.id, record]));
  const oldTraces = readJsonl(oldTracePath).filter((trace) => trace.source !== "nli4ct");
  const canonicalNli4ctTraces = readJsonl(canonicalNli4ctTracePath).filter((trace) => trace.source === "nli4ct");
  const traces = sortTracesByRecordAndMethod(
    [...oldTraces, ...canonicalNli4ctTraces].map((trace) => normalizeTraceReviewRouting(trace, recordsById)),
    input.records,
    input.methods,
  );

  validateTraceSet({
    traces,
    records: input.records,
    methods: input.methods,
    setting: input.setting,
  });

  fs.mkdirSync(input.outDir, { recursive: true });
  writeJsonl(path.join(input.outDir, "live-comparison-v4-traces.jsonl"), traces);
  return traces.length;
}

function normalizeTraceReviewRouting(trace, recordsById) {
  const record = recordsById.get(trace.recordId) || {};
  const routing = deriveV4HumanReviewRouting({
    record,
    output: trace.output,
    scores: trace.scores,
    controllerResult: { assessment: findLastAssessment(trace) },
    traceMeta: {
      parseError: trace.parseError,
      toolError: trace.toolError,
      modelError: trace.modelError,
    },
  });
  return {
    ...trace,
    ...routing,
  };
}

function findLastAssessment(trace) {
  const steps = Array.isArray(trace && trace.steps) ? trace.steps : [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step && step.action === "assess_evidence") return step.input || {};
  }
  return {};
}

async function summarizeResumeOnlyRun(input) {
  const noModelCallsProvider = {
    responses: {
      create: async () => {
        throw new Error("unexpected model call while summarizing precomputed traces");
      },
    },
  };
  return runLiveComparisonV4({
    datasetPath: OUTPUT_DATASET,
    outDir: input.outDir,
    records: input.records,
    methods: input.methods,
    setting: input.setting,
    provider: noModelCallsProvider,
    modelName: "gpt-5.5",
    resume: true,
  });
}

function buildManifest(input) {
  return {
    schemaVersion: "react-clinical-source-v4-main-three-source-canonical-nli4ct-manifest",
    outputDataset: path.relative(repoRoot, OUTPUT_DATASET),
    outputFrozenDir: path.relative(repoRoot, OUTPUT_FROZEN_DIR),
    outputEvidenceSeekingDir: path.relative(repoRoot, OUTPUT_EVIDENCE_SEEKING_DIR),
    sourceDatasets: {
      oldAgreeDataset: path.relative(repoRoot, OLD_AGREE_DATASET),
      canonicalNli4ctDataset: path.relative(repoRoot, NLI4CT_CANONICAL_DATASET),
    },
    sourceResultDirs: {
      oldFrozenDir: path.relative(repoRoot, OLD_FROZEN_DIR),
      oldEvidenceSeekingDir: path.relative(repoRoot, OLD_EVIDENCE_SEEKING_DIR),
      canonicalNli4ctFrozenDir: path.relative(repoRoot, NLI4CT_FROZEN_DIR),
      canonicalNli4ctEvidenceSeekingDir: path.relative(repoRoot, NLI4CT_EVIDENCE_SEEKING_DIR),
    },
    selectionRule: "Use SciFact and PubMedQA records/traces from the V4 agree main run; replace the NLI4CT arm with canonical full-trial raw-line audited-main records/traces.",
    records: input.records.length,
    oldAgreeRecords: input.oldAgreeRecords.length,
    retainedOldNonNli4ctRecords: input.nonNli4ctRecords.length,
    canonicalNli4ctRecords: input.canonicalNli4ctRecords.length,
    bySource: countBy(input.records.map((record) => record.source)),
    byGoldDecision: countBy(input.records.map((record) => `${record.source}:${record.goldDecision}`)),
    requiredEvidenceCountDistribution: countBy(input.records.map((record) => String((record.requiredEvidence || []).length))),
    frozenTraces: input.frozenTraces,
    evidenceSeekingTraces: input.evidenceSeekingTraces,
    frozenResultPath: input.frozenSummary.resultPath,
    evidenceSeekingResultPath: input.evidenceSeekingSummary.resultPath,
  };
}

function buildDualSettingSummary(frozenSummary, evidenceSeekingSummary) {
  const lines = [
    "# V4 Main Three-Source Canonical NLI4CT Summary",
    "",
    "This summary reports the canonical three-source main evaluation:",
    "",
    "- SciFact and PubMedQA records/traces are retained from the V4 agree main run.",
    "- NLI4CT is represented by the full-trial raw-line audited-main arm.",
    "- No model calls are made by this combiner; it filters archived traces and recomputes metrics.",
    "",
    `Dataset: \`${path.relative(repoRoot, OUTPUT_DATASET)}\``,
    `Manifest: \`${path.relative(repoRoot, OUTPUT_MANIFEST)}\``,
    "",
    "## Frozen Evidence",
    "",
    `Result directory: \`${path.relative(repoRoot, OUTPUT_FROZEN_DIR)}\``,
    "",
    markdownTable(frozenSummary, ["Method", "Traces", "Decision Acc.", "Citation Validity", "Evidence Recall", "Evidence Precision", "Primary Metric", "Human Review", "Invalid Decision"], (method, metrics) => [
      method,
      metrics.traces,
      metrics.decisionAccuracy,
      metrics.citationValidity,
      metrics.requiredEvidenceRecall,
      metrics.requiredEvidencePrecision,
      metrics.primaryMetric,
      metrics.humanReviewRate,
      metrics.invalidDecisionRate,
    ]),
    "",
    "## Evidence Seeking",
    "",
    `Result directory: \`${path.relative(repoRoot, OUTPUT_EVIDENCE_SEEKING_DIR)}\``,
    "",
    markdownTable(evidenceSeekingSummary, ["Method", "Traces", "Decision Acc.", "Citation Validity", "Search Recall", "Read Recall", "Final Recall", "Final Precision", "Primary Metric", "Human Review", "Invalid Decision"], (method, metrics) => [
      method,
      metrics.traces,
      metrics.decisionAccuracy,
      metrics.citationValidity,
      metrics.searchRequiredEvidenceRecall,
      metrics.readRequiredEvidenceRecall,
      metrics.requiredEvidenceRecall,
      metrics.requiredEvidencePrecision,
      metrics.primaryMetric,
      metrics.humanReviewRate,
      metrics.invalidDecisionRate,
    ]),
    "",
  ];
  return lines.join("\n");
}

function markdownTable(summary, headers, rowFor) {
  const alignment = headers.map((header, index) => index === 0 ? "---" : "---:");
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${alignment.join(" | ")} |`,
  ];
  for (const method of summary.methodSelection) {
    const values = rowFor(method, summary.methods[method]).map((value, index) => (
      index === 0 ? String(value) : fmt(value)
    ));
    lines.push(`| ${values.join(" | ")} |`);
  }
  return lines.join("\n");
}

function sortTracesByRecordAndMethod(traces, records, methods) {
  const recordOrder = new Map(records.map((record, index) => [record.id, index]));
  const methodOrder = new Map(methods.map((method, index) => [method, index]));
  return traces.toSorted((left, right) => {
    const recordDelta = (recordOrder.get(left.recordId) ?? Number.MAX_SAFE_INTEGER)
      - (recordOrder.get(right.recordId) ?? Number.MAX_SAFE_INTEGER);
    if (recordDelta !== 0) return recordDelta;
    return (methodOrder.get(left.method) ?? Number.MAX_SAFE_INTEGER)
      - (methodOrder.get(right.method) ?? Number.MAX_SAFE_INTEGER);
  });
}

function validateTraceSet(input) {
  const recordIds = new Set(input.records.map((record) => record.id));
  const methodSet = new Set(input.methods);
  const expectedTraceCount = input.records.length * input.methods.length;
  if (input.traces.length !== expectedTraceCount) {
    throw new Error(`expected ${expectedTraceCount} ${input.setting} traces, got ${input.traces.length}`);
  }

  const keys = new Set();
  for (const trace of input.traces) {
    if (!recordIds.has(trace.recordId)) {
      throw new Error(`${input.setting} trace references unknown record: ${trace.recordId}`);
    }
    if (!methodSet.has(trace.method)) {
      throw new Error(`${input.setting} trace has unexpected method: ${trace.method}`);
    }
    if (trace.setting !== input.setting) {
      throw new Error(`${trace.recordId}:${trace.method} setting mismatch: ${trace.setting}`);
    }
    const key = `${trace.recordId}\t${trace.method}`;
    if (keys.has(key)) throw new Error(`${input.setting} duplicate trace: ${key}`);
    keys.add(key);
  }

  for (const record of input.records) {
    for (const method of input.methods) {
      const key = `${record.id}\t${method}`;
      if (!keys.has(key)) throw new Error(`${input.setting} missing trace: ${key}`);
    }
  }
}

function validateUniqueRecordIds(records) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.id)) throw new Error(`duplicate record id: ${record.id}`);
    seen.add(record.id);
  }
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function writeJsonl(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function countBy(values) {
  return values.reduce((acc, value) => ({
    ...acc,
    [value]: (acc[value] || 0) + 1,
  }), {});
}

function fmt(value) {
  if (value === null || value === undefined) return "n/a";
  if (typeof value !== "number") return String(value);
  return value.toFixed(3);
}

module.exports = {
  buildMainThreeSourceCanonicalNli4ctResults,
};
