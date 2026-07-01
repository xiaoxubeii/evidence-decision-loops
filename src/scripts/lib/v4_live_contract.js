"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const promptDir = path.join(repoRoot, "src", "prompts");
const v4AgentOutputSchemaPath = path.join(repoRoot, "src", "schema", "react-clinical-source-v4-agent-output.schema.json");
const basePromptPath = path.join(promptDir, "v4_evidence_verification_base.md");
const methodPromptPaths = Object.freeze({
  direct: path.join(promptDir, "v4_method_direct.md"),
  cot: path.join(promptDir, "v4_method_cot.md"),
  react: path.join(promptDir, "v4_method_react.md"),
  edl: path.join(promptDir, "v4_method_edl.md"),
});
const V4_SETTINGS = Object.freeze(["frozen-evidence", "evidence-seeking"]);

function buildV4LivePrompt(record, options = {}) {
  const messages = buildV4PromptMessages(record, options);
  return messages.map((message) => message.content).join("\n\n");
}

function buildV4PromptMessages(record, options = {}) {
  assertRecord(record);
  const method = options.method || "direct";
  const setting = normalizeV4Setting(options.setting);
  const basePrompt = readPromptFile(basePromptPath);
  const methodPrompt = readMethodPrompt(method);
  return [
    { role: "system", content: basePrompt },
    { role: "user", content: [methodPrompt, buildV4RecordPrompt(record, { method, setting })].join("\n\n") },
  ];
}

function buildV4RecordPrompt(record, options = {}) {
  const taskLabel = record.task.type === "question_answering" ? "Question" : "Statement";
  const setting = normalizeV4Setting(options.setting);
  const lines = [
    "You are evaluating one frozen V4 benchmark record.",
    `Record ID: ${record.id}`,
    `Source: ${record.source}`,
    `Task type: ${record.task.type}`,
    `Setting: ${setting}`,
    `${taskLabel}: ${record.task.input}`,
    "",
    "Allowed final decisions for this record:",
    JSON.stringify(record.allowedDecisions),
    "",
    "Allowed citation set for this record:",
    ...formatAllowedCitationSet(record),
    "",
    "Final answer JSON skeleton:",
    buildFinalAnswerSkeleton(),
  ];
  if (setting === "frozen-evidence") {
    lines.push("", "Frozen documents", JSON.stringify(record.documents, null, 2));
  } else {
    lines.push(
      "",
      "Evidence text is not provided upfront in this setting.",
      "Use search_segments before read_segment.",
      "Use read_segment to inspect full frozen segment text.",
      "Continue searching if the viewed segments are insufficient to justify a decision.",
    );
  }
  return lines.join("\n");
}

function formatAllowedCitationSet(record) {
  return (record.documents || []).flatMap((document) => (
    (document.segments || []).map((segment) => (
      `- ${document.documentId} / ${segment.segmentId}`
    ))
  ));
}

function buildFinalAnswerSkeleton() {
  return JSON.stringify({
    decision: "<one allowed decision>",
    citedEvidence: [
      { documentId: "<documentId>", segmentId: "<segmentId>" },
    ],
    rationale: "<brief evidence-based rationale>",
  }, null, 2);
}

function readMethodPrompt(method) {
  const promptPath = methodPromptPaths[method];
  if (!promptPath) throw new Error(`unknown V4 method protocol: ${method}`);
  return readPromptFile(promptPath);
}

function readPromptFile(promptPath) {
  return fs.readFileSync(promptPath, "utf8").trim();
}

function normalizeV4Setting(value) {
  const setting = value || "frozen-evidence";
  if (!V4_SETTINGS.includes(setting)) throw new Error(`unknown V4 setting: ${setting}`);
  return setting;
}

function buildV4LiveToolSpecs() {
  const agentOutputSchema = buildV4AgentOutputSchema();
  return [
    {
      name: "search_segments",
      description: "Search frozen benchmark segments for the current V4 record. Returns segment metadata and short snippets only.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: {
          query: { type: "string", minLength: 1 },
          cursor: { type: "string", minLength: 1 },
          topK: { type: "integer", minimum: 1, maximum: 10 },
        },
      },
    },
    {
      name: "read_segment",
      description: "Read the full frozen text for one segment from the current V4 record.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["documentId", "segmentId"],
        properties: {
          documentId: { type: "string", minLength: 1 },
          segmentId: { type: "string", minLength: 1 },
        },
      },
    },
    {
      name: "submit_decision",
      description: "Submit the source-native decision and cited evidence for the current V4 record.",
      inputSchema: agentOutputSchema,
    },
  ];
}

function buildV4AgentOutputSchema() {
  const schema = JSON.parse(fs.readFileSync(v4AgentOutputSchemaPath, "utf8"));
  return {
    type: schema.type,
    additionalProperties: schema.additionalProperties,
    required: [...schema.required],
    properties: cloneJson(schema.properties),
  };
}

function listV4Documents(record) {
  assertRecord(record);
  return record.documents.map((document) => ({
    documentId: document.documentId,
    segmentCount: document.segments.length,
  }));
}

function readV4Document(record, documentId) {
  assertRecord(record);
  const document = record.documents.find((candidate) => candidate.documentId === documentId);
  if (!document) throw new Error(`unknown documentId: ${documentId}`);
  return {
    documentId: document.documentId,
    segments: document.segments.map((segment) => ({ ...segment })),
  };
}

function parseV4AgentOutput(rawOutput) {
  const parsed = typeof rawOutput === "string" ? parseJsonText(rawOutput) : rawOutput;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("agent output must be a JSON object");
  }
  if (typeof parsed.decision !== "string" || parsed.decision.length === 0) {
    throw new Error("decision must be a non-empty string");
  }
  if (!Array.isArray(parsed.citedEvidence)) {
    throw new Error("citedEvidence must be an array");
  }
  const citationParseErrors = [];
  const citedEvidence = [];
  for (const [index, citation] of parsed.citedEvidence.entries()) {
    const normalizedCitation = normalizeCitation(citation, index);
    if (normalizedCitation.error) {
      citationParseErrors.push(normalizedCitation.error);
    } else {
      citedEvidence.push(normalizedCitation.citation);
    }
  }
  const normalized = {
    decision: parsed.decision,
    citedEvidence,
  };
  if (citationParseErrors.length > 0) {
    normalized.citationParseErrors = citationParseErrors;
  }
  if (typeof parsed.rationale === "string") {
    normalized.rationale = parsed.rationale;
  }
  return normalized;
}

function parseJsonText(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`agent output must be JSON: ${error.message}`);
  }
}

function normalizeCitation(citation, index) {
  if (!citation || typeof citation !== "object" || Array.isArray(citation)) {
    return { error: `citation_${index}_not_object` };
  }
  if (typeof citation.documentId !== "string" || citation.documentId.length === 0) {
    return { error: `citation_${index}_missing_documentId` };
  }
  if (typeof citation.segmentId !== "string" || citation.segmentId.length === 0) {
    return { error: `citation_${index}_missing_segmentId` };
  }
  return { citation: { documentId: citation.documentId, segmentId: citation.segmentId } };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertRecord(record) {
  if (!record || typeof record !== "object") throw new Error("record must be an object");
  if (!record.task || typeof record.task.input !== "string" || typeof record.task.type !== "string") {
    throw new Error("record.task must include type and input");
  }
  if (!Array.isArray(record.allowedDecisions) || record.allowedDecisions.length === 0) {
    throw new Error("record.allowedDecisions must be a non-empty array");
  }
  if (!Array.isArray(record.documents)) throw new Error("record.documents must be an array");
}

module.exports = {
  V4_SETTINGS,
  buildV4LivePrompt,
  buildV4PromptMessages,
  buildV4AgentOutputSchema,
  buildV4LiveToolSpecs,
  normalizeV4Setting,
  listV4Documents,
  readV4Document,
  parseV4AgentOutput,
};
