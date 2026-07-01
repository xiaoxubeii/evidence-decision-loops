#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { resolveOpenAiApiKey } = require("./lib/openai_api_key");
const {
  buildV4PromptMessages,
  normalizeV4Setting,
  parseV4AgentOutput,
} = require("./lib/v4_live_contract");
const { scoreV4Output } = require("./lib/v4_source_scorer");
const { scoreV4TraceProcess } = require("./lib/v4_trace_metrics");
const { deriveV4HumanReviewRouting } = require("./lib/v4_human_review_routing");
const {
  buildV4ToolRuntime,
  runV4ResponsesToolLoop,
} = require("./lib/v4_tool_runtime");
const { runV4EdlController } = require("./lib/v4_edl_controller");

const repoRoot = path.resolve(__dirname, "..", "..");
const DEFAULT_DATASET = path.join(repoRoot, "src/data/react-clinical-source-v4.jsonl");
const DEFAULT_OUT_DIR = path.join(repoRoot, "src/results/live-comparison-v4");
const DEFAULT_METHODS = Object.freeze(["direct", "cot", "react", "edl"]);
const DEFAULT_SETTING = "frozen-evidence";

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const provider = options.check ? fakeCheckProvider : await createOpenAiProvider(options);
  await runLiveComparisonV4({
    datasetPath: options.dataset,
    outDir: options.outDir,
    methods: parseMethods(options.methods),
    limit: options.limit,
    samplePerSource: options.samplePerSource,
    setting: options.setting,
    provider,
    modelName: options.check ? "fake-v4-check-model" : (options.model || process.env.LIVE_COMPARISON_MODEL || "gpt-4.1-mini"),
    reasoningEffort: options.reasoningEffort,
    check: options.check,
    resume: options.resume,
    reactTopK: options.reactTopK,
    reactMinSearchCalls: options.reactMinSearchCalls,
    reactMinReadSegments: options.reactMinReadSegments,
    reactSearchMode: options.reactSearchMode,
    reactForceTopK: options.reactForceTopK,
    edlTopK: options.edlTopK,
    edlMaxEvidenceRounds: options.edlMaxEvidenceRounds,
    edlMinEvidenceRounds: options.edlMinEvidenceRounds,
    edlMinViewedSegmentsBeforeSufficient: options.edlMinViewedSegmentsBeforeSufficient,
    edlSearchMode: options.edlSearchMode,
    edlEscalateTopKOnInsufficient: options.edlEscalateTopKOnInsufficient,
    edlDisableSufficiencyAssessment: options.edlDisableSufficiencyAssessment,
    edlDisableCitationValidation: options.edlDisableCitationValidation,
    edlCitationSelfCheck: options.edlCitationSelfCheck,
    edlMaxCitationSelfCheckRounds: options.edlMaxCitationSelfCheckRounds,
    edlSourceAwareQueryPlanning: options.edlSourceAwareQueryPlanning,
  });
}

async function runLiveComparisonV4(options = {}) {
  const datasetPath = options.datasetPath || DEFAULT_DATASET;
  const outDir = options.outDir || DEFAULT_OUT_DIR;
  const methods = parseMethods(options.methods || DEFAULT_METHODS);
  const setting = normalizeV4Setting(options.setting || DEFAULT_SETTING);
  validateSettingMethods(setting, methods);
  const records = selectRecords(options.records || readJsonl(datasetPath), options);
  const provider = options.provider || (options.check ? fakeCheckProvider : await createOpenAiProvider(options));
  const modelName = options.modelName || options.model || "gpt-4.1-mini";
  const reasoningEffort = normalizeReasoningEffort(options.reasoningEffort);
  const reactTopK = options.reactTopK ?? 3;
  const reactMinSearchCalls = options.reactMinSearchCalls ?? 0;
  const reactMinReadSegments = options.reactMinReadSegments ?? 0;
  const reactSearchMode = options.reactSearchMode || "token_overlap";
  const reactForceTopK = Boolean(options.reactForceTopK);
  const edlTopK = options.edlTopK || 2;
  const edlMaxEvidenceRounds = options.edlMaxEvidenceRounds || 3;
  const edlMinEvidenceRounds = options.edlMinEvidenceRounds || 1;
  const edlMinViewedSegmentsBeforeSufficient = options.edlMinViewedSegmentsBeforeSufficient || 0;
  const edlSearchMode = options.edlSearchMode || "token_overlap";
  const edlEscalateTopKOnInsufficient = options.edlEscalateTopKOnInsufficient || null;
  const edlDisableSufficiencyAssessment = Boolean(options.edlDisableSufficiencyAssessment);
  const edlDisableCitationValidation = Boolean(options.edlDisableCitationValidation);
  const edlCitationSelfCheck = Boolean(options.edlCitationSelfCheck);
  const edlMaxCitationSelfCheckRounds = options.edlMaxCitationSelfCheckRounds || 1;
  const edlSourceAwareQueryPlanning = options.edlSourceAwareQueryPlanning || "off";
  validatePositiveInteger("reactTopK", reactTopK);
  validateNonNegativeInteger("reactMinSearchCalls", reactMinSearchCalls);
  validateNonNegativeInteger("reactMinReadSegments", reactMinReadSegments);
  validateSearchMode("reactSearchMode", reactSearchMode);
  validatePositiveInteger("edlTopK", edlTopK);
  validatePositiveInteger("edlMaxEvidenceRounds", edlMaxEvidenceRounds);
  validatePositiveInteger("edlMinEvidenceRounds", edlMinEvidenceRounds);
  if (edlEscalateTopKOnInsufficient !== null) validatePositiveInteger("edlEscalateTopKOnInsufficient", edlEscalateTopKOnInsufficient);
  validatePositiveInteger("edlMaxCitationSelfCheckRounds", edlMaxCitationSelfCheckRounds);
  if (!Number.isInteger(edlMinViewedSegmentsBeforeSufficient) || edlMinViewedSegmentsBeforeSufficient < 0) {
    throw new Error("--edl-min-viewed-segments-before-sufficient must be a non-negative integer");
  }
  validateSearchMode("edlSearchMode", edlSearchMode);
  if (!["off", "scifact", "nli4ct"].includes(edlSourceAwareQueryPlanning)) {
    throw new Error("--edl-source-aware-query-planning must be one of off, scifact, nli4ct");
  }
  const tracePath = path.join(outDir, "live-comparison-v4-traces.jsonl");
  const resultPath = path.join(outDir, "live-comparison-v4-results.json");
  const markdownPath = path.join(outDir, "live-comparison-v4-results.md");

  fs.mkdirSync(outDir, { recursive: true });
  const traces = options.resume ? readJsonlIfExists(tracePath) : [];
  const completed = new Set(traces.map(traceKey));
  if (!options.resume) fs.writeFileSync(tracePath, "");
  for (const record of records) {
    for (const method of methods) {
      const key = traceKey({ recordId: record.id, method });
      if (completed.has(key)) continue;
      const trace = await buildLiveTrace({
        record,
        method,
        setting,
        provider,
        modelName,
        reasoningEffort,
        check: Boolean(options.check),
        reactTopK,
        reactMinSearchCalls,
        reactMinReadSegments,
        reactSearchMode,
        reactForceTopK,
        edlTopK,
        edlMaxEvidenceRounds,
        edlMinEvidenceRounds,
        edlMinViewedSegmentsBeforeSufficient,
        edlSearchMode,
        edlEscalateTopKOnInsufficient,
        edlDisableSufficiencyAssessment,
        edlDisableCitationValidation,
        edlCitationSelfCheck,
        edlMaxCitationSelfCheckRounds,
        edlSourceAwareQueryPlanning,
      });
      traces.push(trace);
      completed.add(traceKey(trace));
      appendJsonl(tracePath, trace);
    }
  }

  const summary = buildSummary({
    datasetPath,
    tracePath,
    resultPath,
    records,
    traces,
    methods,
    setting,
    modelName,
    reasoningEffort,
    check: Boolean(options.check),
  });

  fs.writeFileSync(resultPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(markdownPath, buildMarkdown(summary));
  assertCheck(summary, traces, records, methods);
  console.log(`Wrote V4 live comparison results to ${path.relative(repoRoot, outDir)}`);
  return summary;
}

async function buildLiveTrace(input) {
  if (input.method === "react") return buildReactLiveTrace(input);
  if (input.method === "edl") return buildEdlLiveTrace(input);
  return buildInlineLiveTrace(input);
}

async function buildInlineLiveTrace(input) {
  const messages = buildV4PromptMessages(input.record, { method: input.method, setting: input.setting });
  const promptSha256 = sha256(JSON.stringify(messages));
  const response = await invokeInlineProvider(input.provider, {
    record: input.record,
    method: input.method,
    messages,
    modelName: input.modelName,
    reasoningEffort: input.reasoningEffort,
  });
  const rawOutput = typeof response === "string" ? response : response.content;
  const parsed = safeParseV4AgentOutput(rawOutput);
  const scores = scoreV4Output(input.record, parsed.output);
  const routing = deriveV4HumanReviewRouting({
    record: input.record,
    output: parsed.output,
    scores,
    traceMeta: { parseError: parsed.parseError },
  });
  return {
    recordId: input.record.id,
    source: input.record.source,
    method: input.method,
    setting: input.setting,
    model: input.modelName,
    reasoningEffort: input.reasoningEffort || null,
    promptSha256,
    rawOutput,
    output: parsed.output,
    processScores: null,
    scores,
    ...routing,
    ...(parsed.parseError ? { parseError: parsed.parseError } : {}),
  };
}

async function buildReactLiveTrace(input) {
  const messages = buildV4PromptMessages(input.record, { method: input.method, setting: input.setting });
  const promptSha256 = sha256(JSON.stringify(messages));
  const runtimeOptions = reactRuntimeOptions(input);
  if (input.check) {
    const runtime = buildV4ToolRuntime(input.record, runtimeOptions);
    const searchSegments = [];
    const minSearchCalls = Math.max(1, input.reactMinSearchCalls || 0);
    for (let index = 0; index < minSearchCalls; index += 1) {
      const searchResult = await runtime.run("search_segments", {
        query: input.record.task.input,
        topK: input.reactTopK,
      });
      searchSegments.push(...(searchResult.segments || []));
    }
    const targetCitations = citationsFor(input.record);
    const toRead = reactCheckReadQueue(targetCitations, searchSegments, input.reactMinReadSegments);
    for (const citation of toRead) {
      await runtime.run("read_segment", citation);
    }
    const output = fakeV4Payload(input.record, input.method);
    await runtime.run("submit_decision", output);
    return buildToolTrace(input, {
      promptSha256,
      rawOutput: JSON.stringify(output),
      output,
      steps: runtime.getEvents(),
      toolTranscriptMode: "stateless_context_replay",
    });
  }

  if (!input.provider || !input.provider.client) {
    throw new Error("V4 react requires a Responses API provider with client support");
  }

  const loopResult = await runV4ResponsesToolLoop({
    client: input.provider.client,
    modelName: input.modelName,
    messages,
    record: input.record,
    runtime: buildV4ToolRuntime(input.record, runtimeOptions),
    reasoningEffort: input.reasoningEffort,
    forceSubmitOnMaxToolSteps: input.setting === "evidence-seeking",
  });
  const parsed = loopResult.output
    ? { output: loopResult.output }
    : safeParseV4AgentOutput(loopResult.rawText);
  return buildToolTrace(input, {
    promptSha256,
    rawOutput: loopResult.rawText,
    output: parsed.output,
    steps: loopResult.steps,
    parseError: loopResult.parseError || parsed.parseError,
    toolTranscriptMode: loopResult.toolTranscriptMode,
    toolBudgetExhausted: loopResult.toolBudgetExhausted,
    forcedSubmit: loopResult.forcedSubmit,
  });
}

function safeParseV4AgentOutput(rawOutput) {
  try {
    return { output: parseV4AgentOutput(rawOutput) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: { decision: "", citedEvidence: [] },
      parseError: `agent_parse_error:${message}`.slice(0, 220),
    };
  }
}

function reactRuntimeOptions(input) {
  return {
    defaultTopK: input.reactTopK,
    forceTopK: input.reactForceTopK,
    searchMode: input.reactSearchMode,
    submitRequirements: {
      minSearchCalls: input.reactMinSearchCalls,
      minReadSegments: input.reactMinReadSegments,
    },
  };
}

function reactCheckReadQueue(targetCitations, searchSegments, minReadSegments) {
  const byKey = new Map();
  for (const citation of targetCitations) {
    byKey.set(evidenceKey(citation), {
      documentId: citation.documentId,
      segmentId: citation.segmentId,
    });
  }
  for (const segment of searchSegments) {
    byKey.set(evidenceKey(segment), {
      documentId: segment.documentId,
      segmentId: segment.segmentId,
    });
  }
  const needed = Math.max(1, targetCitations.length, minReadSegments || 0);
  return [...byKey.values()].slice(0, needed);
}

async function buildEdlLiveTrace(input) {
  const messages = buildV4PromptMessages(input.record, { method: input.method, setting: input.setting });
  const promptSha256 = sha256(JSON.stringify(messages));
  const edlOptions = input.setting === "frozen-evidence"
    ? { initialViewedSegments: flattenRecordSegments(input.record), skipEvidenceSearch: true }
    : {
      defaultTopK: input.edlTopK,
      maxEvidenceRounds: input.edlMaxEvidenceRounds,
      minEvidenceRounds: input.edlMinEvidenceRounds,
      minViewedSegmentsBeforeSufficient: input.edlMinViewedSegmentsBeforeSufficient,
      searchMode: input.edlSearchMode,
      escalateTopKOnInsufficient: input.edlEscalateTopKOnInsufficient,
      disableSufficiencyAssessment: input.edlDisableSufficiencyAssessment,
      disableCitationValidation: input.edlDisableCitationValidation,
      citationSelfCheck: input.edlCitationSelfCheck,
      maxCitationSelfCheckRounds: input.edlMaxCitationSelfCheckRounds,
      sourceAwareQueryPlanning: input.edlSourceAwareQueryPlanning,
    };
  if (input.check) {
    const result = await runV4EdlController({
      record: input.record,
      ...edlOptions,
      invokeModel: async ({ phase }) => {
        if (phase === "assess") {
          return JSON.stringify({
            sufficiency: "sufficient",
            rationale: "Check mode reads required segment evidence.",
          });
        }
        if (phase === "citation_self_check") {
          return JSON.stringify({
            status: "pass",
            rationale: "Check mode citations are accepted.",
          });
        }
        if (phase === "plan_query") {
          return JSON.stringify({
            query: input.record.task.input,
            rationale: "Check mode keeps the original task input.",
          });
        }
        return JSON.stringify(fakeV4Payload(input.record, input.method, {
          invalidCitation: Boolean(input.edlDisableCitationValidation),
        }));
      },
    });
    return buildToolTrace(input, {
      promptSha256,
      rawOutput: result.rawText,
      output: result.payload,
      steps: edlSteps(result),
      viewedSegments: result.viewedSegments,
      controllerResult: result,
    });
  }

  const result = await runV4EdlController({
    record: input.record,
    ...edlOptions,
    invokeModel: async ({ phase, prompt }) => invokeEdlProvider(input, prompt, phase),
    invokeRepairModel: async ({ prompt }) => invokeEdlProvider(input, prompt, "repair"),
  });
  return buildToolTrace(input, {
    promptSha256,
    rawOutput: result.rawText,
    output: result.payload,
    steps: edlSteps(result),
    viewedSegments: result.viewedSegments,
    controllerResult: result,
  });
}

async function invokeEdlProvider(input, prompt, phase) {
  const response = await invokeInlineProvider(input.provider, {
    record: input.record,
    method: input.method,
    messages: [
      { role: "system", content: `You are a V4 EDL evidence auditor in ${phase} phase. Return JSON only.` },
      { role: "user", content: prompt },
    ],
    modelName: input.modelName,
    reasoningEffort: input.reasoningEffort,
  });
  return typeof response === "string" ? response : response.content;
}

function edlSteps(result) {
  return [
    ...(result.orderedSteps || [...(result.toolEvents || []), ...(result.controllerSteps || [])]),
    { type: "action", action: "edl_validate", input: result.validation, content: "edl_validate" },
  ];
}

function buildToolTrace(input, result) {
  const scores = scoreV4Output(input.record, result.output);
  const routing = deriveV4HumanReviewRouting({
    record: input.record,
    output: result.output,
    scores,
    controllerResult: result.controllerResult,
    traceMeta: {
      parseError: result.parseError,
      toolError: result.toolError,
      modelError: result.modelError,
    },
  });
  const trace = {
    recordId: input.record.id,
    source: input.record.source,
    method: input.method,
    setting: input.setting,
    model: input.modelName,
    reasoningEffort: input.reasoningEffort || null,
    promptSha256: result.promptSha256,
    rawOutput: result.rawOutput,
    output: result.output,
    steps: result.steps || [],
    scores,
    ...routing,
  };
  trace.processScores = scoreV4TraceProcess(input.record, {
    ...trace,
    viewedSegments: result.viewedSegments || [],
  });
  if (result.parseError) trace.parseError = result.parseError;
  if (result.toolTranscriptMode) trace.toolTranscriptMode = result.toolTranscriptMode;
  if (typeof result.toolBudgetExhausted === "boolean") trace.toolBudgetExhausted = result.toolBudgetExhausted;
  if (typeof result.forcedSubmit === "boolean") trace.forcedSubmit = result.forcedSubmit;
  return trace;
}

async function createOpenAiProvider(options = {}) {
  const keyResolution = resolveOpenAiApiKey({ hydrateEnv: true });
  if (!keyResolution.hasOpenAiKey) {
    throw new Error("OPENAI_API_KEY is required for V4 live runs. Use --check for fake-provider validation.");
  }
  const openAiModule = await import("openai");
  const OpenAI = openAiModule.default || openAiModule.OpenAI || openAiModule;
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: keyResolution.openAiBaseUrl || undefined,
    timeout: resolveTimeoutMs(options.timeoutMs),
  });
  const modelName = options.model || process.env.LIVE_COMPARISON_MODEL || "gpt-4.1-mini";
  const reasoningEffort = normalizeReasoningEffort(options.reasoningEffort);
  return {
    client,
    async invokeInline({ messages, modelName: overrideModelName }) {
    const response = await client.responses.create(withReasoning({
      model: overrideModelName || modelName,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }, reasoningEffort));
    return {
      content: extractResponsesText(response),
      rawResponse: summarizeResponse(response),
    };
    },
  };
}

async function fakeCheckProvider({ record, method }) {
  return JSON.stringify(fakeV4Payload(record, method));
}

function fakeV4Payload(record, method, options = {}) {
  const citedEvidence = citationsFor(record);
  return {
    decision: record.goldDecision,
    citedEvidence: options.invalidCitation ? invalidateCitations(citedEvidence) : citedEvidence,
    rationale: `fake ${method} response for ${record.id}`,
  };
}

function invalidateCitations(citations) {
  return citations.map((citation, index) => ({
    documentId: citation.documentId,
    segmentId: `invalid-${citation.segmentId || index}`,
  }));
}

async function invokeInlineProvider(provider, input) {
  if (typeof provider === "function") return provider(input);
  return provider.invokeInline(input);
}

function selectRecords(records, options = {}) {
  let selected = [...records];
  if (options.samplePerSource !== undefined) {
    const perSource = Number(options.samplePerSource);
    if (!Number.isInteger(perSource) || perSource <= 0) throw new Error("--sample-per-source must be a positive integer");
    const grouped = new Map();
    for (const record of selected) {
      if (!grouped.has(record.source)) grouped.set(record.source, []);
      if (grouped.get(record.source).length < perSource) grouped.get(record.source).push(record);
    }
    selected = [...grouped.values()].flat();
  }
  if (options.limit !== undefined) {
    const limit = Number(options.limit);
    if (!Number.isInteger(limit) || limit <= 0) throw new Error("--limit must be a positive integer");
    selected = selected.slice(0, limit);
  }
  return selected;
}

function buildSummary(input) {
  return {
    schemaVersion: "v4-live-comparison",
    mode: input.check ? "check" : "live",
    datasetPath: path.relative(repoRoot, input.datasetPath),
    tracePath: path.relative(repoRoot, input.tracePath),
    resultPath: path.relative(repoRoot, input.resultPath),
    records: input.records.length,
    traces: input.traces.length,
    setting: input.setting,
    model: input.modelName,
    reasoningEffort: input.reasoningEffort || null,
    methodSelection: input.methods,
    methods: summarizeMethods(input.traces),
    sources: summarizeSources(input.traces),
  };
}

function summarizeMethods(traces) {
  const byMethod = groupBy(traces, "method");
  return Object.fromEntries([...byMethod.entries()].map(([method, methodTraces]) => [method, summarizeTraceSet(methodTraces)]));
}

function summarizeSources(traces) {
  const bySource = groupBy(traces, "source");
  return Object.fromEntries([...bySource.entries()].map(([source, sourceTraces]) => [source, {
    traces: sourceTraces.length,
    methods: summarizeMethods(sourceTraces),
  }]));
}

function summarizeTraceSet(traces) {
  return {
    traces: traces.length,
    decisionAccuracy: average(traces.map((trace) => trace.scores.decisionCorrect ? 1 : 0)),
    citationValidity: average(traces.map((trace) => trace.scores.citationValid ? 1 : 0)),
    requiredEvidenceRecall: average(traces.map((trace) => trace.scores.requiredEvidenceRecall)),
    requiredEvidencePrecision: averageNullable(traces.map((trace) => trace.scores.requiredEvidencePrecision)),
    citationGranularityMatched: average(traces.map((trace) => trace.scores.citationGranularityMatched ? 1 : 0)),
    searchRequiredEvidenceRecall: averageNullable(traces.map((trace) => (
      trace.processScores ? trace.processScores.searchRequiredEvidenceRecall : null
    ))),
    readRequiredEvidenceRecall: averageNullable(traces.map((trace) => (
      trace.processScores ? trace.processScores.readRequiredEvidenceRecall : null
    ))),
    evidenceFailureStages: countBy(traces.map((trace) => (
      trace.processScores ? trace.processScores.evidenceFailureStage : null
    )).filter(Boolean)),
    processValidity: averageNullable(traces.map((trace) => {
      if (!trace.processScores) return null;
      return trace.processScores.processValid ? 1 : 0;
    })),
    humanReviewRate: average(traces.map((trace) => trace.requiredHumanReview ? 1 : 0)),
    reviewReasonCounts: countReviewReasons(traces),
    missedRequiredReviewRate: average(traces.map((trace) => (
      trace.processScores && trace.processScores.missedRequiredReview ? 1 : 0
    ))),
    unnecessaryReviewRate: average(traces.map((trace) => (
      trace.processScores && trace.processScores.unnecessaryReview ? 1 : 0
    ))),
    primaryMetric: average(traces.map((trace) => trace.scores.primaryMetric)),
    invalidDecisionRate: average(traces.map((trace) => trace.scores.invalidDecision ? 1 : 0)),
  };
}

function buildMarkdown(summary) {
  const lines = [
    "# V4 Live Comparison",
    "",
    `Records: ${summary.records}`,
    `Traces: ${summary.traces}`,
    `Mode: ${summary.mode}`,
    `Setting: ${summary.setting}`,
    `Model: ${summary.model}`,
    `Reasoning effort: ${summary.reasoningEffort || "default"}`,
    "",
    "| Method | Decision accuracy | Citation validity | Required evidence recall | Required evidence precision | Search required evidence recall | Read required evidence recall | Process validity | Human review rate | Review reasons | Missed review rate | Unnecessary review rate | Failure stages | Citation granularity | Primary metric | Invalid decision rate |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |",
  ];
  for (const method of summary.methodSelection) {
    const metrics = summary.methods[method];
    lines.push([
      `| ${method}`,
      fmt(metrics.decisionAccuracy),
      fmt(metrics.citationValidity),
      fmt(metrics.requiredEvidenceRecall),
      fmt(metrics.requiredEvidencePrecision),
      fmt(metrics.searchRequiredEvidenceRecall),
      fmt(metrics.readRequiredEvidenceRecall),
      fmt(metrics.processValidity),
      fmt(metrics.humanReviewRate),
      fmtCounts(metrics.reviewReasonCounts),
      fmt(metrics.missedRequiredReviewRate),
      fmt(metrics.unnecessaryReviewRate),
      fmtCounts(metrics.evidenceFailureStages),
      fmt(metrics.citationGranularityMatched),
      fmt(metrics.primaryMetric),
      `${fmt(metrics.invalidDecisionRate)} |`,
    ].join(" | "));
  }
  lines.push("");
  return lines.join("\n");
}

function assertCheck(summary, traces, records, methods) {
  if (summary.traces !== traces.length) throw new Error("summary trace count mismatch");
  if (traces.length !== records.length * methods.length) throw new Error("trace count mismatch");
  for (const trace of traces) {
    if (!trace.setting) throw new Error(`${trace.recordId}:${trace.method} missing setting`);
    if (!trace.output || !Array.isArray(trace.output.citedEvidence)) throw new Error(`${trace.recordId}:${trace.method} missing parsed output`);
    if (!trace.scores || typeof trace.scores.primaryMetric !== "number") throw new Error(`${trace.recordId}:${trace.method} missing scores`);
    if (typeof trace.requiredHumanReview !== "boolean") throw new Error(`${trace.recordId}:${trace.method} missing requiredHumanReview`);
    if (!Array.isArray(trace.reviewReasons)) throw new Error(`${trace.recordId}:${trace.method} missing reviewReasons`);
    if (!trace.reviewRouting || trace.reviewRouting.required !== trace.requiredHumanReview) {
      throw new Error(`${trace.recordId}:${trace.method} inconsistent reviewRouting`);
    }
  }
}

function countReviewReasons(traces) {
  return countBy(traces.flatMap((trace) => (
    Array.isArray(trace.reviewReasons) ? trace.reviewReasons : []
  )));
}

function citationFor(record) {
  return citationsFor(record)[0];
}

function citationsFor(record) {
  const requiredEvidence = Array.isArray(record.requiredEvidence) ? record.requiredEvidence : [];
  if (requiredEvidence.length > 0) {
    return requiredEvidence.map((evidence) => {
      if (typeof evidence.documentId !== "string" || typeof evidence.segmentId !== "string") {
        throw new Error(`${record.id} has non-segment required evidence`);
      }
      return { documentId: evidence.documentId, segmentId: evidence.segmentId };
    });
  }
  const firstDocument = record.documents && record.documents[0];
  const firstSegment = firstDocument && firstDocument.segments && firstDocument.segments[0];
  if (firstDocument && firstSegment) {
    return [{ documentId: firstDocument.documentId, segmentId: firstSegment.segmentId }];
  }
  throw new Error(`${record.id} missing segment-level evidence`);
}

function flattenRecordSegments(record) {
  return (record.documents || []).flatMap((document) => (
    (document.segments || []).map((segment) => ({
      documentId: document.documentId,
      segmentId: segment.segmentId,
      index: segment.index,
      text: segment.text,
    }))
  ));
}

function evidenceKey(value) {
  return `${value.documentId}\t${value.segmentId}`;
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

function parseMethods(value) {
  const raw = Array.isArray(value) ? value.join(",") : String(value || DEFAULT_METHODS.join(","));
  const methods = raw.split(",").map((method) => method.trim()).filter(Boolean);
  for (const method of methods) {
    if (!DEFAULT_METHODS.includes(method)) throw new Error(`unsupported V4 live method: ${method}`);
  }
  return methods;
}

function validateSettingMethods(setting, methods) {
  if (setting !== "evidence-seeking") return;
  const invalid = methods.filter((method) => !["react", "edl"].includes(method));
  if (invalid.length > 0) {
    throw new Error(`evidence-seeking supports only react,edl; invalid methods: ${invalid.join(",")}`);
  }
}

function parseArgs(argv) {
  const options = {
    dataset: DEFAULT_DATASET,
    outDir: DEFAULT_OUT_DIR,
    methods: DEFAULT_METHODS.join(","),
    reactTopK: 3,
    reactMinSearchCalls: 0,
    reactMinReadSegments: 0,
    reactSearchMode: "token_overlap",
    reactForceTopK: false,
    edlTopK: 2,
    edlMaxEvidenceRounds: 3,
    edlMinEvidenceRounds: 1,
    edlMinViewedSegmentsBeforeSufficient: 0,
    edlSearchMode: "token_overlap",
    edlEscalateTopKOnInsufficient: null,
    edlDisableSufficiencyAssessment: false,
    edlDisableCitationValidation: false,
    edlCitationSelfCheck: false,
    edlMaxCitationSelfCheckRounds: 1,
    edlSourceAwareQueryPlanning: "off",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dataset") options.dataset = path.resolve(argv[++i]);
    else if (arg === "--out-dir") options.outDir = path.resolve(argv[++i]);
    else if (arg === "--methods") options.methods = argv[++i];
    else if (arg === "--setting") options.setting = argv[++i];
    else if (arg === "--limit" || arg === "--max-records") options.limit = argv[++i];
    else if (arg === "--sample-per-source" || arg === "--per-source") options.samplePerSource = argv[++i];
    else if (arg === "--model") options.model = argv[++i];
    else if (arg === "--reasoning-effort") options.reasoningEffort = argv[++i];
    else if (arg === "--timeout-ms") options.timeoutMs = argv[++i];
    else if (arg === "--react-top-k") options.reactTopK = Number(argv[++i]);
    else if (arg === "--react-min-search-calls") options.reactMinSearchCalls = Number(argv[++i]);
    else if (arg === "--react-min-read-segments") options.reactMinReadSegments = Number(argv[++i]);
    else if (arg === "--react-search-mode") options.reactSearchMode = argv[++i];
    else if (arg === "--react-force-top-k") options.reactForceTopK = true;
    else if (arg === "--edl-top-k") options.edlTopK = Number(argv[++i]);
    else if (arg === "--edl-max-evidence-rounds") options.edlMaxEvidenceRounds = Number(argv[++i]);
    else if (arg === "--edl-min-evidence-rounds") options.edlMinEvidenceRounds = Number(argv[++i]);
    else if (arg === "--edl-min-viewed-segments-before-sufficient") options.edlMinViewedSegmentsBeforeSufficient = Number(argv[++i]);
    else if (arg === "--edl-search-mode") options.edlSearchMode = argv[++i];
    else if (arg === "--edl-escalate-top-k-on-insufficient") options.edlEscalateTopKOnInsufficient = Number(argv[++i]);
    else if (arg === "--edl-disable-sufficiency-assessment") options.edlDisableSufficiencyAssessment = true;
    else if (arg === "--edl-disable-citation-validation") options.edlDisableCitationValidation = true;
    else if (arg === "--edl-citation-self-check") options.edlCitationSelfCheck = true;
    else if (arg === "--edl-max-citation-self-check-rounds") options.edlMaxCitationSelfCheckRounds = Number(argv[++i]);
    else if (arg === "--edl-source-aware-query-planning") options.edlSourceAwareQueryPlanning = argv[++i];
    else if (arg === "--check") options.check = true;
    else if (arg === "--resume") options.resume = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function writeJsonl(filePath, rows) {
  fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

function readJsonlIfExists(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function appendJsonl(filePath, row) {
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`);
}

function traceKey(trace) {
  return `${trace.recordId}\t${trace.method}`;
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row[key])) groups.set(row[key], []);
    groups.get(row[key]).push(row);
  }
  return groups;
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageNullable(values) {
  const numeric = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (numeric.length === 0) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fmt(value) {
  if (value === null || value === undefined) return "n/a";
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

function fmtCounts(counts) {
  if (!counts || Object.keys(counts).length === 0) return "n/a";
  return Object.entries(counts).map(([key, value]) => `${key}:${value}`).join(", ");
}

function resolveTimeoutMs(value) {
  if (value === undefined) return 60000;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("--timeout-ms must be positive");
  return parsed;
}

function normalizeReasoningEffort(value) {
  if (!value) return null;
  if (!["low", "medium", "high"].includes(value)) {
    throw new Error("--reasoning-effort must be one of low, medium, high");
  }
  return value;
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

function validatePositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${kebabCase(name)} must be a positive integer`);
  }
}

function validateNonNegativeInteger(name, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${kebabCase(name)} must be a non-negative integer`);
  }
}

function validateSearchMode(name, value) {
  if (!["token_overlap", "token_overlap_neighbors", "bm25", "bm25_neighbors"].includes(value)) {
    throw new Error(`--${kebabCase(name)} must be one of token_overlap, token_overlap_neighbors, bm25, bm25_neighbors`);
  }
}

function kebabCase(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

module.exports = {
  runLiveComparisonV4,
  parseArgs,
  parseMethods,
  selectRecords,
};
