#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_OUT_MD = "results/edl-ablation-scifact-nli4ct-component-summary.md";
const DEFAULT_OUT_JSON = "results/edl-ablation-scifact-nli4ct-component-summary.json";

const SOURCES = Object.freeze([
  {
    key: "scifact",
    label: "SciFact",
    dataset: "src/data/react-clinical-source-v4-agree-scifact-135.jsonl",
    variants: [
      { key: "full", label: "Full EDL", dir: "results/edl-ablation-scifact135-full" },
      { key: "no_iterative", label: "w/o Iterative Seeking", dir: "results/edl-ablation-scifact135-no-iterative-seeking" },
      { key: "no_sufficiency", label: "w/o Sufficiency Assessment", dir: "results/edl-ablation-scifact135-no-sufficiency-assessment" },
      { key: "no_citation_validation", label: "w/o Citation Validation", dir: "results/edl-ablation-scifact135-no-citation-validation" },
    ],
  },
  {
    key: "nli4ct",
    label: "NLI4CT",
    dataset: "src/data/react-clinical-source-v4-nli4ct-fulltrial-rawline-audited-main.jsonl",
    variants: [
      { key: "full", label: "Full EDL", dir: "results/edl-ablation-nli4ct130-full" },
      { key: "no_iterative", label: "w/o Iterative Seeking", dir: "results/edl-ablation-nli4ct130-no-iterative-seeking" },
      { key: "no_sufficiency", label: "w/o Sufficiency Assessment", dir: "results/edl-ablation-nli4ct130-no-sufficiency-assessment" },
      { key: "no_citation_validation", label: "w/o Citation Validation", dir: "results/edl-ablation-nli4ct130-no-citation-validation" },
    ],
  },
]);

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const summary = analyzeComponentAblation();
    fs.mkdirSync(path.dirname(options.outJson), { recursive: true });
    fs.mkdirSync(path.dirname(options.outMd), { recursive: true });
    fs.writeFileSync(options.outJson, `${JSON.stringify(summary, null, 2)}\n`);
    fs.writeFileSync(options.outMd, buildMarkdown(summary));
    console.log(`Wrote EDL component ablation summary to ${options.outMd}`);
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  }
}

function parseArgs(argv) {
  const options = {
    outMd: DEFAULT_OUT_MD,
    outJson: DEFAULT_OUT_JSON,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out-md") options.outMd = requireValue(argv, index, arg);
    else if (arg === "--out-json") options.outJson = requireValue(argv, index, arg);
    else throw new Error(`Unknown argument: ${arg}`);
    index += 1;
  }
  return options;
}

function analyzeComponentAblation() {
  const sourceSummaries = {};
  for (const source of SOURCES) {
    const records = readJsonl(source.dataset);
    const recordIds = new Set(records.map((record) => record.id));
    const variants = {};
    for (const variant of source.variants) {
      const traces = readJsonl(path.join(variant.dir, "live-comparison-v4-traces.jsonl"));
      validateVariant({ source, variant, traces, recordIds });
      variants[variant.key] = {
        label: variant.label,
        dir: variant.dir,
        metrics: summarizeTraces(traces),
      };
    }
    sourceSummaries[source.key] = {
      label: source.label,
      dataset: source.dataset,
      records: records.length,
      variants,
    };
  }
  return {
    schemaVersion: "edl-component-ablation-scifact-nli4ct-v1",
    generatedAt: new Date().toISOString(),
    sources: sourceSummaries,
  };
}

function validateVariant(input) {
  if (input.traces.length !== input.recordIds.size) {
    throw new Error(`${input.source.key}:${input.variant.key} expected ${input.recordIds.size} traces, got ${input.traces.length}`);
  }
  for (const trace of input.traces) {
    if (trace.method !== "edl") throw new Error(`${input.source.key}:${input.variant.key} unexpected method: ${trace.method}`);
    if (!input.recordIds.has(trace.recordId)) throw new Error(`${input.source.key}:${input.variant.key} unknown record: ${trace.recordId}`);
    if (trace.requiredHumanReview === undefined || !trace.reviewRouting) {
      throw new Error(`${input.source.key}:${input.variant.key}:${trace.recordId} missing human-review routing`);
    }
    if ((trace.reviewReasons || []).includes("missing_required_evidence")) {
      throw new Error(`${input.source.key}:${input.variant.key}:${trace.recordId} has deprecated missing_required_evidence reason`);
    }
  }
}

function summarizeTraces(traces) {
  return {
    traces: traces.length,
    decisionAccuracy: average(traces.map((trace) => boolNumber(trace.scores && trace.scores.decisionCorrect))),
    primaryMetric: average(traces.map((trace) => numeric(trace.scores && trace.scores.primaryMetric))),
    requiredEvidenceRecall: averageNullable(traces.map((trace) => nullableNumber(trace.scores && trace.scores.requiredEvidenceRecall))),
    requiredEvidencePrecision: averageNullable(traces.map((trace) => nullableNumber(trace.scores && trace.scores.requiredEvidencePrecision))),
    searchRequiredEvidenceRecall: averageNullable(traces.map((trace) => nullableNumber(trace.scores && trace.scores.searchRequiredEvidenceRecall))),
    readRequiredEvidenceRecall: averageNullable(traces.map((trace) => nullableNumber(trace.scores && trace.scores.readRequiredEvidenceRecall))),
    citationValidity: average(traces.map((trace) => boolNumber(trace.scores && trace.scores.citationValid))),
    processValidity: average(traces.map((trace) => trace.processValid === false ? 0 : 1)),
    humanReviewRate: average(traces.map((trace) => trace.requiredHumanReview ? 1 : 0)),
    parseErrorRate: average(traces.map((trace) => trace.parseError ? 1 : 0)),
    reviewReasonCounts: countNested(traces.map((trace) => trace.reviewReasons || [])),
    evidenceFailureStages: countValues(traces.map((trace) => trace.scores && trace.scores.evidenceFailureStage).filter(Boolean)),
  };
}

function buildMarkdown(summary) {
  const lines = [
    "# EDL Component Ablation: SciFact + NLI4CT",
    "",
    "Generated from V4 live comparison trace files. This table uses the P1 shared EDL component ablation variants.",
    "",
  ];
  for (const source of Object.values(summary.sources)) {
    lines.push(`## ${source.label}`, "");
    lines.push(`Dataset: \`${source.dataset}\``);
    lines.push(`Records: ${source.records}`, "");
    lines.push("| Variant | Traces | Decision acc. | Primary metric | Evidence recall | Evidence precision | Search recall | Read recall | Citation validity | Human review | Parse error | Review reasons | Failure stages |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |");
    for (const variant of Object.values(source.variants)) {
      const m = variant.metrics;
      lines.push([
        `| ${variant.label}`,
        m.traces,
        fmt(m.decisionAccuracy),
        fmt(m.primaryMetric),
        fmt(m.requiredEvidenceRecall),
        fmt(m.requiredEvidencePrecision),
        fmt(m.searchRequiredEvidenceRecall),
        fmt(m.readRequiredEvidenceRecall),
        fmt(m.citationValidity),
        fmt(m.humanReviewRate),
        fmt(m.parseErrorRate),
        fmtCounts(m.reviewReasonCounts),
        `${fmtCounts(m.evidenceFailureStages)} |`,
      ].join(" | "));
    }
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

function requireValue(argv, index, arg) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
  return value;
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function average(values) {
  const numericValues = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (numericValues.length === 0) return null;
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function averageNullable(values) {
  return average(values.filter((value) => value !== null));
}

function boolNumber(value) {
  return value === true ? 1 : 0;
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function countNested(values) {
  const out = {};
  for (const group of values) {
    for (const value of group) out[value] = (out[value] || 0) + 1;
  }
  return sortObject(out);
}

function countValues(values) {
  return sortObject(values.reduce((acc, value) => ({ ...acc, [value]: (acc[value] || 0) + 1 }), {}));
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function fmt(value) {
  if (value === null || value === undefined) return "n/a";
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

function fmtCounts(counts) {
  const entries = Object.entries(counts || {});
  if (entries.length === 0) return "";
  return entries.map(([key, value]) => `${key}:${value}`).join(", ");
}

module.exports = {
  analyzeComponentAblation,
};
