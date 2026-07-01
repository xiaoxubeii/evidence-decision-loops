"use strict";

const crypto = require("crypto");
const path = require("path");
const { ACCEPTABILITY_VALUES, RESPONSE_SCHEMA_VERSION } = require("./constants");
const { parseDecisionRecord } = require("./decision_record_parser");
const { appendJsonl, readJson, readJsonl } = require("./io");

function createStudyStore(studyDir) {
  const study = readJson(path.join(studyDir, "study.json"));
  const stimuli = readJson(path.join(studyDir, "stimuli.json"));
  const assignments = readJson(path.join(studyDir, "assignments.json"));
  const raters = readJson(path.join(studyDir, "private", "raters.json"));
  const admin = readJson(path.join(studyDir, "private", "admin.json"));
  const stimuliById = new Map(stimuli.map((stimulus) => [stimulus.stimulusId, stimulus]));
  const assignmentsById = new Map(assignments.map((assignment) => [assignment.assignmentId, assignment]));
  const raterTokens = new Map(raters.map((rater) => [rater.raterId, rater.token]));
  const sourceSegmentsByCase = loadSourceSegmentsByCase(study, studyDir);
  const responsePath = path.join(studyDir, "private", "responses.jsonl");
  const eventPath = path.join(studyDir, "private", "events.jsonl");

  function readResponses() {
    try {
      return readJsonl(responsePath);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  function submittedAssignmentIds() {
    return new Set(latestResponses(readResponses()).map((response) => response.assignmentId));
  }

  return {
    authenticateRater(raterId, token) {
      return Boolean(raterId && token && raterTokens.get(raterId) === token);
    },
    authenticateAdmin(token) {
      return Boolean(token && admin.adminToken === token);
    },
    getStudySummary() {
      return {
        schemaVersion: study.schemaVersion,
        sampleSize: study.sampleSize,
        calibrationSize: study.calibrationSize || 0,
        raterCount: study.raterCount,
      };
    },
    getRaterState(raterId, requestedAssignmentId) {
      const latestByAssignment = latestResponsesByAssignment(readResponses());
      const raterAssignments = assignments
        .filter((item) => item.raterId === raterId)
        .sort((a, b) => a.order - b.order);
      const summaries = raterAssignments.map((assignment) => {
        const response = latestByAssignment.get(assignment.assignmentId);
        return {
          assignmentId: assignment.assignmentId,
          stimulusId: assignment.stimulusId,
          caseId: assignment.caseId,
          order: assignment.order,
          phase: assignment.phase || "main",
          completed: Boolean(response),
          acceptability: response ? response.acceptability : null,
        };
      });
      const requested = requestedAssignmentId
        ? raterAssignments.find((assignment) => assignment.assignmentId === requestedAssignmentId)
        : null;
      if (requestedAssignmentId && !requested) throw new Error("Assignment does not belong to rater");
      const assignment = requested || raterAssignments.find((item) => !latestByAssignment.has(item.assignmentId)) || null;
      return {
        assignments: summaries,
        current: assignment
          ? {
              assignment,
              stimulus: publicStimulus(stimuliById.get(assignment.stimulusId), sourceSegmentsByCase),
              response: latestByAssignment.get(assignment.assignmentId) || null,
            }
          : null,
      };
    },
    getNextAssignment(raterId) {
      const submitted = submittedAssignmentIds();
      const assignment = assignments
        .filter((item) => item.raterId === raterId)
        .sort((a, b) => a.order - b.order)
        .find((item) => !submitted.has(item.assignmentId));
      if (!assignment) return null;
      return { assignment, stimulus: publicStimulus(stimuliById.get(assignment.stimulusId), sourceSegmentsByCase) };
    },
    getProgress() {
      const submitted = submittedAssignmentIds();
      const byRater = {};
      for (const assignment of assignments) {
        byRater[assignment.raterId] = byRater[assignment.raterId] || { assigned: 0, completed: 0 };
        byRater[assignment.raterId].assigned += 1;
        if (submitted.has(assignment.assignmentId)) byRater[assignment.raterId].completed += 1;
      }
      return { totalAssigned: assignments.length, totalCompleted: submitted.size, byRater };
    },
    submitResponse(input) {
      validateResponseInput(input, assignmentsById);
      const assignment = assignmentsById.get(input.assignmentId);
      if (assignment.raterId !== input.raterId) throw new Error("Assignment does not belong to rater");
      if (assignment.stimulusId !== input.stimulusId) throw new Error("Assignment stimulus mismatch");
      const revision = readResponses().filter((response) => response.assignmentId === input.assignmentId).length + 1;
      const stimulus = stimuliById.get(input.stimulusId);
      const response = {
        schemaVersion: RESPONSE_SCHEMA_VERSION,
        responseId: `resp_${crypto.randomUUID()}`,
        revision,
        raterId: input.raterId,
        assignmentId: input.assignmentId,
        stimulusId: input.stimulusId,
        caseId: assignment.caseId,
        formatLabel: stimulus.formatLabel,
        startedAt: input.startedAt,
        submittedAt: input.submittedAt,
        clientElapsedMs: Number(input.clientElapsedMs),
        serverElapsedMs: Math.max(0, Date.parse(input.submittedAt) - Date.parse(input.startedAt)),
        acceptability: input.acceptability,
        confidence: Number(input.confidence),
        cognitiveLoad: Number(input.cognitiveLoad),
        notes: input.notes || "",
      };
      appendJsonl(responsePath, response);
      appendJsonl(eventPath, {
        event: "response_submitted",
        at: new Date().toISOString(),
        raterId: input.raterId,
        assignmentId: input.assignmentId,
        revision,
      });
      return response;
    },
    exportResponses() {
      return latestResponses(readResponses());
    },
    exportStimuli() {
      return stimuli.slice();
    },
    getStimulusForAnalysis(stimulusId) {
      return stimuliById.get(stimulusId);
    },
  };
}

function latestResponsesByAssignment(responses) {
  const latest = new Map();
  for (const response of responses) {
    latest.set(response.assignmentId, response);
  }
  return latest;
}

function latestResponses(responses) {
  return Array.from(latestResponsesByAssignment(responses).values());
}

function publicStimulus(stimulus, sourceSegmentsByCase) {
  if (!stimulus) throw new Error("Unknown stimulus");
  const { hiddenMethod, goldDecision, decisionCorrect, primaryMetric, failureStage, correctnessClass, phase, ...publicFields } = stimulus;
  const reportText = sanitizePublicReportText(stimulus.reportText || "");
  return {
    ...publicFields,
    reportText,
    decisionRecord: enrichDecisionRecord(parseDecisionRecord(reportText), stimulus, sourceSegmentsByCase),
  };
}

function sanitizePublicReportText(reportText) {
  return String(reportText || "")
    .split("\n")
    .filter((line) => !/\baction=format_[a-z0-9_-]*_validate\b/i.test(line))
    .filter((line) => !/\bcontent=format_[a-z0-9_-]*_validate\b/i.test(line))
    .join("\n");
}

function enrichDecisionRecord(decisionRecord, stimulus, sourceSegmentsByCase) {
  const segmentsByEvidenceId = sourceSegmentsByCase.get(stimulus.caseId) || new Map();
  return {
    ...decisionRecord,
    citedEvidenceDetails: (decisionRecord.citedEvidence || []).map((evidenceId) => ({
      evidenceId,
      text: segmentsByEvidenceId.get(evidenceId) || "",
    })),
  };
}

function loadSourceSegmentsByCase(study, studyDir) {
  if (!study.sourceRecordPath) return new Map();
  const records = readFirstAvailableJsonl(resolveSourceRecordCandidates(study.sourceRecordPath, studyDir));
  if (!records) return new Map();
  const byCase = new Map();
  for (const record of records) {
    const segmentsByEvidenceId = new Map();
    for (const document of record.documents || []) {
      for (const segment of document.segments || []) {
        segmentsByEvidenceId.set(`${document.documentId}:${segment.segmentId}`, segment.text || "");
      }
    }
    byCase.set(record.id, segmentsByEvidenceId);
  }
  return byCase;
}

function resolveSourceRecordCandidates(sourceRecordPath, studyDir) {
  if (path.isAbsolute(sourceRecordPath)) return [sourceRecordPath];
  return Array.from(new Set([path.resolve(sourceRecordPath), path.resolve(studyDir, sourceRecordPath)]));
}

function readFirstAvailableJsonl(filePaths) {
  for (const filePath of filePaths) {
    try {
      return readJsonl(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return null;
}

function validateResponseInput(input, assignmentsById) {
  if (!assignmentsById.has(input.assignmentId)) throw new Error("Unknown assignment");
  if (!ACCEPTABILITY_VALUES.includes(input.acceptability)) throw new Error(`Invalid acceptability: ${input.acceptability}`);
  if (!Number.isInteger(Number(input.confidence)) || Number(input.confidence) < 1 || Number(input.confidence) > 5) {
    throw new Error("Invalid confidence");
  }
  if (!Number.isInteger(Number(input.cognitiveLoad)) || Number(input.cognitiveLoad) < 1 || Number(input.cognitiveLoad) > 5) {
    throw new Error("Invalid cognitiveLoad");
  }
  if (!input.startedAt || Number.isNaN(Date.parse(input.startedAt))) throw new Error("Invalid startedAt");
  if (!input.submittedAt || Number.isNaN(Date.parse(input.submittedAt))) throw new Error("Invalid submittedAt");
  if (!Number.isFinite(Number(input.clientElapsedMs)) || Number(input.clientElapsedMs) < 0) throw new Error("Invalid clientElapsedMs");
}

module.exports = { createStudyStore, latestResponses, sanitizePublicReportText };
