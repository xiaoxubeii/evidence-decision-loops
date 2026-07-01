#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { runLiveComparisonV4 } = require("./run_live_comparison_v4");
const { deriveV4HumanReviewRouting } = require("./lib/v4_human_review_routing");

const repoRoot = path.resolve(__dirname, "..", "..");

const DATASET = path.join(repoRoot, "src/data/react-clinical-source-v4-main-three-source-canonical-nli4ct.jsonl");

const OLD_MINIMAX_FROZEN_DIR = path.join(repoRoot, "results/live-comparison-v4-agree-minimax-m3-default-frozen-evidence-full");
const NEW_MINIMAX_FROZEN_NLI4CT_DIR = path.join(
  repoRoot,
  "results/live-comparison-v4-minimax-m3-canonical-nli4ct-frozen-nli4ct-direct-cot-react-edl-full",
);
const NEW_MINIMAX_FROZEN_NON_NLI4CT_DIR = path.join(
  repoRoot,
  "results/live-comparison-v4-minimax-m3-canonical-nli4ct-frozen-non-nli4ct-react-edl-full",
);
const NEW_MINIMAX_EVIDENCE_NON_NLI4CT_DIR = path.join(
  repoRoot,
  "results/live-comparison-v4-minimax-m3-canonical-nli4ct-evidence-seeking-non-nli4ct-react-edl-full",
);
const NEW_MINIMAX_EVIDENCE_NLI4CT_DIR = path.join(
  repoRoot,
  "results/live-comparison-v4-minimax-m3-canonical-nli4ct-evidence-seeking-nli4ct-react-edl-full",
);

const OUTPUT_FROZEN_DIR = path.join(
  repoRoot,
  "results/live-comparison-v4-minimax-m3-canonical-nli4ct-frozen-evidence-full",
);
const OUTPUT_EVIDENCE_DIR = path.join(
  repoRoot,
  "results/live-comparison-v4-minimax-m3-canonical-nli4ct-evidence-seeking-react-edl-full",
);
const OUTPUT_SUMMARY_MD = path.join(repoRoot, "results/live-comparison-v4-minimax-m3-canonical-nli4ct-dual-setting-summary.md");
const OUTPUT_SUMMARY_JSON = path.join(repoRoot, "results/live-comparison-v4-minimax-m3-canonical-nli4ct-dual-setting-summary.json");

const FROZEN_METHODS = Object.freeze(["direct", "cot", "react", "edl"]);
const EVIDENCE_METHODS = Object.freeze(["react", "edl"]);

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
}

async function main() {
  const result = await buildMinimaxCanonicalNli4ctResults();
  console.log(JSON.stringify({
    dataset: path.relative(repoRoot, DATASET),
    frozenDir: path.relative(repoRoot, OUTPUT_FROZEN_DIR),
    evidenceDir: path.relative(repoRoot, OUTPUT_EVIDENCE_DIR),
    frozenTraces: result.frozenTraces.length,
    evidenceTraces: result.evidenceTraces.length,
    summaryMd: path.relative(repoRoot, OUTPUT_SUMMARY_MD),
    summaryJson: path.relative(repoRoot, OUTPUT_SUMMARY_JSON),
  }, null, 2));
}

async function buildMinimaxCanonicalNli4ctResults() {
  const records = readJsonl(DATASET);
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const frozenTraces = sortTracesByRecordAndMethod([
    ...readRunTraces(OLD_MINIMAX_FROZEN_DIR).filter((trace) => trace.source !== "nli4ct" && ["direct", "cot"].includes(trace.method)),
    ...readRunTraces(NEW_MINIMAX_FROZEN_NON_NLI4CT_DIR).filter((trace) => trace.source !== "nli4ct" && ["react", "edl"].includes(trace.method)),
    ...readRunTraces(NEW_MINIMAX_FROZEN_NLI4CT_DIR).filter((trace) => trace.source === "nli4ct"),
  ].map((trace) => normalizeTraceReviewRouting(trace, recordsById)), records, FROZEN_METHODS);

  const evidenceTraces = sortTracesByRecordAndMethod([
    ...readRunTraces(NEW_MINIMAX_EVIDENCE_NON_NLI4CT_DIR).filter((trace) => trace.source !== "nli4ct"),
    ...readRunTraces(NEW_MINIMAX_EVIDENCE_NLI4CT_DIR).filter((trace) => trace.source === "nli4ct"),
  ].map((trace) => normalizeTraceReviewRouting(trace, recordsById)), records, EVIDENCE_METHODS);

  validateTraceSet({ traces: frozenTraces, records, methods: FROZEN_METHODS, setting: "frozen-evidence" });
  validateTraceSet({ traces: evidenceTraces, records, methods: EVIDENCE_METHODS, setting: "evidence-seeking" });

  fs.mkdirSync(OUTPUT_FROZEN_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_EVIDENCE_DIR, { recursive: true });
  writeJsonl(path.join(OUTPUT_FROZEN_DIR, "live-comparison-v4-traces.jsonl"), frozenTraces);
  writeJsonl(path.join(OUTPUT_EVIDENCE_DIR, "live-comparison-v4-traces.jsonl"), evidenceTraces);

  const frozenSummary = await summarizeResumeOnlyRun({
    datasetPath: DATASET,
    outDir: OUTPUT_FROZEN_DIR,
    records,
    methods: FROZEN_METHODS,
    setting: "frozen-evidence",
  });
  const evidenceSummary = await summarizeResumeOnlyRun({
    datasetPath: DATASET,
    outDir: OUTPUT_EVIDENCE_DIR,
    records,
    methods: EVIDENCE_METHODS,
    setting: "evidence-seeking",
  });

  const jsonSummary = buildJsonSummary({ frozenSummary, evidenceSummary });
  fs.writeFileSync(OUTPUT_SUMMARY_JSON, `${JSON.stringify(jsonSummary, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_SUMMARY_MD, buildMarkdownSummary(jsonSummary));
  return { frozenTraces, evidenceTraces, frozenSummary, evidenceSummary };
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
    datasetPath: input.datasetPath,
    outDir: input.outDir,
    records: input.records,
    methods: input.methods,
    setting: input.setting,
    provider: noModelCallsProvider,
    modelName: "MiniMax-M3",
    reasoningEffort: "medium",
    resume: true,
  });
}

function buildJsonSummary(input) {
  return {
    schemaVersion: "minimax-m3-canonical-nli4ct-dual-setting-summary-v1",
    dataset: path.relative(repoRoot, DATASET),
    frozenDir: path.relative(repoRoot, OUTPUT_FROZEN_DIR),
    evidenceDir: path.relative(repoRoot, OUTPUT_EVIDENCE_DIR),
    frozen: input.frozenSummary,
    evidenceSeeking: input.evidenceSummary,
  };
}

function buildMarkdownSummary(summary) {
  const lines = [
    "# MiniMax-M3 Canonical NLI4CT Dual-Setting Summary",
    "",
    `Dataset: \`${summary.dataset}\``,
    "",
    "## Frozen Evidence",
    "",
    `Result directory: \`${summary.frozenDir}\``,
    "",
    markdownTable(summary.frozen, ["Method", "Traces", "Decision Acc.", "Citation Validity", "Evidence Recall", "Evidence Precision", "Primary Metric", "Human Review", "Invalid Decision"], (method, metrics) => [
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
    `Result directory: \`${summary.evidenceDir}\``,
    "",
    markdownTable(summary.evidenceSeeking, ["Method", "Traces", "Decision Acc.", "Citation Validity", "Search Recall", "Read Recall", "Final Recall", "Final Precision", "Primary Metric", "Human Review", "Invalid Decision"], (method, metrics) => [
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
  for (const method of summary.methodSelection || Object.keys(summary.methods || {})) {
    const values = rowFor(method, summary.methods[method]).map((value, index) => (
      index === 0 ? String(value) : fmt(value)
    ));
    lines.push(`| ${values.join(" | ")} |`);
  }
  return lines.join("\n");
}

function readRunTraces(runDir) {
  return readJsonl(path.join(runDir, "live-comparison-v4-traces.jsonl"));
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

function validateTraceSet(input) {
  const expected = input.records.length * input.methods.length;
  if (input.traces.length !== expected) throw new Error(`expected ${expected} ${input.setting} traces, got ${input.traces.length}`);
  const recordIds = new Set(input.records.map((record) => record.id));
  const methodSet = new Set(input.methods);
  const keys = new Set();
  for (const trace of input.traces) {
    if (!recordIds.has(trace.recordId)) throw new Error(`${input.setting} trace references unknown record: ${trace.recordId}`);
    if (!methodSet.has(trace.method)) throw new Error(`${input.setting} trace has unexpected method: ${trace.method}`);
    if (trace.setting !== input.setting) throw new Error(`${trace.recordId}:${trace.method} setting mismatch: ${trace.setting}`);
    const key = `${trace.recordId}\t${trace.method}`;
    if (keys.has(key)) throw new Error(`${input.setting} duplicate trace: ${key}`);
    keys.add(key);
  }
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

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function writeJsonl(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function fmt(value) {
  if (value === null || value === undefined) return "n/a";
  if (typeof value !== "number") return String(value);
  return value.toFixed(3);
}

module.exports = {
  buildMinimaxCanonicalNli4ctResults,
};
