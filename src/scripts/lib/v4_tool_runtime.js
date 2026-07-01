"use strict";

const { buildV4AgentOutputSchema } = require("./v4_live_contract");
const { scoreV4Output } = require("./v4_source_scorer");

const DEFAULT_FORCED_SUBMIT_INSTRUCTION = [
  "Tool budget exhausted.",
  "Do not search or read more evidence.",
  "You must now call submit_decision.",
  "Use only evidence already read in the transcript.",
  "Cite segment ids exactly as seen.",
  "If evidence is incomplete, submit the best supported decision and explain uncertainty in rationale.",
].join("\n");

function buildV4ToolRuntime(record, options = {}) {
  const documents = Array.isArray(record.documents) ? record.documents : [];
  const documentsById = new Map(documents.map((document) => [document.documentId, document]));
  const segments = flattenSegments(record);
  const segmentsByKey = new Map(segments.map((segment) => [segmentKey(segment.documentId, segment.segmentId), segment]));
  const returnedSegmentKeys = new Set();
  const readSegmentKeys = new Set();
  const defaultTopK = options.defaultTopK || 3;
  const forceTopK = Boolean(options.forceTopK);
  const submitRequirements = options.submitRequirements || {};
  const searchMode = options.searchMode || "token_overlap";
  if (!["token_overlap", "bm25", "token_overlap_neighbors", "bm25_neighbors"].includes(searchMode)) {
    throw new Error(`unknown_search_mode: ${searchMode}`);
  }
  const events = [];
  let submittedDecision;

  async function run(name, payload = {}) {
    if (name === "list_documents") {
      events.push({ type: "action", action: "list_documents", input: {}, content: "list_documents" });
      return {
        documents: documents.map((document) => ({
          documentId: document.documentId,
          title: document.title || "",
          sourceType: document.sourceType || record.source || "",
          segmentCount: Array.isArray(document.segments) ? document.segments.length : 0,
        })),
      };
    }

    if (name === "read_document") {
      const documentId = payload.documentId || payload.document_id;
      const input = { documentId };
      events.push({ type: "action", action: "read_document", input, content: "read_document" });
      const document = documentsById.get(documentId);
      if (!document) return { error: "document_not_found", documentId };
      return {
        documentId: document.documentId,
        title: document.title || "",
        segments: (document.segments || []).map((segment) => ({ ...segment })),
      };
    }

    if (name === "search_segments") {
      const query = String(payload.query || "").trim();
      const section = normalizeSectionFilter(payload.section);
      const topK = forceTopK ? defaultTopK : (positiveInt(payload.topK) || defaultTopK);
      const offset = decodeCursor(payload.cursor);
      if (!query) return { error: "missing_query", segments: [], hasMore: false };
      const searchableSegments = section
        ? segments.filter((segment) => sectionMatches(segment.section, section))
        : segments;
      const rankedBase = rankSegments(searchableSegments, query, { searchMode });
      const ranked = searchMode === "token_overlap_neighbors" || searchMode === "bm25_neighbors"
        ? expandRankedNeighbors(rankedBase, searchableSegments)
        : rankedBase;
      const hasCursor = Boolean(payload.cursor);
      const candidates = hasCursor
        ? ranked.slice(offset).filter((segment) => !returnedSegmentKeys.has(segmentKey(segment.documentId, segment.segmentId)))
        : ranked.filter((segment) => !returnedSegmentKeys.has(segmentKey(segment.documentId, segment.segmentId)));
      const skippedSeen = ranked.length - candidates.length;
      const page = candidates.slice(0, topK);
      const nextOffset = offset + page.length;
      const hasMore = page.length > 0 && (hasCursor ? nextOffset < ranked.length : topK < candidates.length);
      const returned = page.map((segment) => segmentKey(segment.documentId, segment.segmentId));
      for (const key of returned) returnedSegmentKeys.add(key);
      events.push({
        type: "action",
        action: "search_segments",
        input: { query, cursor: payload.cursor, topK, searchMode, ...(section ? { section } : {}) },
        returned,
        skippedSeen,
        content: "search_segments",
      });
      return {
        segments: page.map((segment) => ({
          documentId: segment.documentId,
          segmentId: segment.segmentId,
          index: segment.index,
          section: segment.section || "",
          snippet: snippet(segment.text),
          score: segment.score,
        })),
        nextCursor: hasMore ? encodeCursor(nextOffset) : null,
        hasMore,
      };
    }

    if (name === "read_segment") {
      const documentId = payload.documentId || payload.document_id;
      const segmentId = payload.segmentId || payload.segment_id;
      const input = { documentId, segmentId };
      events.push({ type: "action", action: "read_segment", input, content: "read_segment" });
      const segment = segmentsByKey.get(segmentKey(documentId, segmentId));
      if (!segment) return { error: "segment_not_found", documentId, segmentId };
      readSegmentKeys.add(segmentKey(segment.documentId, segment.segmentId));
      return {
        documentId: segment.documentId,
        segmentId: segment.segmentId,
        index: segment.index,
        section: segment.section || "",
        text: segment.text,
      };
    }

    if (name === "submit_decision") {
      events.push({ type: "action", action: "submit_decision", input: payload, content: "submit_decision" });
      submittedDecision = normalizeSubmittedDecision(payload);
      const scores = scoreV4Output(record, submittedDecision);
      const processErrors = submitRequirementErrors(events, readSegmentKeys, submitRequirements);
      const contractErrors = validationErrors(scores);
      const errors = [...processErrors, ...contractErrors];
      return {
        accepted: errors.length === 0,
        retryable: processErrors.length > 0 && contractErrors.length === 0,
        errors,
        process: {
          searchCalls: events.filter((event) => event.action === "search_segments").length,
          readSegments: readSegmentKeys.size,
        },
        scores,
      };
    }

    return { error: "unknown_tool", name };
  }

  return {
    recordId: record.id,
    tools: buildResponsesToolSpecs(options),
    run,
    getEvents: () => events.slice(),
    getSubmittedDecision: () => submittedDecision,
  };
}

function buildResponsesToolSpecs(options = {}) {
  const tools = [
    {
      type: "function",
      name: "search_segments",
      description: "Search frozen benchmark segments for this record. Returns segment metadata and short snippets only.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: {
          query: { type: "string", minLength: 1 },
          section: { type: "string", minLength: 1 },
          cursor: { type: "string", minLength: 1 },
          topK: { type: "integer", minimum: 1, maximum: 10 },
        },
      },
    },
    {
      type: "function",
      name: "read_segment",
      description: "Read the full frozen text for one segment.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["documentId", "segmentId"],
        properties: {
          documentId: { type: "string", minLength: 1 },
          segmentId: { type: "string", minLength: 1 },
        },
      },
    },
  ];

  if (options.includeSubmitDecision !== false) {
    tools.push({
      type: "function",
      name: "submit_decision",
      description: "Submit the final V4 benchmark decision and segment-level citations.",
      parameters: buildV4AgentOutputSchema(),
    });
  }

  return tools;
}

function flattenSegments(record) {
  return (record.documents || []).flatMap((document) => (
    (document.segments || []).map((segment) => ({
      documentId: document.documentId,
      title: document.title || "",
      segmentId: segment.segmentId,
      index: segment.index,
      section: segment.section || "",
      text: segment.text || "",
    }))
  ));
}

function rankSegments(segments, query, options = {}) {
  const queryTokens = tokenize(query);
  const scored = options.searchMode === "bm25" || options.searchMode === "bm25_neighbors"
    ? rankSegmentsBm25(segments, queryTokens)
    : segments.map((segment) => ({ ...segment, score: scoreSegment(segment, queryTokens) }));
  return scored.sort(compareRankedSegments);
}

function rankSegmentsBm25(segments, queryTokens) {
  const tokenized = segments.map((segment) => ({ ...segment, tokens: tokenize(segment.text) }));
  const avgLength = tokenized.reduce((sum, segment) => sum + segment.tokens.length, 0) / Math.max(1, tokenized.length);
  const documentFrequency = new Map();
  for (const token of new Set(queryTokens)) {
    documentFrequency.set(token, tokenized.filter((segment) => new Set(segment.tokens).has(token)).length);
  }
  return tokenized.map((segment) => {
    const frequencies = countBy(segment.tokens);
    const score = queryTokens.reduce((sum, token) => {
      const tf = frequencies[token] || 0;
      if (tf === 0) return sum;
      const df = documentFrequency.get(token) || 0;
      const idf = Math.log(1 + (tokenized.length - df + 0.5) / (df + 0.5));
      const k1 = 1.2;
      const b = 0.75;
      return sum + idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (segment.tokens.length / avgLength))));
    }, 0);
    return { ...segment, score };
  });
}

function compareRankedSegments(left, right) {
  if (right.score !== left.score) return right.score - left.score;
  if (left.documentId !== right.documentId) return left.documentId.localeCompare(right.documentId);
  return Number(left.index || 0) - Number(right.index || 0);
}

function expandRankedNeighbors(ranked, segments) {
  const byKey = new Map(segments.map((segment) => [segmentKey(segment.documentId, segment.segmentId), segment]));
  const byDocumentIndex = new Map(segments.map((segment) => [`${segment.documentId}\t${segment.index}`, segment]));
  const expanded = [];
  const seen = new Set();
  for (const segment of ranked) {
    for (const candidate of [
      segment,
      byDocumentIndex.get(`${segment.documentId}\t${Number(segment.index || 0) - 1}`),
      byDocumentIndex.get(`${segment.documentId}\t${Number(segment.index || 0) + 1}`),
    ]) {
      if (!candidate) continue;
      const key = segmentKey(candidate.documentId, candidate.segmentId);
      if (seen.has(key) || !byKey.has(key)) continue;
      seen.add(key);
      expanded.push({ ...candidate, score: segment.score });
    }
  }
  return expanded;
}

function scoreSegment(segment, queryTokens) {
  const textTokens = new Set(tokenize(segment.text));
  return queryTokens.reduce((score, token) => score + (textTokens.has(token) ? 1 : 0), 0);
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function segmentKey(documentId, segmentId) {
  return `${documentId}\t${segmentId}`;
}

function encodeCursor(offset) {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return Number.isInteger(parsed.offset) && parsed.offset >= 0 ? parsed.offset : 0;
  } catch (_error) {
    return 0;
  }
}

function positiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeSectionFilter(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sectionMatches(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function snippet(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized.length > 32 ? `${normalized.slice(0, 29)}...` : normalized;
}

async function runV4ResponsesToolLoop(input) {
  const runtime = input.runtime || buildV4ToolRuntime(input.record);
  const maxToolSteps = input.maxToolSteps || 8;
  const conversationContext = messagesToResponsesInput(input.messages);
  let response = await input.client.responses.create(withReasoning({
    model: input.modelName,
    input: conversationContext,
    tools: runtime.tools,
  }, input.reasoningEffort));

  for (let step = 0; step < maxToolSteps; step += 1) {
    const calls = extractResponseFunctionCalls(response);
    appendResponseOutput(conversationContext, response);
    if (calls.length === 0) return buildToolLoopResult(response, runtime);

    const callOutputs = [];
    for (const call of calls) {
      const output = await runtime.run(call.name, parseToolArguments(call.arguments));
      callOutputs.push({ call, output });
      conversationContext.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(output),
      });
    }
    if (calls.some((call) => call.name === "submit_decision")) {
      const submitOutputs = callOutputs.filter(({ call }) => call.name === "submit_decision");
      const mayStop = submitOutputs.some(({ output }) => output.accepted || !output.retryable);
      if (mayStop) return buildToolLoopResult(response, runtime);
    }

    response = await input.client.responses.create(withReasoning({
      model: input.modelName,
      input: conversationContext,
      tools: runtime.tools,
    }, input.reasoningEffort));
  }

  if (input.forceSubmitOnMaxToolSteps) {
    const forced = await forceSubmitDecision({
      client: input.client,
      modelName: input.modelName,
      conversationContext,
      runtime,
      reasoningEffort: input.reasoningEffort,
      instruction: input.forcedSubmitInstruction,
    });
    if (forced.output) {
      return {
        ...forced,
        toolBudgetExhausted: true,
        forcedSubmit: true,
      };
    }
  }

  const result = buildToolLoopResult(response, runtime);
  return {
    ...result,
    parseError: "max_tool_steps_exceeded",
    toolBudgetExhausted: true,
    forcedSubmit: false,
  };
}

async function forceSubmitDecision(input) {
  const forcedContext = [
    ...input.conversationContext,
    {
      role: "user",
      content: input.instruction || DEFAULT_FORCED_SUBMIT_INSTRUCTION,
    },
  ];
  const response = await input.client.responses.create(withReasoning({
    model: input.modelName,
    input: forcedContext,
    tools: submitDecisionOnlyTools(input.runtime),
  }, input.reasoningEffort));
  const calls = extractResponseFunctionCalls(response);
  for (const call of calls.filter((candidate) => candidate.name === "submit_decision")) {
    await input.runtime.run(call.name, parseToolArguments(call.arguments));
  }
  return buildToolLoopResult(response, input.runtime);
}

function submitDecisionOnlyTools(runtime) {
  return runtime.tools.filter((tool) => tool.name === "submit_decision");
}

function messagesToResponsesInput(messages) {
  return (messages || []).map((message) => ({
    role: message.role,
    content: message.content,
  }));
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

function appendResponseOutput(conversationContext, response) {
  for (const item of response.output || []) {
    const replayItem = toConversationContextItem(item);
    if (replayItem) conversationContext.push(replayItem);
  }
}

function toConversationContextItem(item) {
  if (!item || typeof item !== "object") return null;
  if (item.type === "function_call") {
    return {
      type: "function_call",
      call_id: item.call_id,
      name: item.name,
      arguments: item.arguments,
    };
  }
  if (item.type === "message") {
    return {
      type: "message",
      role: item.role || "assistant",
      content: item.content || [],
    };
  }
  return null;
}

function buildToolLoopResult(response, runtime) {
  return {
    rawText: extractResponsesText(response),
    output: runtime.getSubmittedDecision(),
    steps: runtime.getEvents(),
    rawResponse: summarizeResponse(response),
    toolTranscriptMode: "stateless_context_replay",
    toolBudgetExhausted: false,
    forcedSubmit: false,
  };
}

function extractResponseFunctionCalls(response) {
  return (response.output || []).filter((item) => item.type === "function_call");
}

function parseToolArguments(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  return JSON.parse(value);
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

function normalizeSubmittedDecision(payload) {
  return {
    decision: typeof payload.decision === "string" ? payload.decision : "",
    citedEvidence: Array.isArray(payload.citedEvidence) ? payload.citedEvidence : [],
    ...(typeof payload.rationale === "string" ? { rationale: payload.rationale } : {}),
  };
}

function validationErrors(scores) {
  const errors = [];
  if (scores.invalidDecision) errors.push("invalid_decision");
  return errors.concat(scores.citationErrors || []);
}

function submitRequirementErrors(events, readSegmentKeys, requirements = {}) {
  const errors = [];
  const minSearchCalls = positiveInt(requirements.minSearchCalls);
  const minReadSegments = positiveInt(requirements.minReadSegments);
  const searchCalls = events.filter((event) => event.action === "search_segments").length;
  if (minSearchCalls && searchCalls < minSearchCalls) errors.push("insufficient_process_search_calls");
  if (minReadSegments && readSegmentKeys.size < minReadSegments) errors.push("insufficient_process_read_segments");
  return errors;
}

module.exports = {
  buildV4ToolRuntime,
  buildResponsesToolSpecs,
  runV4ResponsesToolLoop,
  extractResponseFunctionCalls,
  parseToolArguments,
  extractResponsesText,
  summarizeResponse,
};
