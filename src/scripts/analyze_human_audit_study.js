#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { DEFAULT_STUDY_DIR } = require("./lib/human_audit/constants");
const { analyzeResponses, latestResponses } = require("./lib/human_audit/analysis");
const { ensureDir, readJson, readJsonl, writeCsv, writeJsonAtomic } = require("./lib/human_audit/io");

const repoRoot = path.resolve(__dirname, "..", "..");

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const studyDir = path.resolve(repoRoot, options.studyDir);
  const stimuli = readJson(path.join(studyDir, "stimuli.json"));
  const responses = readJsonl(path.join(studyDir, "private", "responses.jsonl"));
  const finalResponses = latestResponses(responses);
  const result = analyzeResponses({ stimuli, responses });
  const exportDir = path.join(studyDir, "exports");
  ensureDir(exportDir);
  writeJsonAtomic(path.join(exportDir, "human-audit-results.json"), result);
  fs.writeFileSync(path.join(exportDir, "human-audit-results.md"), result.markdown);
  writeCsv(path.join(exportDir, "responses.csv"), finalResponses, [
    "responseId",
    "revision",
    "raterId",
    "assignmentId",
    "stimulusId",
    "caseId",
    "formatLabel",
    "startedAt",
    "submittedAt",
    "clientElapsedMs",
    "serverElapsedMs",
    "acceptability",
    "confidence",
    "cognitiveLoad",
    "notes",
  ]);
  console.log(result.markdown);
}

function parseArgs(args) {
  const options = { studyDir: DEFAULT_STUDY_DIR };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--study-dir") options.studyDir = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

module.exports = { parseArgs };
