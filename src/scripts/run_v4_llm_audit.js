#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { resolveOpenAiApiKey } = require("./lib/openai_api_key");

const repoRoot = path.resolve(__dirname, "..", "..");
const DEFAULT_DATASET = path.join(repoRoot, "src/data/react-clinical-source-v4.jsonl");
const DEFAULT_OUT_DIR = path.join(repoRoot, "src/results/v4-llm-audit");
const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_REASONING_EFFORT = "medium";

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await runV4LlmAudit({
    datasetPath: options.dataset,
    outDir: options.outDir,
    check: Boolean(options.check),
    modelName: options.check ? "fake-v4-audit-check-model" : (options.model || DEFAULT_MODEL),
    reasoningEffort: options.reasoningEffort || DEFAULT_REASONING_EFFORT,
    samplePerSource: options.samplePerSource,
    stratifiedPerLabel: options.stratifiedPerLabel,
    limit: options.limit,
    inputReviewQueue: options.inputReviewQueue,
    provider: options.check ? fakeCheckProvider : undefined,
    timeoutMs: options.timeoutMs,
  });
}

async function runV4LlmAudit(options = {}) {
  const datasetPath = options.datasetPath || DEFAULT_DATASET;
  const outDir = options.outDir || DEFAULT_OUT_DIR;
  const allRecords = readJsonl(datasetPath);
  const records = selectRecords(allRecords, options);
  const provider = options.provider || await createOpenAiProvider(options);
  const modelName = options.modelName || options.model || DEFAULT_MODEL;
  const reasoningEffort = options.reasoningEffort || DEFAULT_REASONING_EFFORT;

  fs.mkdirSync(outDir, { recursive: true });
  const resultPath = path.join(outDir, "v4-llm-audit-results.jsonl");
  const summaryPath = path.join(outDir, "v4-llm-audit-summary.json");
  const markdownPath = path.join(outDir, "v4-llm-audit-summary.md");
  const reviewQueuePath = path.join(outDir, "v4-llm-audit-review-queue.jsonl");
  fs.writeFileSync(resultPath, "");

  const rows = [];
  for (const record of records) {
    const row = await auditRecord({
      record,
      provider,
      modelName,
      reasoningEffort,
    });
    rows.push(row);
    fs.appendFileSync(resultPath, `${JSON.stringify(row)}\n`);
  }

  const reviewQueue = rows.filter((row) => (
    row.auditDecision === "disagree"
    || row.auditDecision === "uncertain"
    || row.includeInMain === false
  ));
  writeJsonl(reviewQueuePath, reviewQueue);
  const summary = buildSummary({
    datasetPath,
    resultPath,
    reviewQueuePath,
    summaryPath,
    rows,
    records,
    modelName,
    reasoningEffort,
    check: Boolean(options.check),
  });
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(markdownPath, buildMarkdown(summary));
  assertAuditRun(summary, rows);
  console.log(`Wrote V4 LLM audit results to ${path.relative(repoRoot, outDir)}`);
  return summary;
}

async function auditRecord(input) {
  const messages = buildAuditMessages(input.record);
  const promptSha256 = sha256(JSON.stringify(messages));
  try {
    const response = await input.provider({
      record: input.record,
      messages,
      modelName: input.modelName,
      reasoningEffort: input.reasoningEffort,
    });
    const rawOutput = typeof response === "string" ? response : response.content;
    const parsed = parseAuditOutput(rawOutput);
    const normalized = normalizeAuditOutput(input.record, parsed);
    return {
      schemaVersion: "v4-llm-audit",
      recordId: input.record.id,
      source: input.record.source,
      goldDecision: input.record.goldDecision,
      allowedDecisions: [...input.record.allowedDecisions],
      ...normalized,
      citationValid: citationsValid(input.record, normalized.citedEvidence),
      model: input.modelName,
      reasoningEffort: input.reasoningEffort,
      promptSha256,
    };
  } catch (error) {
    const fallback = {
      auditDecision: "uncertain",
      suggestedDecision: input.record.goldDecision,
      goldDecisionCheck: "unclear",
      evidenceSufficiency: "insufficient",
      granularityIssue: false,
      missingContextRows: [],
      materialConflict: false,
      includeInMain: false,
      confidence: 0,
      rationale: `audit_error: ${String(error.message || error).slice(0, 500)}`,
      citedEvidence: fallbackCitations(input.record),
    };
    return {
      schemaVersion: "v4-llm-audit",
      recordId: input.record.id,
      source: input.record.source,
      goldDecision: input.record.goldDecision,
      allowedDecisions: [...input.record.allowedDecisions],
      ...fallback,
      citationValid: citationsValid(input.record, fallback.citedEvidence),
      parseError: String(error.message || error).slice(0, 500),
      model: input.modelName,
      reasoningEffort: input.reasoningEffort,
      promptSha256,
    };
  }
}

function buildAuditMessages(record) {
  const system = [
    "You are an independent auditor for a frozen evidence benchmark.",
    "Use only the provided frozen evidence.",
    "Judge whether goldDecision is supported by the cited frozen evidence.",
    "Do not use external knowledge.",
    "For PubMedQA, audit the source-native yes/no/maybe answer, not an entailment/refutation conversion.",
    "Return JSON only.",
  ].join("\n");
  const user = {
    instructions: [
      "Return exactly these keys: auditDecision, suggestedDecision, goldDecisionCheck, evidenceSufficiency, granularityIssue, missingContextRows, materialConflict, includeInMain, confidence, rationale, citedEvidence.",
      "auditDecision must be agree, disagree, or uncertain.",
      "suggestedDecision must be one of allowedDecisions.",
      "goldDecisionCheck must be consistent, inconsistent, or unclear.",
      "evidenceSufficiency must be sufficient, partial, insufficient, or conflicting.",
      "granularityIssue must be true when raw-line evidence depends on missing context/header rows.",
      "missingContextRows must be an array of segment-level citations for missing or important context/header rows; use [] when none.",
      "materialConflict must be true when provided frozen evidence materially conflicts.",
      "includeInMain should be true only when the gold decision is consistent, evidence is sufficient, and no material conflict exists.",
      "confidence must be a number from 0 to 1.",
      "citedEvidence must cite segment-level evidence with documentId and segmentId.",
      "For NLI4CT full-trial raw-line records, check whether required evidence includes enough section context such as Outcome Measurement, Arm/Group Title, Unit of Measure, Inclusion Criteria, Exclusion Criteria, or [Not Specified] rows.",
    ],
    record: {
      id: record.id,
      source: record.source,
      task: record.task,
      allowedDecisions: record.allowedDecisions,
      goldDecision: record.goldDecision,
      documents: record.documents,
      requiredEvidence: record.requiredEvidence,
    },
  };
  return [
    { role: "system", content: system },
    { role: "user", content: JSON.stringify(user, null, 2) },
  ];
}

async function createOpenAiProvider(options = {}) {
  const keyResolution = resolveOpenAiApiKey({ hydrateEnv: true });
  if (!keyResolution.hasOpenAiKey) {
    throw new Error("OPENAI_API_KEY is required for V4 LLM audit runs. Use --check for fake-provider validation.");
  }
  const openAiModule = await import("openai");
  const OpenAI = openAiModule.default || openAiModule.OpenAI || openAiModule;
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: keyResolution.openAiBaseUrl || undefined,
    timeout: resolveTimeoutMs(options.timeoutMs),
  });
  const modelName = options.modelName || options.model || DEFAULT_MODEL;
  const reasoningEffort = options.reasoningEffort || DEFAULT_REASONING_EFFORT;
  return async ({ messages }) => {
    const response = await client.responses.create(withReasoning({
      model: modelName,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }, reasoningEffort));
    return {
      content: extractResponsesText(response),
      rawResponse: summarizeResponse(response),
    };
  };
}

async function fakeCheckProvider({ record }) {
  const disagrees = record.id === "nli4ct-v4-0301";
  return JSON.stringify({
    auditDecision: disagrees ? "disagree" : "agree",
    suggestedDecision: disagrees && record.allowedDecisions.includes("Contradiction")
      ? "Contradiction"
      : record.goldDecision,
    goldDecisionCheck: disagrees ? "inconsistent" : "consistent",
    evidenceSufficiency: disagrees ? "partial" : "sufficient",
    granularityIssue: false,
    missingContextRows: [],
    materialConflict: false,
    includeInMain: !disagrees,
    confidence: disagrees ? 0.95 : 0.9,
    rationale: disagrees
      ? "fake audit flags the known Dasatinib dose comparison disagreement"
      : `fake audit agrees with ${record.id}`,
    citedEvidence: fallbackCitations(record),
  });
}

function parseAuditOutput(rawOutput) {
  const parsed = typeof rawOutput === "string" ? parseJsonText(rawOutput) : rawOutput;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("audit output must be a JSON object");
  return parsed;
}

function normalizeAuditOutput(record, parsed) {
  const auditDecision = parsed.auditDecision;
  if (!["agree", "disagree", "uncertain"].includes(auditDecision)) throw new Error("invalid auditDecision");
  if (!record.allowedDecisions.includes(parsed.suggestedDecision)) throw new Error("suggestedDecision outside allowedDecisions");
  const goldDecisionCheck = normalizeEnum(parsed.goldDecisionCheck, ["consistent", "inconsistent", "unclear"], "goldDecisionCheck");
  const evidenceSufficiency = normalizeEnum(parsed.evidenceSufficiency, ["sufficient", "partial", "insufficient", "conflicting"], "evidenceSufficiency");
  const granularityIssue = normalizeBoolean(parsed.granularityIssue, "granularityIssue");
  const missingContextRows = normalizeOptionalCitations(parsed.missingContextRows, "missingContextRows");
  if (!citationsValid(record, missingContextRows)) throw new Error("missingContextRows references unknown frozen segment");
  const materialConflict = normalizeBoolean(parsed.materialConflict, "materialConflict");
  const includeInMain = auditDecision === "agree"
    && goldDecisionCheck === "consistent"
    && evidenceSufficiency === "sufficient"
    && !materialConflict;
  if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) throw new Error("confidence must be between 0 and 1");
  if (typeof parsed.rationale !== "string" || parsed.rationale.length === 0) throw new Error("rationale must be non-empty");
  if (!Array.isArray(parsed.citedEvidence) || parsed.citedEvidence.length === 0) throw new Error("citedEvidence must be non-empty");
  const citedEvidence = parsed.citedEvidence.map((citation, index) => normalizeCitation(citation, index));
  if (!citationsValid(record, citedEvidence)) throw new Error("citedEvidence references unknown frozen segment");
  return {
    auditDecision,
    suggestedDecision: parsed.suggestedDecision,
    goldDecisionCheck,
    evidenceSufficiency,
    granularityIssue,
    missingContextRows,
    materialConflict,
    includeInMain,
    confidence: parsed.confidence,
    rationale: parsed.rationale,
    citedEvidence,
  };
}

function normalizeEnum(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`invalid ${label}`);
  return value;
}

function normalizeBoolean(value, label) {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean`);
  return value;
}

function normalizeOptionalCitations(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((citation, index) => normalizeCitation(citation, index));
}

function normalizeCitation(citation, index) {
  if (!citation || typeof citation !== "object" || Array.isArray(citation)) throw new Error(`citation_${index}_not_object`);
  if (typeof citation.documentId !== "string" || citation.documentId.length === 0) throw new Error(`citation_${index}_missing_documentId`);
  if (typeof citation.segmentId !== "string" || citation.segmentId.length === 0) throw new Error(`citation_${index}_missing_segmentId`);
  return {
    documentId: citation.documentId,
    segmentId: citation.segmentId,
  };
}

function citationsValid(record, citations) {
  const documents = new Map((record.documents || []).map((document) => [document.documentId, document]));
  return citations.every((citation) => {
    const document = documents.get(citation.documentId);
    return Boolean(document && (document.segments || []).some((segment) => segment.segmentId === citation.segmentId));
  });
}

function fallbackCitations(record) {
  return (record.requiredEvidence || []).map((evidence) => ({
    documentId: evidence.documentId,
    segmentId: evidence.segmentId,
  })).filter((citation) => citation.documentId && citation.segmentId);
}

function selectRecords(records, options = {}) {
  let selected = [...records];
  if (options.inputReviewQueue) {
    const ids = readJsonl(options.inputReviewQueue).map((row) => row.recordId).filter(Boolean);
    const byId = new Map(selected.map((record) => [record.id, record]));
    selected = ids.map((id) => byId.get(id)).filter(Boolean);
  }
  if (options.stratifiedPerLabel !== undefined) {
    const count = positiveInteger(options.stratifiedPerLabel, "--stratified-per-label");
    const grouped = new Map();
    for (const record of selected) {
      const key = `${record.source}:${record.goldDecision}`;
      if (!grouped.has(key)) grouped.set(key, []);
      if (grouped.get(key).length < count) grouped.get(key).push(record);
    }
    selected = [...grouped.keys()].sort().flatMap((key) => grouped.get(key));
  }
  if (options.samplePerSource !== undefined) {
    const count = positiveInteger(options.samplePerSource, "--sample-per-source");
    const grouped = new Map();
    for (const record of selected) {
      if (!grouped.has(record.source)) grouped.set(record.source, []);
      if (grouped.get(record.source).length < count) grouped.get(record.source).push(record);
    }
    selected = [...grouped.keys()].sort().flatMap((key) => grouped.get(key));
  }
  if (options.limit !== undefined) {
    selected = selected.slice(0, positiveInteger(options.limit, "--limit"));
  }
  return selected;
}

function buildSummary(input) {
  const parseFailures = input.rows.filter((row) => row.parseError).length;
  return {
    schemaVersion: "v4-llm-audit-summary",
    mode: input.check ? "check" : "live",
    datasetPath: path.relative(repoRoot, input.datasetPath),
    resultPath: path.relative(repoRoot, input.resultPath),
    reviewQueuePath: path.relative(repoRoot, input.reviewQueuePath),
    summaryPath: path.relative(repoRoot, input.summaryPath),
    records: input.rows.length,
    model: input.modelName,
    reasoningEffort: input.reasoningEffort,
    parseFailures,
    citationValidity: average(input.rows.map((row) => row.citationValid ? 1 : 0)),
    reviewQueue: input.rows.filter((row) => (
      row.auditDecision === "disagree"
      || row.auditDecision === "uncertain"
      || row.includeInMain === false
    )).length,
    includeInMain: input.rows.filter((row) => row.includeInMain).length,
    includeInMainRate: average(input.rows.map((row) => row.includeInMain ? 1 : 0)),
    auditDecisions: countBy(input.rows, "auditDecision"),
    goldDecisionChecks: countBy(input.rows, "goldDecisionCheck"),
    evidenceSufficiency: countBy(input.rows, "evidenceSufficiency"),
    granularityIssues: input.rows.filter((row) => row.granularityIssue).length,
    materialConflicts: input.rows.filter((row) => row.materialConflict).length,
    sources: summarizeSources(input.rows),
    sourceLabels: summarizeSourceLabels(input.rows),
  };
}

function summarizeSources(rows) {
  const grouped = groupBy(rows, "source");
  return Object.fromEntries([...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([source, sourceRows]) => [source, {
    records: sourceRows.length,
    includeInMain: sourceRows.filter((row) => row.includeInMain).length,
    auditDecisions: countBy(sourceRows, "auditDecision"),
    evidenceSufficiency: countBy(sourceRows, "evidenceSufficiency"),
    granularityIssues: sourceRows.filter((row) => row.granularityIssue).length,
    materialConflicts: sourceRows.filter((row) => row.materialConflict).length,
    disagreementRate: average(sourceRows.map((row) => row.auditDecision === "disagree" ? 1 : 0)),
    uncertainRate: average(sourceRows.map((row) => row.auditDecision === "uncertain" ? 1 : 0)),
  }]));
}

function summarizeSourceLabels(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.source}:${row.goldDecision}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return Object.fromEntries([...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, keyRows]) => [key, {
    records: keyRows.length,
    auditDecisions: countBy(keyRows, "auditDecision"),
    includeInMain: keyRows.filter((row) => row.includeInMain).length,
    evidenceSufficiency: countBy(keyRows, "evidenceSufficiency"),
  }]));
}

function buildMarkdown(summary) {
  const lines = [
    "# V4 LLM Audit",
    "",
    `Mode: ${summary.mode}`,
    `Model: ${summary.model}`,
    `Reasoning effort: ${summary.reasoningEffort}`,
    `Records: ${summary.records}`,
    `Include in main: ${summary.includeInMain}`,
    `Review queue: ${summary.reviewQueue}`,
    `Citation validity: ${fmt(summary.citationValidity)}`,
    "",
    "| Source | Records | Include | Agree | Disagree | Uncertain | Sufficient | Partial | Insufficient | Conflicting | Granularity issues | Material conflicts |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const [source, stats] of Object.entries(summary.sources)) {
    lines.push([
      `| ${source}`,
      stats.records,
      stats.includeInMain || 0,
      stats.auditDecisions.agree || 0,
      stats.auditDecisions.disagree || 0,
      stats.auditDecisions.uncertain || 0,
      stats.evidenceSufficiency.sufficient || 0,
      stats.evidenceSufficiency.partial || 0,
      stats.evidenceSufficiency.insufficient || 0,
      stats.evidenceSufficiency.conflicting || 0,
      stats.granularityIssues || 0,
      `${stats.materialConflicts || 0} |`,
    ].join(" | "));
  }
  lines.push("");
  return lines.join("\n");
}

function assertAuditRun(summary, rows) {
  if (summary.records !== rows.length) throw new Error("summary records mismatch");
  if (summary.citationValidity !== 1) throw new Error("audit citation validity below 1");
}

function parseArgs(argv) {
  const options = {
    dataset: DEFAULT_DATASET,
    outDir: DEFAULT_OUT_DIR,
    model: DEFAULT_MODEL,
    reasoningEffort: DEFAULT_REASONING_EFFORT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dataset") options.dataset = path.resolve(argv[++index]);
    else if (arg === "--out" || arg === "--out-dir") options.outDir = path.resolve(argv[++index]);
    else if (arg === "--check") options.check = true;
    else if (arg === "--sample-per-source" || arg === "--per-source") options.samplePerSource = argv[++index];
    else if (arg === "--stratified-per-label") options.stratifiedPerLabel = argv[++index];
    else if (arg === "--limit" || arg === "--max-records") options.limit = argv[++index];
    else if (arg === "--model") options.model = argv[++index];
    else if (arg === "--reasoning-effort") options.reasoningEffort = argv[++index];
    else if (arg === "--timeout-ms") options.timeoutMs = argv[++index];
    else if (arg === "--input-review-queue") options.inputReviewQueue = path.resolve(argv[++index]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function writeJsonl(filePath, rows) {
  fs.writeFileSync(filePath, rows.length > 0 ? `${rows.map((row) => JSON.stringify(row)).join("\n")}\n` : "");
}

function parseJsonText(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`audit output must be JSON: ${error.message}`);
  }
}

function extractResponsesText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function summarizeResponse(response) {
  return {
    id: response.id || null,
    model: response.model || null,
    usage: response.usage || null,
  };
}

function withReasoning(request, reasoningEffort) {
  if (!reasoningEffort) return request;
  return {
    ...request,
    reasoning: {
      ...(request.reasoning || {}),
      effort: reasoningEffort,
    },
  };
}

function resolveTimeoutMs(value) {
  const parsed = Number(value || process.env.LIVE_COMPARISON_TIMEOUT_MS || 60000);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("timeout must be a positive number");
  return parsed;
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const groupKey = row[key];
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(row);
  }
  return groups;
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key];
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function average(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function fmt(value) {
  if (value === null || value === undefined) return "NA";
  return Number(value).toFixed(3);
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

module.exports = {
  runV4LlmAudit,
  selectRecords,
  parseAuditOutput,
  normalizeAuditOutput,
};
