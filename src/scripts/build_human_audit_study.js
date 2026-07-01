#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  DEFAULT_SEED,
  DEFAULT_RATERS_PER_FORMAT_PER_CASE,
  DEFAULT_RATER_IDS,
  DEFAULT_SOURCE_RECORD_PATH,
  DEFAULT_SOURCE_FILTERS,
  DEFAULT_SOURCE_TARGETS,
  DEFAULT_STUDY_DIR,
  DEFAULT_TRACE_PATH,
} = require("./lib/human_audit/constants");
const { buildStudyBundleFromFiles, writeStudyBundle } = require("./lib/human_audit/study_builder");

const repoRoot = path.resolve(__dirname, "..", "..");

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const bundle = buildStudyBundleFromFiles({
    sourceRecordPath: path.resolve(repoRoot, options.sourceRecordPath),
    tracePath: path.resolve(repoRoot, options.tracePath),
    seed: options.seed,
    raterIds: options.raterIds,
    sourceFilters: options.sourceFilters,
    sourceTargets: options.sourceTargets,
    ratersPerFormatPerCase: options.ratersPerFormatPerCase,
    sourceRecordPathLabel: options.sourceRecordPath,
    tracePathLabel: options.tracePath,
  });
  bundle.study.sourceRecordPath = options.sourceRecordPath;
  bundle.study.tracePath = options.tracePath;
  const outDir = path.resolve(repoRoot, options.outDir);
  writeStudyBundle(outDir, bundle);
  console.log(`Wrote human audit study: ${outDir}`);
  console.log(`Cases: ${bundle.study.sampleSize}`);
  console.log(`Stimuli: ${bundle.stimuli.length}`);
  console.log(`Assignments: ${bundle.assignments.length}`);
}

function parseArgs(args) {
  const options = {
    outDir: DEFAULT_STUDY_DIR,
    sourceRecordPath: DEFAULT_SOURCE_RECORD_PATH,
    tracePath: DEFAULT_TRACE_PATH,
    seed: DEFAULT_SEED,
    raterIds: DEFAULT_RATER_IDS.slice(),
    sourceFilters: DEFAULT_SOURCE_FILTERS.slice(),
    sourceTargets: DEFAULT_SOURCE_TARGETS.map((target) => ({ ...target })),
    ratersPerFormatPerCase: DEFAULT_RATERS_PER_FORMAT_PER_CASE,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--out-dir") options.outDir = args[++index];
    else if (arg === "--source-records") options.sourceRecordPath = args[++index];
    else if (arg === "--traces") options.tracePath = args[++index];
    else if (arg === "--seed") options.seed = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

module.exports = { parseArgs };
