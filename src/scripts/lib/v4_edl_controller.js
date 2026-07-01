"use strict";

const { buildV4ToolRuntime } = require("./v4_tool_runtime");
const { scoreV4Output } = require("./v4_source_scorer");

function buildV4EdlPrompt(record) {
  return buildV4EdlSubmitPrompt(record, []);
}

function buildV4EdlAssessPrompt(record, viewedSegments) {
  return [
    "V4 EDL evidence sufficiency assessment.",
    `Record ID: ${record.id}`,
    `Source: ${record.source}`,
    `Task type: ${record.task.type}`,
    `Input: ${record.task.input}`,
    `allowed decisions: ${(record.allowedDecisions || []).join(", ")}`,
    "Decide whether the viewed frozen segments are sufficient, insufficient, or conflicting.",
    "If you have not located the key segment-level evidence, return insufficient with a concrete nextQuery.",
    "Do not mark evidence sufficient only because a segment is generally related.",
    "Prefer nextQuery terms that target missing outcomes, interventions, populations, comparisons, or statistical results.",
    sourceAwareQueryGuidance(record),
    "If insufficient, provide nextQuery.",
    "Return JSON only with keys: sufficiency, nextQuery, rationale.",
    `Viewed segments: ${JSON.stringify(viewedSegments)}`,
  ].join("\n");
}

function buildV4EdlSubmitPrompt(record, viewedSegments, options = {}) {
  const outputRule = options.disableSufficiencyAssessment
    ? "Return JSON only with keys: decision, citedEvidence, rationale."
    : "Return JSON only with keys: decision, citedEvidence, rationale, evidenceAssessments, gapAssessment, conflictAssessment.";
  const citationRule = options.disableCitationValidation
    ? "Citation validation is disabled for this ablation: citedEvidence may use free-form provenance strings or IDs that are not hard-validated against the viewed segment IDs."
    : "Every citedEvidence item must contain documentId and segmentId.";
  return [
    "V4 EDL controller final decision.",
    `Record ID: ${record.id}`,
    `Source: ${record.source}`,
    `Task type: ${record.task.type}`,
    `Input: ${record.task.input}`,
    `allowed decisions: ${(record.allowedDecisions || []).join(", ")}`,
    outputRule,
    citationRule,
    options.disableSufficiencyAssessment
      ? ""
      : "gapAssessment must be an object with hasMaterialGap boolean and reason string; conflictAssessment must be an object with hasConflict boolean and reason string.",
    sourceAwareCoverageGuidance(record),
    `Viewed segments: ${JSON.stringify(viewedSegments)}`,
  ].filter(Boolean).join("\n");
}

function buildV4EdlCitationSelfCheckPrompt(record, viewedSegments, draftPayload) {
  return [
    "V4 EDL citation self-check.",
    `Record ID: ${record.id}`,
    `Source: ${record.source}`,
    `Task type: ${record.task.type}`,
    `Input: ${record.task.input}`,
    `allowed decisions: ${(record.allowedDecisions || []).join(", ")}`,
    "Check whether every draft citedEvidence item is supported by the viewed segment text and is specific enough for the claim.",
    "Do not use hidden gold labels or requiredEvidence; use only the viewed segments and draft payload.",
    "If citations do not locate the key segment-level evidence, return needs_more_evidence with a concrete nextQuery.",
    sourceAwareCoverageGuidance(record),
    "Return JSON only with keys: status, nextQuery, rationale, problematicCitations.",
    `Viewed segments: ${JSON.stringify(viewedSegments)}`,
    `Draft payload: ${JSON.stringify(draftPayload)}`,
  ].join("\n");
}

function buildV4EdlQueryPlanPrompt(record) {
  return [
    "V4 EDL source-aware search query planning.",
    `Record ID: ${record.id}`,
    `Source: ${record.source}`,
    `Task type: ${record.task.type}`,
    `Input: ${record.task.input}`,
    sourceAwareQueryGuidance(record),
    "For section-aware sources, include section when one source section is clearly implied.",
    "Return JSON only with keys: query, section, rationale.",
  ].filter(Boolean).join("\n");
}

function sourceAwareQueryGuidance(record) {
  const source = String(record.source || "").toLowerCase();
  if (source === "nli4ct") {
    return [
      "For NLI4CT, trial report segments are grouped by section: Intervention, Eligibility, Results, Adverse Events.",
      "Choose the most likely section from the claim when possible, and keep query terms likely to appear in that section.",
      "Use Results for outcomes, measurements, survival, rates, arm results, and units of measure.",
      "Use Eligibility for inclusion criteria, exclusion criteria, disease characteristics, diagnosis, and prior therapy.",
      "Use Intervention for treatment arms, drugs, doses, regimens, and procedures.",
      "Use Adverse Events for adverse events, toxicities, serious events, deaths, and event rates.",
    ].join(" ");
  }
  if (source !== "scifact") return "";
  return [
    "For SciFact, prefer compact query terms that preserve biomedical entity names, exposure or intervention terms, population terms, outcome terms, directionality or comparison terms, and statistical/result terms when present.",
    "Avoid broad filler words; keep terms likely to appear in the evidence segment.",
  ].join(" ");
}

function sourceAwareCoverageGuidance(record) {
  if (String(record.source || "").toLowerCase() !== "nli4ct") return "";
  return [
    "For NLI4CT comparison claims, citations should cover all trial sections, arms, cohorts, outcomes, or adverse-event groups needed to verify the comparison.",
    "Raw-line NLI4CT evidence may include context/header rows such as Inclusion Criteria, Exclusion Criteria, DISEASE CHARACTERISTICS, Outcome Measurement, Unit of Measure, or [Not Specified].",
    "If a content row depends on an adjacent context/header row, cite both the content row and the context/header row.",
    "If only one side of a comparison has been located, request more evidence.",
  ].join(" ");
}

function buildV4EdlRepairPrompt(record, previousPayload, validation, options = {}) {
  const outputRule = options.disableSufficiencyAssessment
    ? "Return JSON only with decision, citedEvidence, rationale."
    : "Return JSON only with decision, citedEvidence, rationale, evidenceAssessments, gapAssessment, conflictAssessment.";
  const citationRule = options.disableCitationValidation
    ? "Citation validation is disabled for this ablation: do not repair solely because citedEvidence IDs are missing, free-form, or not in the frozen evidence package."
    : "Every citedEvidence item must contain documentId and segmentId.";
  return [
    "Repair the V4 EDL output so it satisfies the benchmark contract.",
    `Record ID: ${record.id}`,
    `allowed decisions: ${(record.allowedDecisions || []).join(", ")}`,
    `validation errors: ${(validation.errors || []).join(", ")}`,
    outputRule,
    citationRule,
    options.disableSufficiencyAssessment
      ? ""
      : "gapAssessment must be an object with hasMaterialGap boolean and reason string; conflictAssessment must be an object with hasConflict boolean and reason string.",
    `Previous output: ${JSON.stringify(previousPayload)}`,
  ].filter(Boolean).join("\n");
}

function normalizeV4EdlArtifact(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    decision: typeof input.decision === "string" ? input.decision : "",
    citedEvidence: Array.isArray(input.citedEvidence) ? input.citedEvidence.map(normalizeCitation) : [],
    rationale: typeof input.rationale === "string" ? input.rationale : "",
    evidenceAssessments: Array.isArray(input.evidenceAssessments) ? input.evidenceAssessments.map(normalizeEvidenceAssessment) : [],
    gapAssessment: normalizeGapAssessment(input.gapAssessment),
    conflictAssessment: normalizeConflictAssessment(input.conflictAssessment),
  };
}

function normalizeCitation(citation) {
  return {
    documentId: citation && typeof citation.documentId === "string" ? citation.documentId : "",
    segmentId: citation && typeof citation.segmentId === "string" ? citation.segmentId : "",
  };
}

function normalizeEvidenceAssessment(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    documentId: typeof input.documentId === "string" ? input.documentId : "",
    segmentId: typeof input.segmentId === "string" ? input.segmentId : "",
    stance: typeof input.stance === "string" ? input.stance : "",
    rationale: typeof input.rationale === "string" ? input.rationale : "",
  };
}

function normalizeGapAssessment(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      hasMaterialGap: value.hasMaterialGap === true,
      reason: typeof value.reason === "string" ? value.reason : "",
    };
  }
  return {
    hasMaterialGap: false,
    reason: typeof value === "string" ? value : "",
  };
}

function normalizeConflictAssessment(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      hasConflict: value.hasConflict === true,
      reason: typeof value.reason === "string" ? value.reason : "",
    };
  }
  return {
    hasConflict: false,
    reason: typeof value === "string" ? value : "",
  };
}

function validateV4EdlArtifact(record, artifactValue, options = {}) {
  const artifact = normalizeV4EdlArtifact(artifactValue);
  const scores = scoreV4Output(record, artifact);
  const errors = [];
  if (scores.invalidDecision) errors.push("invalid_decision");
  if (!options.disableCitationValidation) errors.push(...(scores.citationErrors || []));
  return {
    valid: errors.length === 0,
    errors,
    scores,
    citationValidationDisabled: Boolean(options.disableCitationValidation),
  };
}

function formatJsonParseError(prefix, error) {
  const message = error instanceof Error ? error.message : String(error);
  return `${prefix}:${message}`.slice(0, 220);
}

function parseJsonTextResult(value, prefix) {
  try {
    return { value: parseJsonText(value) };
  } catch (error) {
    return { parseError: formatJsonParseError(prefix, error) };
  }
}

function appendParseErrorStep(action, parseError, controllerSteps, orderedSteps) {
  const step = {
    type: "action",
    action,
    input: { parseError },
    content: action,
  };
  controllerSteps.push(step);
  orderedSteps.push(step);
}

function buildParseErrorResult(input, state) {
  appendParseErrorStep(state.action, state.parseError, state.controllerSteps, state.orderedSteps);
  const validation = validateV4EdlArtifact(input.record, state.payload, {
    disableCitationValidation: Boolean(input.disableCitationValidation),
  });
  return {
    rawText: state.rawText,
    payload: state.payload,
    validation: {
      ...validation,
      valid: false,
      errors: [state.parseError, ...validation.errors],
    },
    parseError: state.parseError,
    toolEvents: state.runtime.getEvents(),
    controllerSteps: state.controllerSteps,
    orderedSteps: state.orderedSteps,
    viewedSegments: state.viewedSegments,
    assessment: state.assessment || null,
    assessments: state.assessments || [],
  };
}

async function runV4EdlController(input) {
  const runtime = input.runtime || buildV4ToolRuntime(input.record, {
    searchMode: input.searchMode || "token_overlap",
  });
  const controllerSteps = [];
  const orderedSteps = [];
  const viewedSegments = Array.isArray(input.initialViewedSegments)
    ? input.initialViewedSegments.map((segment) => ({ ...segment }))
    : [];
  const assessments = [];
  let latestAssessment = null;
  let searchState = buildSearchState(input.record, input.sourceAwareQueryPlanning || "off", input.record.task.input);
  const maxEvidenceRounds = input.maxEvidenceRounds || 3;
  const disableSufficiencyAssessment = Boolean(input.disableSufficiencyAssessment);
  const disableCitationValidation = Boolean(input.disableCitationValidation);
  const promptOptions = { disableSufficiencyAssessment, disableCitationValidation };
  const minEvidenceRounds = Math.max(1, input.minEvidenceRounds || 1);
  const minViewedSegmentsBeforeSufficient = Math.max(0, input.minViewedSegmentsBeforeSufficient || 0);
  const defaultTopK = input.defaultTopK || 2;
  const escalateTopKOnInsufficient = input.escalateTopKOnInsufficient || null;
  const sourceAwareQueryPlanning = input.sourceAwareQueryPlanning || "off";
  let nextSearchTopK = defaultTopK;
  let emittedToolEvents = 0;
  const appendNewToolEvents = () => {
    const events = runtime.getEvents();
    orderedSteps.push(...events.slice(emittedToolEvents));
    emittedToolEvents = events.length;
  };
  const searchAndRead = async (state, topK) => {
    const searchResult = await runtime.run("search_segments", {
      query: state.query,
      topK,
      ...(state.section ? { section: state.section } : {}),
    });
    for (const segment of searchResult.segments || []) {
      const full = await runtime.run("read_segment", {
        documentId: segment.documentId,
        segmentId: segment.segmentId,
      });
      const alreadyViewed = viewedSegments.some((seen) => (
        seen.documentId === full.documentId && seen.segmentId === full.segmentId
      ));
      if (!full.error && !alreadyViewed) viewedSegments.push(full);
    }
    appendNewToolEvents();
  };
  const assessEvidence = async () => {
    const assessmentRaw = await input.invokeModel({
      phase: "assess",
      prompt: buildV4EdlAssessPrompt(input.record, viewedSegments),
      record: stripGoldFields(input.record),
      viewedSegments,
      toolEvents: runtime.getEvents(),
    });
    const parsed = parseJsonTextResult(assessmentRaw, "assess_parse_error");
    const assessment = normalizeSufficiencyAssessment(parsed.parseError
      ? { sufficiency: "insufficient", rationale: parsed.parseError }
      : parsed.value);
    if (parsed.parseError) assessment.parseError = parsed.parseError;
    latestAssessment = assessment;
    assessments.push(assessment);
    const assessmentStep = { type: "action", action: "assess_evidence", input: assessment, content: "assess_evidence" };
    controllerSteps.push(assessmentStep);
    orderedSteps.push(assessmentStep);
    return assessment;
  };
  const draftSubmission = async () => {
    const rawText = await input.invokeModel({
      phase: "submit",
      prompt: buildV4EdlSubmitPrompt(input.record, viewedSegments, promptOptions),
      record: stripGoldFields(input.record),
      viewedSegments,
      toolEvents: runtime.getEvents(),
    });
    const parsed = parseJsonTextResult(rawText, "submit_parse_error");
    if (parsed.parseError) {
      return {
        rawText,
        payload: normalizeV4EdlArtifact({}),
        parseError: parsed.parseError,
      };
    }
    return {
      rawText,
      payload: normalizeV4EdlArtifact(parsed.value),
    };
  };
  if (!input.skipEvidenceSearch && shouldPlanSourceAwareQuery(input.record, sourceAwareQueryPlanning)) {
    let plan;
    try {
      const planRaw = await input.invokeModel({
        phase: "plan_query",
        prompt: buildV4EdlQueryPlanPrompt(input.record),
        record: stripGoldFields(input.record),
        toolEvents: runtime.getEvents(),
      });
      plan = normalizeQueryPlan(parseJsonText(planRaw));
      if (plan.query || plan.section) {
        searchState = buildSearchState(input.record, sourceAwareQueryPlanning, plan.query || searchState.query, plan.section);
      }
    } catch (error) {
      plan = {
        query: "",
        section: "",
        rationale: "query_plan_parse_error",
        parseError: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    const planStep = {
      type: "action",
      action: "plan_query",
      input: { ...plan, usedQuery: searchState.query, ...(searchState.section ? { usedSection: searchState.section } : {}) },
      content: "plan_query",
    };
    controllerSteps.push(planStep);
    orderedSteps.push(planStep);
  }

  if (!input.skipEvidenceSearch) {
    for (let round = 0; round < maxEvidenceRounds; round += 1) {
      await searchAndRead(searchState, nextSearchTopK);
      if (disableSufficiencyAssessment) continue;
      const assessment = await assessEvidence();

      const enoughRounds = round + 1 >= minEvidenceRounds;
      const enoughViewedSegments = viewedSegments.length >= minViewedSegmentsBeforeSufficient;
      const mayStop = enoughRounds && enoughViewedSegments;
      if (mayStop && (assessment.sufficiency === "sufficient" || assessment.sufficiency === "conflicting")) break;
      if (assessment.sufficiency === "insufficient" && escalateTopKOnInsufficient) {
        nextSearchTopK = Math.max(defaultTopK, escalateTopKOnInsufficient);
      }
      if (round < maxEvidenceRounds - 1) {
        searchState = buildSearchState(input.record, sourceAwareQueryPlanning, assessment.nextQuery || searchState.query);
        const requestStep = {
          type: "action",
          action: "request_more_evidence",
          input: { query: searchState.query, ...(searchState.section ? { section: searchState.section } : {}), reason: assessment.rationale },
          content: "request_more_evidence",
        };
        controllerSteps.push(requestStep);
        orderedSteps.push(requestStep);
      }
    }
  } else {
    if (!disableSufficiencyAssessment) await assessEvidence();
  }

  let submission = await draftSubmission();
  if (submission.parseError) {
    return buildParseErrorResult(input, {
      ...submission,
      action: "submit_parse_error",
      runtime,
      controllerSteps,
      orderedSteps,
      viewedSegments,
      assessment: latestAssessment,
      assessments,
    });
  }
  let { rawText, payload } = submission;
  if (input.citationSelfCheck) {
    const maxCitationSelfCheckRounds = Math.max(1, input.maxCitationSelfCheckRounds || 1);
    for (let selfCheckRound = 0; selfCheckRound < maxCitationSelfCheckRounds; selfCheckRound += 1) {
      const selfCheckRaw = await input.invokeModel({
        phase: "citation_self_check",
        prompt: buildV4EdlCitationSelfCheckPrompt(input.record, viewedSegments, payload),
        record: stripGoldFields(input.record),
        viewedSegments,
        draftPayload: payload,
        toolEvents: runtime.getEvents(),
      });
      const parsedSelfCheck = parseJsonTextResult(selfCheckRaw, "citation_self_check_parse_error");
      if (parsedSelfCheck.parseError) {
        appendParseErrorStep("citation_self_check_parse_error", parsedSelfCheck.parseError, controllerSteps, orderedSteps);
        break;
      }
      const selfCheck = normalizeCitationSelfCheck(parsedSelfCheck.value);
      const selfCheckStep = { type: "action", action: "citation_self_check", input: selfCheck, content: "citation_self_check" };
      controllerSteps.push(selfCheckStep);
      orderedSteps.push(selfCheckStep);
      if (selfCheck.status === "pass") break;
      if (input.skipEvidenceSearch || selfCheckRound >= maxCitationSelfCheckRounds - 1 || !selfCheck.nextQuery) break;
      searchState = buildSearchState(input.record, sourceAwareQueryPlanning, selfCheck.nextQuery);
      const requestStep = {
        type: "action",
        action: "request_more_evidence",
        input: { query: searchState.query, ...(searchState.section ? { section: searchState.section } : {}), reason: selfCheck.rationale },
        content: "request_more_evidence",
      };
      controllerSteps.push(requestStep);
      orderedSteps.push(requestStep);
      await searchAndRead(searchState, nextSearchTopK);
      if (!disableSufficiencyAssessment) await assessEvidence();
      submission = await draftSubmission();
      if (submission.parseError) {
        return buildParseErrorResult(input, {
          ...submission,
          action: "submit_parse_error",
          runtime,
          controllerSteps,
          orderedSteps,
          viewedSegments,
          assessment: latestAssessment,
          assessments,
        });
      }
      ({ rawText, payload } = submission);
    }
  }
  await runtime.run("submit_decision", payload);
  appendNewToolEvents();
  const validation = validateV4EdlArtifact(input.record, payload, { disableCitationValidation });

  if (!validation.valid && typeof input.invokeRepairModel === "function") {
    const repairedRawText = await input.invokeRepairModel({
      prompt: buildV4EdlRepairPrompt(input.record, payload, validation, promptOptions),
      record: stripGoldFields(input.record),
      previousPayload: payload,
      validation,
    });
    const parsedRepair = parseJsonTextResult(repairedRawText, "repair_parse_error");
    if (parsedRepair.parseError) {
      return buildParseErrorResult(input, {
        rawText: repairedRawText,
        payload: normalizeV4EdlArtifact({}),
        parseError: parsedRepair.parseError,
        action: "repair_parse_error",
        runtime,
        controllerSteps,
        orderedSteps,
        viewedSegments,
        assessment: latestAssessment,
        assessments,
      });
    }
    const repairedPayload = normalizeV4EdlArtifact(parsedRepair.value);
    await runtime.run("submit_decision", repairedPayload);
    appendNewToolEvents();
    const repairedValidation = validateV4EdlArtifact(input.record, repairedPayload, { disableCitationValidation });
    return {
      rawText: repairedRawText,
      payload: repairedPayload,
      validation: repairedValidation,
      toolEvents: runtime.getEvents(),
      controllerSteps,
      orderedSteps,
      viewedSegments,
      assessment: latestAssessment,
      assessments,
      repaired: true,
      previousValidation: validation,
    };
  }

  return {
    rawText,
    payload,
    validation,
    toolEvents: runtime.getEvents(),
    controllerSteps,
    orderedSteps,
    viewedSegments,
    assessment: latestAssessment,
    assessments,
    repaired: false,
  };
}

function normalizeSufficiencyAssessment(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const allowed = new Set(["sufficient", "insufficient", "conflicting"]);
  const sufficiency = allowed.has(input.sufficiency) ? input.sufficiency : "insufficient";
  return {
    sufficiency,
    nextQuery: typeof input.nextQuery === "string" ? input.nextQuery : "",
    rationale: typeof input.rationale === "string" ? input.rationale : "",
  };
}

function normalizeCitationSelfCheck(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    status: input.status === "pass" ? "pass" : "needs_more_evidence",
    nextQuery: typeof input.nextQuery === "string" ? input.nextQuery : "",
    rationale: typeof input.rationale === "string" ? input.rationale : "",
    problematicCitations: Array.isArray(input.problematicCitations) ? input.problematicCitations : [],
  };
}

function normalizeQueryPlan(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    query: typeof input.query === "string" ? input.query.trim() : "",
    section: normalizeNli4ctSection(input.section),
    rationale: typeof input.rationale === "string" ? input.rationale : "",
  };
}

function buildSearchState(record, sourceAwareQueryPlanning, query, sectionHint = "") {
  const normalizedQuery = String(query || "").trim() || String(record?.task?.input || "").trim();
  const section = shouldUseNli4ctSectionSearch(record, sourceAwareQueryPlanning)
    ? normalizeNli4ctSection(sectionHint) || inferNli4ctSection(normalizedQuery) || inferNli4ctSection(record?.task?.input)
    : "";
  return {
    query: normalizedQuery,
    section,
  };
}

function shouldPlanSourceAwareQuery(record, sourceAwareQueryPlanning) {
  const source = String(record?.source || "").toLowerCase();
  return (
    (sourceAwareQueryPlanning === "scifact" && source === "scifact") ||
    (sourceAwareQueryPlanning === "nli4ct" && source === "nli4ct")
  );
}

function shouldUseNli4ctSectionSearch(record, sourceAwareQueryPlanning) {
  return sourceAwareQueryPlanning === "nli4ct" && String(record?.source || "").toLowerCase() === "nli4ct";
}

function normalizeNli4ctSection(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const aliases = new Map([
    ["intervention", "Intervention"],
    ["interventions", "Intervention"],
    ["eligibility", "Eligibility"],
    ["eligible", "Eligibility"],
    ["results", "Results"],
    ["result", "Results"],
    ["adverse events", "Adverse Events"],
    ["adverse event", "Adverse Events"],
    ["adverse_events", "Adverse Events"],
    ["ae", "Adverse Events"],
    ["aes", "Adverse Events"],
  ]);
  return aliases.get(normalized) || "";
}

function inferNli4ctSection(value) {
  const text = String(value || "").toLowerCase();
  if (!text.trim()) return "";
  if (/\b(adverse events?|ae|aes|toxicit(?:y|ies)|serious events?|deaths?|anaemi?a|neutropenia|febrile|fatigue|nausea|diarrhea|vomiting)\b/.test(text)) {
    return "Adverse Events";
  }
  if (/\b(results?|outcomes?|outcome measurement|measurements?|units? of measure|time frame|participants analyzed|survival|mortality|remission|response rates?|progression[-\s]?free|pfs|overall survival|hazard ratio|confidence interval|median|percentage|score|baseline|change from baseline)\b/.test(text)) {
    return "Results";
  }
  if (/\b(interventions?|treatment arms?|arms?|cohorts?|groups?|drug|dose|doses|dosage|regimen|administered|oral|intravenous|iv|placebo|chemotherapy|radiation|surgery|exercise)\b/.test(text)) {
    return "Intervention";
  }
  if (/\b(eligibility|eligible|inclusion|exclusion|criteria|disease characteristics?|histologic(?:al)?|confirmed|diagnos(?:is|ed)|metastatic|stage iv|prior concurrent therapy|prior therapy|nyha|angina)\b/.test(text)) {
    return "Eligibility";
  }
  return "";
}

function stripGoldFields(record) {
  const {
    requiredEvidence,
    goldDecision,
    expectedReviewRequired,
    auditDecision,
    auditRationale,
    ...visible
  } = record || {};
  return visible;
}

function parseJsonText(value) {
  if (value && typeof value === "object") return value;
  const text = String(value || "").trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1].trim() : text);
}

module.exports = {
  buildV4EdlPrompt,
  buildV4EdlAssessPrompt,
  buildV4EdlSubmitPrompt,
  buildV4EdlCitationSelfCheckPrompt,
  buildV4EdlQueryPlanPrompt,
  buildV4EdlRepairPrompt,
  normalizeSufficiencyAssessment,
  normalizeCitationSelfCheck,
  normalizeV4EdlArtifact,
  validateV4EdlArtifact,
  inferNli4ctSection,
  runV4EdlController,
};
